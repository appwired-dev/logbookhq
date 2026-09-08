/**
 * Grid typing + header band tests (lib/import/grid.ts, headers.ts, util.ts).
 *
 *   npm run test:import        (scripts/run-import-tests.ts picks this file up)
 *
 * Pure and offline: CSV text and in-memory grids only. Every case prints
 * PASS/FAIL; `process.exitCode` is set to 1 on any FAIL.
 *
 * Reviewer findings covered:
 *   R2   header band lost when early rows have one hours cell + a free-text aircraft
 *   R5   day/month tie recorded as ambiguous per column, raws kept, parseDateText({ dayFirst })
 *   R7   duration formats (1h30, 1 h 30, 0h30, 1h, 90 min, 90min, 1:30:00, 1.5h, 1+30); num() never prefix-parses
 *   R16  HHMM columns without a colon ("0130") → clock evidence → hours
 *   R27  clock strings of 1000 h and more ("1001:30")
 *   R28  TOTAL_ROW_RE variants ("2020 Total", "Year total", "Sub-total", "B/F" …)
 *   +    Excel duration Dates (1899-12-30 + fraction) still read as hours
 */
import assert from "node:assert/strict";
import { analyzeWorkbook, applyMapping, readWorkbook, type Cell, type Grid } from "../lib/import";
import { dayFirstDecision, gridFromValues, parseDelimited, typeText } from "../lib/import/grid";
import { detectHeaderBand, looksLikeDataRow } from "../lib/import/headers";
import { TOTAL_ROW_RE, num, parseDateText, parseDurationText, parseTimeValue } from "../lib/import/util";

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

let passed = 0, failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
  }
}

const enc = (t: string) => new TextEncoder().encode(t);
const csvGrid = (text: string): Grid => gridFromValues("csv", parseDelimited(text));
const hours = (value: number, raw: string): Cell => ({ kind: "number", value, raw });
const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} expected ${b}, got ${a}`);

function pipeline(name: string, text: string) {
  const bytes = enc(text);
  const analysis = analyzeWorkbook(bytes, name);
  const workbook = readWorkbook(bytes, name);
  const applied = applyMapping(workbook, analysis, analysis.mapping);
  return { analysis, workbook, applied };
}

// ---------------------------------------------------------------------------
// R2 — header band / lost leading rows
// ---------------------------------------------------------------------------

const PIPER = [
  "Date,Aircraft,Route,Total,Night",
  "2024-03-05,Piper Cherokee,Shoreham - Lydd,1.5,",
  "2024-03-06,Piper Cherokee,Lydd - Shoreham,1.2,",
  "2024-03-07,Piper Cherokee,Shoreham local,1.0,",
  "2024-03-09,Piper Cherokee,Shoreham - Goodwood,1.1,",
  "2024-03-12,Piper Cherokee,Shoreham local,1.3,0.6",
  "2024-03-13,Piper Cherokee,Shoreham local,1.0,",
].join("\n");

test("R2: looksLikeDataRow accepts a date + one numeric cell with a free-text aircraft", () => {
  const g = csvGrid(PIPER);
  assert.equal(looksLikeDataRow(g.rows[0]), false, "header row is not data");
  for (let r = 1; r <= 6; r++) assert.equal(looksLikeDataRow(g.rows[r]), true, `row ${r} is data`);
});

test("R2: Piper Cherokee fixture — header row found, dataStart 1, all 6 rows imported", () => {
  const { analysis, applied } = pipeline("lost-leading-rows.csv", PIPER);
  assert.deepEqual(analysis.header.rows, [0]);
  assert.equal(analysis.header.dataStart, 1);
  assert.equal(analysis.header.dateRowsAbove, 0);
  assert.deepEqual(analysis.header.paths.map((p) => p.label), ["Date", "Aircraft", "Route", "Total", "Night"]);
  assert.deepEqual(applied.skipped, [], `skipped: ${JSON.stringify(applied.skipped)}`);
  assert.equal(applied.flights.length, 6);
  assert.deepEqual(applied.flights.map((f) => f.date), ["2024-03-05", "2024-03-06", "2024-03-07", "2024-03-09", "2024-03-12", "2024-03-13"]);
  assert.deepEqual(applied.flights.map((f) => f.make_model), Array(6).fill("Piper Cherokee"));
  near(applied.flights.reduce((s, f) => s + f.day_time + f.night_time, 0), 7.1, "total hours");
});

test("R2: clock-time total only (\"1:30\") with free-text aircraft — every row imported", () => {
  const { analysis, applied } = pipeline("clock-one-number.csv", [
    "Date,Aircraft,Route,Total,Night",
    "2024-03-05,Piper Cherokee,Shoreham - Lydd,1:30,",
    "2024-03-06,Piper Cherokee,Lydd - Shoreham,1:10,",
    "2024-03-12,Piper Cherokee,Shoreham local,1:20,0:30",
  ].join("\n"));
  assert.deepEqual(analysis.header.rows, [0]);
  assert.equal(analysis.header.dataStart, 1);
  assert.equal(applied.flights.length, 3, `skipped: ${JSON.stringify(applied.skipped)}`);
});

test("R2: a dated row with no hours directly under the header is data — dataStart never sits below a date row", () => {
  const g = csvGrid([
    "Date,Aircraft,Route,Total,Night",
    "2024-03-04,Ground briefing,,,",
    "2024-03-05,Piper Cherokee,Shoreham - Lydd,1.5,",
    "2024-03-06,Piper Cherokee,Lydd - Shoreham,1.2,",
  ].join("\n"));
  const band = detectHeaderBand(g);
  assert.deepEqual(band.rows, [0]);
  assert.equal(band.dataStart, 1);
  assert.equal(band.dateRowsAbove, 0);
  assert.deepEqual(band.paths.map((p) => p.label), ["Date", "Aircraft", "Route", "Total", "Night"]);
});

test("R2: a dated preamble above the header keeps the header and is reported in dateRowsAbove", () => {
  const g = csvGrid([
    "Printed,2024-06-01,,,",
    ",,,,",
    "Date,Aircraft,Route,Total,Night",
    "2024-03-05,Piper Cherokee,Shoreham - Lydd,1.5,",
    "2024-03-06,Piper Cherokee,Lydd - Shoreham,1.2,",
  ].join("\n"));
  const band = detectHeaderBand(g);
  assert.deepEqual(band.rows, [2]);
  assert.equal(band.dataStart, 3);
  assert.equal(band.dateRowsAbove, 1);
});

test("R2: a blank spacer row between header and data does not lose the header; title + blank + header still works", () => {
  const spaced = detectHeaderBand(csvGrid([
    "Date,Aircraft,Route,Total,Night",
    ",,,,",
    "2024-03-05,Piper Cherokee,Shoreham - Lydd,1.5,",
  ].join("\n")));
  assert.deepEqual(spaced.rows, [0]);
  assert.equal(spaced.dataStart, 2);
  const titled = detectHeaderBand(csvGrid([
    "My Pilot Logbook,,,,",
    ",,,,",
    "Date,Aircraft,Route,Total,Night",
    "2024-03-05,Piper Cherokee,Shoreham - Lydd,1.5,",
  ].join("\n")));
  assert.deepEqual(titled.rows, [2]);
  assert.equal(titled.dataStart, 3);
});

// ---------------------------------------------------------------------------
// R7 — duration formats
// ---------------------------------------------------------------------------

const DURATIONS: [string, number][] = [
  ["1h30", 1.5], ["1 h 30", 1.5], ["0h30", 0.5], ["1h", 1], ["90 min", 1.5], ["90min", 1.5],
  ["1:30:00", 1.5], ["1.5h", 1.5], ["1+30", 1.5], ["1:30", 1.5], ["1,5 h", 1.5], ["2 hrs", 2],
  ["1h30m", 1.5], ["1 hr 30 min", 1.5], ["45 minutes", 0.75], ["1.5 hours", 1.5],
];

test("R7: parseDurationText / parseTimeValue read every written duration form as hours", () => {
  for (const [text, h] of DURATIONS) {
    near(parseDurationText(text) ?? NaN, h, `parseDurationText(${JSON.stringify(text)})`);
    near(parseTimeValue(text), h, `parseTimeValue(${JSON.stringify(text)})`);
  }
  near(parseTimeValue("0130"), 1.5, "HHMM");
  near(parseTimeValue("1.5"), 1.5, "decimal");
  near(parseTimeValue("1,5"), 1.5, "decimal comma");
  assert.equal(parseTimeValue("abc"), 0, "unparseable → 0");
  assert.equal(parseTimeValue("1:75"), 0, "minutes ≥ 60 are not a clock time");
  assert.equal(parseDurationText("hrs"), null, "a bare unit is not a duration");
  assert.equal(parseDurationText("1.5"), null, "plain numbers are not durations");
});

test("R7: typeText turns each duration form into an hours cell and keeps the raw text", () => {
  for (const [text, h] of DURATIONS) {
    const { cell } = typeText(text);
    assert.equal(cell.kind, "number", `${JSON.stringify(text)} typed as ${cell.kind}`);
    if (cell.kind === "number") { near(cell.value, h, text); assert.equal(cell.raw, text); }
  }
});

test("R7: num() never prefix-parses text with letters; plain numeric conventions still work", () => {
  for (const bad of ["1h30", "1.5h", "90 min", "abc", "1:30", "C172", "1e5x", ""]) {
    assert.equal(num(bad), null, `num(${JSON.stringify(bad)})`);
  }
  assert.equal(num("1.5"), 1.5);
  assert.equal(num("1,5"), 1.5);
  assert.equal(num("1,234.5"), 1234.5);
  assert.equal(num("-0.3"), -0.3);
  assert.equal(num("$12"), 12);
});

test("R7: bad-data style rows — 1h30 / 90 min / 1.5h / 1+30 import as 1.5 h each", () => {
  const { applied } = pipeline("durations.csv", [
    "Date,Aircraft,Reg,Route,PIC,Total",
    "2024-03-07,C172,G-ABCD,EGLL-EGKK,1h30,1h30",
    "2024-03-08,C172,G-ABCD,EGLL-EGKK,90 min,90 min",
    "2024-03-10,C172,G-ABCD,EGLL-EGKK,1.5h,1.5 hrs",
    "2024-03-11,C172,G-ABCD,EGLL-EGKK,1+30,1+30",
    "2024-03-12,C172,G-ABCD,EGLL-EGKK,1 h 30,1:30:00",
  ].join("\n"));
  assert.deepEqual(applied.skipped, [], `skipped: ${JSON.stringify(applied.skipped)}`);
  assert.deepEqual(applied.flights.map((f) => f.day_time), [1.5, 1.5, 1.5, 1.5, 1.5]);
});

// ---------------------------------------------------------------------------
// R16 — HHMM without a colon
// ---------------------------------------------------------------------------

test("R16: a column that is ≥ 60 % HHMM with a leading zero becomes hours with raw \"hh:mm\"", () => {
  const g = csvGrid(["PIC", "0130", "0045", "0015", "1005"].join("\n"));
  assert.deepEqual(g.rows[1][0], hours(1.5, "01:30"));
  assert.deepEqual(g.rows[2][0], hours(0.75, "00:45"));
  assert.deepEqual(g.rows[3][0], hours(0.25, "00:15"));
  const last = g.rows[4][0];
  assert.equal(last.kind, "number");
  if (last.kind === "number") { near(last.value, 10 + 5 / 60); assert.equal(last.raw, "10:05"); }
});

test("R16: years, flight numbers and mostly-decimal columns are left alone", () => {
  const years = csvGrid(["Year", "2019", "2020", "2021"].join("\n"));
  assert.deepEqual(years.rows[1][0], hours(2019, "2019"));
  const flightNos = csvGrid(["Flt", "1234", "1450", "2210"].join("\n"));
  assert.deepEqual(flightNos.rows[1][0], hours(1234, "1234"));
  // One stray "0130" among decimals is below the 60 % bar.
  const mixed = csvGrid(["PIC", "1.5", "1.2", "0130", "2.0"].join("\n"));
  assert.deepEqual(mixed.rows[3][0], hours(130, "0130"));
});

test("R16: hhmm.csv — clockTimes convention detected, flights carry 1.5 / 0.75 / 10.1 h", () => {
  const { analysis, applied } = pipeline("hhmm.csv", [
    "Date,Aircraft,Reg,PIC,Night,Total",
    "2024-03-05,C172,G-ABCD,0130,0045,0130",
    "2024-03-06,C172,G-ABCD,0015,,0015",
    "2024-03-07,C172,G-ABCD,1005,,1005",
  ].join("\n"));
  assert.equal(analysis.mapping.conventions.clockTimes, true, "HHMM column counts as clock evidence");
  assert.deepEqual(applied.skipped, [], `skipped: ${JSON.stringify(applied.skipped)}`);
  // apply rounds each bucket to 0.1 h (0.75 day + 0.75 night → 0.8 + 0.8), so compare within that.
  const expected = [1.5, 0.25, 10 + 5 / 60];
  applied.flights.forEach((f, i) => {
    const got = f.day_time + f.night_time;
    assert.ok(Math.abs(got - expected[i]) <= 0.11, `row ${i + 1}: ${got} h vs ${expected[i]} h`);
  });
  assert.ok(Math.abs(applied.flights[0].night_time - 0.75) <= 0.06, `night ${applied.flights[0].night_time}`);
  assert.deepEqual(applied.flights.slice(1).map((f) => f.night_time), [0, 0]);
});

// ---------------------------------------------------------------------------
// R27 — clock strings of 1000 h and more
// ---------------------------------------------------------------------------

test("R27: \"1001:30\" and other [h]:mm totals with 4–5 hour digits are clock values", () => {
  assert.deepEqual(typeText("1001:30").cell, hours(1001.5, "1001:30"));
  assert.deepEqual(typeText("12345:15").cell, hours(12345.25, "12345:15"));
  assert.deepEqual(typeText("1002:45:00").cell, hours(1002.75, "1002:45:00"));
  near(parseTimeValue("1001:30"), 1001.5);
  assert.equal(typeText("1001:75").cell.kind, "text", "minutes ≥ 60 is not a clock string");
});

test("R27: clock-total-4digit footer — the 1001:30 total row is skipped as a total, flights unaffected", () => {
  const { applied } = pipeline("clock-total-4digit.csv", [
    "Date,Aircraft,Reg,From,To,PIC,Dual,Night,IFR,Total",
    "2024-03-05,C172,G-ABCD,EGLL,EGKK,1:30,,0:30,,1:30",
    "2024-03-06,C172,G-ABCD,EGKK,EGLL,,1:15,,0:20,1:15",
    "Totals,,,,,1001:30,1:15,0:30,0:20,1002:45",
  ].join("\n"));
  assert.equal(applied.flights.length, 2);
  assert.deepEqual(applied.skipped.map((s) => s.reason), ["header_or_total_row"]);
});

// ---------------------------------------------------------------------------
// R28 — total-row labels
// ---------------------------------------------------------------------------

test("R28: TOTAL_ROW_RE matches year / sub / grand / sum / carried-forward variants", () => {
  const yes = [
    "Total", "Totals", "Total 2019", "Totals 2019", "2020 Total", "2020 Totals", "2021 Subtotal", "Year total", "Yearly totals",
    "Subtotal", "Sub-total", "Sub total", "Grand Total", "Grand totals", "Sum", "Summe", "Carried forward", "Brought forward",
    "B/F", "C/F", "c/f 2019", "Total hours", "Gesamt", "합계", "总计",
  ];
  for (const s of yes) assert.ok(TOTAL_ROW_RE.test(s), `expected ${JSON.stringify(s)} to be a total-row label`);
  const no = ["Totally fine", "Subaru", "Summary of flight", "C172", "Piper Cherokee", "2024-03-05", "EGLL-EGKK", "Circuits", "Bfr check"];
  for (const s of no) assert.ok(!TOTAL_ROW_RE.test(s), `expected ${JSON.stringify(s)} NOT to be a total-row label`);
});

test("R28: \"2020 Total\" and \"Year total\" rows inside the data are skipped as totals, not imported", () => {
  const { applied } = pipeline("mid-subtotals.csv", [
    "Date,Aircraft,Reg,Route,PIC,Dual,Night,Total",
    "2019-03-05,C172,G-ABCD,EGLL-EGKK,1.5,,0.5,1.5",
    "Total 2019,,,,1.5,,0.5,1.5",
    "2020-04-01,PA28,G-BXYZ,EGLL-EGLL,2.0,,,2.0",
    "2020 Total,,,,2.0,,,2.0",
    "2021-05-01,PA28,G-BXYZ,EGLL-EGLL,1.0,,,1.0",
    "Year total,,,,1.0,,,1.0",
    "B/F,,,,4.5,,0.5,4.5",
  ].join("\n"));
  assert.equal(applied.flights.length, 3);
  assert.deepEqual(applied.skipped.map((s) => s.reason), ["header_or_total_row", "header_or_total_row", "header_or_total_row", "header_or_total_row"]);
});

// ---------------------------------------------------------------------------
// R5 — ambiguous day/month tie
// ---------------------------------------------------------------------------

test("R5: a column valid both ways and equally monotonic is recorded as ambiguous; raws are kept", () => {
  const g = csvGrid([
    "Date,Aircraft,Total",
    "01/02/2024,C172,1.5",
    "02/03/2024,C172,1.2",
    "03/04/2024,C172,1.0",
  ].join("\n"));
  assert.ok(g.dateCols, "dateCols recorded");
  assert.deepEqual(g.dateCols?.[0], { dayFirst: false, ambiguous: true });
  assert.deepEqual(g.rows[1][0], { kind: "date", value: "2024-01-02", raw: "01/02/2024" });
  assert.deepEqual(g.rows[3][0], { kind: "date", value: "2024-03-04", raw: "03/04/2024" });
  // The dotted form only differs in its provisional reading; it is just as ambiguous.
  const dotted = csvGrid(["Date,Total", "01.02.2024,1.5", "02.03.2024,1.2"].join("\n"));
  assert.deepEqual(dotted.dateCols?.[0], { dayFirst: true, ambiguous: true });
  assert.deepEqual(dotted.rows[1][0], { kind: "date", value: "2024-02-01", raw: "01.02.2024" });
});

test("R5: evidence (a 13th, or a more monotonic order) settles the column — not ambiguous", () => {
  const thirteenth = csvGrid(["Date,Total", "05/03/2024,1.5", "13/06/2024,1.0"].join("\n"));
  assert.deepEqual(thirteenth.dateCols?.[0], { dayFirst: true, ambiguous: false });
  assert.deepEqual(thirteenth.rows[1][0], { kind: "date", value: "2024-03-05", raw: "05/03/2024" });
  const order = csvGrid(["Date,Total", "05/03/2024,1.5", "06/03/2024,1.2", "07/04/2024,1.1", "01/05/2024,2.0", "02/05/2024,1.0"].join("\n"));
  assert.deepEqual(order.dateCols?.[0], { dayFirst: true, ambiguous: false });
  const iso = csvGrid(["Date,Total", "2024-03-05,1.5"].join("\n"));
  assert.equal(iso.dateCols, undefined, "no numeric-form dates → nothing to record");
  assert.deepEqual(dayFirstDecision([]), { dayFirst: false, ambiguous: false });
});

test("R5: parseDateText(raw, { dayFirst }) re-parses a kept raw under either convention", () => {
  assert.equal(parseDateText("05/03/2024", { dayFirst: true }), "2024-03-05");
  assert.equal(parseDateText("05/03/2024", { dayFirst: false }), "2024-05-03");
  assert.equal(parseDateText("05.03.24", { dayFirst: false }), "2024-05-03");
  assert.equal(parseDateText("13/06/2024", { dayFirst: false }), "2024-06-13", "falls back when only one reading is valid");
  assert.equal(parseDateText("2024-03-05", { dayFirst: false }), "2024-03-05");
  assert.equal(parseDateText("Piper Cherokee", { dayFirst: true }), null);
  assert.equal(parseDateText("", { dayFirst: true }), null);
  // Legacy shapes still return the full reading.
  assert.equal(parseDateText("05/03/2024")?.iso, "2024-05-03");
  assert.equal(parseDateText("05/03/2024", true)?.iso, "2024-03-05");
});

// ---------------------------------------------------------------------------
// Excel duration Dates keep working alongside the new passes
// ---------------------------------------------------------------------------

test("Excel durations: an epoch-day Date is still 1.5 h / \"1:30\" and is not disturbed by the HHMM pass", () => {
  const g = gridFromValues("t", [
    ["PIC", "Date"],
    [new Date(1899, 11, 30, 1, 30), new Date(2024, 2, 5)],
    [new Date(1899, 11, 30, 0, 45), new Date(2024, 2, 6)],
    [{ excelDays: 0.0625 }, new Date(2024, 2, 7)],
  ]);
  assert.deepEqual(g.rows[1][0], hours(1.5, "1:30"));
  assert.deepEqual(g.rows[2][0], hours(0.75, "0:45"));
  assert.deepEqual(g.rows[3][0], hours(1.5, "1:30"));
  assert.deepEqual(g.rows[1][1], { kind: "date", value: "2024-03-05" });
  assert.equal(g.dateCols, undefined);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
