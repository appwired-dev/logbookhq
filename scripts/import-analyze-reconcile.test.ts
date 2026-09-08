/**
 * Analyze + reconcile tests (lib/import/analyze.ts, lib/import/reconcile.ts):
 * sibling sheets (R3), day-first priors (R5), the Total column summed over
 * kept rows only (R13), count labels (R14), simulator rows in the sheet's
 * Total column (R17), the tolerance floor and off-row pointer (R18),
 * declared figures in minutes (R29), skipped undated rows explaining a gap
 * (R30), unrecognised columns for the arbiter (R33), the instrument
 * invariant (R10) and message keys on every fixed check.
 *
 *   npm run test:import
 *
 * Pure and offline: workbooks are built in memory, no fixtures, no network,
 * no database. Every case prints PASS/FAIL with a reason; the process exit
 * code is 1 on any FAIL.
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  analyzeWorkbook, applyMapping, readWorkbook, reconcile,
  type Analysis, type ApplyResult, type ReconcileCheck, type ReconcileReport,
} from "../lib/import";
import { isCountLabel, isDateBearing, type AnalysisExt } from "../lib/import/analyze";
import { isMinutesLabel } from "../lib/import/reconcile";
import type { ParsedFlight } from "../lib/csv";

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

const results: { name: string; ok: boolean; reason: string }[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, ok: true, reason: "" });
    console.log(`PASS  ${name}`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, reason });
    console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Raw = string | number | Date | null;

function xlsx(sheets: { name: string; rows: Raw[][] }[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows, { cellDates: true }), s.name);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer);
}

const enc = (text: string) => new TextEncoder().encode(text);
const csv = (lines: string[]) => enc(lines.join("\n"));

function run(name: string, bytes: Uint8Array, opts: { aug?: boolean } = {}) {
  const analysis = analyzeWorkbook(bytes, name);
  const workbook = readWorkbook(bytes, name);
  const applied = applyMapping(workbook, analysis, analysis.mapping);
  const report = reconcile(applied, analysis, analysis.mapping, { augHalfCredit: Boolean(opts.aug) });
  return { analysis, workbook, applied, report };
}

function check(report: ReconcileReport, id: string): ReconcileCheck {
  const c = report.checks.find((x) => x.id === id);
  assert.ok(c, `no reconcile check "${id}" (have: ${report.checks.map((x) => x.id).join(", ")})`);
  return c;
}

const ids = (report: ReconcileReport) => report.checks.map((c) => c.id);
const mismatches = (report: ReconcileReport) => report.checks.filter((c) => c.status === "mismatch").map((c) => c.id).join(", ");

/** Three flights: 1.5 PIC (0.5 night), 1.2 PIC, 4.0 SIC (2.0 night) — 6.7 h full, 4.7 h SIC-halved, 2.5 h night, 2.7 h PIC. */
const HEADER: Raw[] = ["Date", "Aircraft", "Reg", "Route", "PIC", "SIC", "Night", "Total"];
const LOG_ROWS: Raw[][] = [
  HEADER,
  [new Date(2024, 2, 5), "C172", "G-ABCD", "EGLL-EGKK", 1.5, null, 0.5, 1.5],
  [new Date(2024, 2, 6), "C172", "G-ABCD", "EGKK-EGLL", 1.2, null, null, 1.2],
  [new Date(2024, 2, 7), "B738", "G-XLEA", "EGLL-EHAM", null, 4.0, 2.0, 4.0],
];
const LOG_CSV = [
  "Date,Aircraft,Reg,Route,PIC,SIC,Night,Total",
  "2024-03-05,C172,G-ABCD,EGLL-EGKK,1.5,,0.5,1.5",
  "2024-03-06,C172,G-ABCD,EGKK-EGLL,1.2,,,1.2",
  "2024-03-07,B738,G-XLEA,EGLL-EHAM,,4.0,2.0,4.0",
];

/** A reconcile run over synthetic SE › PIC flights (day hours as given) against one Totals-sheet grand total. */
function grandTotalCheck(hours: number[], declared: number): ReconcileCheck {
  const { analysis, applied } = run("synthetic.csv", csv(LOG_CSV));
  const base = applied.flights[0];
  const flights: ParsedFlight[] = hours.map((h) => ({ ...base, category: "SE", role: "PIC", day_time: h, night_time: 0 }));
  const result: ApplyResult = { flights, skipped: [], columnSums: {} };
  const a: Analysis = {
    ...analysis, textNumberCells: undefined,
    declaredTotals: [{ source: "totals-sheet", label: "Total Time", value: declared, meaning: { kind: "grand_total" } }],
  };
  return check(reconcile(result, a, analysis.mapping), "grand_total");
}

// ---------------------------------------------------------------------------
// R3 — sibling sheets
// ---------------------------------------------------------------------------

const yearSheet = (y: number, extra: Raw[][] = []): Raw[][] => [
  ["Date", "Aircraft", "Reg", "Route", "PIC", "Night", "Total"],
  [new Date(y, 2, 5), "C172", "G-ABCD", "EGLL-EGKK", 1.5, 0.5, 1.5],
  [new Date(y, 5, 6), "C172", "G-ABCD", "EGKK-EGLL", 1.2, null, 1.2],
  ...extra,
];

test("R3: per-year workbook — sibling sheets listed, row counts summed, other dated sheet named, stats sheet still a totals sheet", () => {
  const bytes = xlsx([
    { name: "2022", rows: yearSheet(2022) },
    { name: "2023", rows: yearSheet(2023) },
    { name: "2024", rows: yearSheet(2024, [[new Date(2024, 8, 1), "C172", "G-ABCD", "EGLL", 1.0, null, 1.0], [new Date(2024, 9, 1), "C172", "G-ABCD", "EGLL", 2.0, null, 2.0]]) },
    { name: "Sim", rows: [["Date", "Device", "Hours", "Approaches"], [new Date(2024, 1, 1), "FNPT II", 2, 3], [new Date(2024, 1, 2), "FNPT II", 2, 2], [new Date(2024, 1, 3), "FNPT II", 1.5, 4]] },
    { name: "Stats", rows: [["Total flights", 8], ["Night", 1.5]] },
  ]);
  const { analysis, report } = run("years.xlsx", bytes);
  assert.equal(analysis.sheetName, "2024", "the sheet with the most flight rows is the flight sheet");
  assert.deepEqual(analysis.siblingSheets, [
    { index: 0, name: "2022", dataStart: 1, rowCount: 2 },
    { index: 1, name: "2023", dataStart: 1, rowCount: 2 },
  ]);
  assert.equal(analysis.rowCount, 4 + 2 + 2, "rowCount totals the siblings");
  assert.deepEqual(analysis.otherDatedSheets, [{ index: 3, name: "Sim", rowCount: 3 }]);

  const totalCol = analysis.declaredTotals.find((d) => d.source === "total-column");
  assert.ok(totalCol, "a total-column figure");
  assert.equal(totalCol.value, 11.1, "2.7 + 2.7 + 5.7 across the three sheets");
  assert.equal(totalCol.label, "Total (3 sheets)");
  const labels = analysis.declaredTotals.map((d) => d.label);
  assert.ok(!labels.includes("Total flights"), `count label kept: ${labels.join(" | ")}`);
  assert.ok(labels.includes("Night"), `stats sheet still scanned: ${labels.join(" | ")}`);
  assert.ok(!labels.some((l) => /Hours|Device/.test(l)), `the Sim sheet is not a totals sheet: ${labels.join(" | ")}`);

  const sib = check(report, "sibling_sheets");
  assert.equal(sib.status, "info");
  assert.equal(sib.actual, 2);
  assert.equal(sib.explanation, "Also importing 2 sheets with the same layout (2022, 2023).");
  assert.equal(sib.messageKey, "sibling_sheets");
  assert.deepEqual(sib.vars, { count: 2, names: "2022, 2023", rows: 4 });
  const other = check(report, "other_sheet:3");
  assert.equal(other.status, "info");
  assert.equal(other.explanation, `Sheet "Sim" has 3 dated rows in a different layout and was not imported.`);
  assert.equal(other.messageKey, "other_dated_sheet");
  assert.deepEqual(other.vars, { sheet: "Sim", rows: 3 });
  // The Total column is compared against apply's own sum of it — whichever sheets apply imported.
  const grand = check(report, "grand_total");
  assert.equal(grand.status, "match", grand.explanation);
  assert.equal(grand.vars?.source, "total-column");
});

test("R3: sibling footers are merged into one declared figure per column; a sibling without a footer drops them", () => {
  const withFooter = (y: number): Raw[][] => [...yearSheet(y), ["Total", null, null, null, 2.7, 0.5, 2.7]];
  const merged = analyzeWorkbook(xlsx([
    { name: "2023", rows: withFooter(2023) },
    { name: "2024", rows: [...yearSheet(2024, [[new Date(2024, 8, 1), "C172", "G-ABCD", "EGLL", 1.0, null, 1.0]]), ["Total", null, null, null, 3.7, 0.5, 3.7]] },
  ]), "years-footers.xlsx");
  assert.equal(merged.sheetName, "2024");
  const footers = merged.declaredTotals.filter((d) => d.source === "footer-row");
  const total = footers.find((d) => d.meaning?.kind === "grand_total");
  assert.ok(total, `merged Total footer (have: ${footers.map((d) => d.label).join(" | ")})`);
  assert.equal(total.value, 6.4, "3.7 + 2.7");
  assert.equal(total.label, "Total › Total (2 sheets)");
  const pic = footers.find((d) => d.meaning?.kind === "time" && d.meaning.role === "pic");
  assert.equal(pic?.value, 6.4);

  const partial = analyzeWorkbook(xlsx([
    { name: "2023", rows: yearSheet(2023) },
    { name: "2024", rows: [...yearSheet(2024, [[new Date(2024, 8, 1), "C172", "G-ABCD", "EGLL", 1.0, null, 1.0]]), ["Total", null, null, null, 3.7, 0.5, 3.7]] },
  ]), "years-partial.xlsx");
  assert.equal(partial.declaredTotals.filter((d) => d.source === "footer-row").length, 0, "a subtotal footer on one sheet only is not a workbook total");
  assert.equal(partial.declaredTotals.find((d) => d.source === "total-column")?.value, 6.4);
});

test("R3: a single-sheet workbook has no sibling / other-sheet checks", () => {
  const { analysis, report } = run("single.xlsx", xlsx([{ name: "Log", rows: LOG_ROWS }]));
  assert.equal(analysis.siblingSheets, undefined);
  assert.equal(analysis.otherDatedSheets, undefined);
  assert.equal(analysis.rowCount, 3);
  assert.ok(!ids(report).some((id) => id === "sibling_sheets" || id.startsWith("other_sheet:")));
});

// ---------------------------------------------------------------------------
// R5 — day-first priors
// ---------------------------------------------------------------------------

test("R5: Fecha + EC- registrations + LE airports → day-first by prior, with an info check", () => {
  const { analysis, applied, report } = run("spanish.csv", csv([
    "Fecha,Matrícula,Tipo,Ruta,Total,Noche",
    "05/03/2024,EC-ABC,C172,LEMD-LEBL,1.5,0.5",
    "06/03/2024,EC-ABC,C172,LEBL-LEMD,1.2,",
  ]));
  assert.equal(analysis.mapping.conventions.dayFirstDates, true);
  assert.equal(analysis.mapping.conventions.dayFirstSource, "prior");
  const ext = analysis as AnalysisExt;
  assert.match(ext.dayFirstReason ?? "", /"Fecha" .*not English/);
  assert.match(ext.dayFirstReason ?? "", /EC-ABC/);
  assert.match(ext.dayFirstReason ?? "", /LEMD/);
  assert.equal(ext.dayFirstExample, "05/03/2024");
  assert.deepEqual(applied.flights.map((f) => f.date), ["2024-03-05", "2024-03-06"], "5 March, not 3 May");
  const c = check(report, "day_first_dates");
  assert.equal(c.status, "info");
  assert.equal(c.messageKey, "day_first_prior");
  assert.match(c.explanation ?? "", /read day-first \(day\/month\/year\) because of the date header "Fecha" is not English/);
  assert.match(c.explanation ?? "", /"05\/03\/2024" was read as 2024-03-05 \(not 2024-05-03\)/);
  assert.equal(c.vars?.dayFirst, "true");
  assert.equal(c.vars?.example, "05/03/2024");
  assert.equal(check(report, "grand_total").status, "match");
});

test("R5: US N-numbers + K airports → month-first by prior", () => {
  const { analysis, applied, report } = run("us.csv", csv([
    "Date,Tail Number,Model,Route,Total,Night",
    "05/03/2024,N12345,C172,KSEA-KPDX,1.5,0.5",
    "06/03/2024,N12345,C172,KPDX-KSEA,1.2,",
  ]));
  assert.equal(analysis.mapping.conventions.dayFirstDates, false);
  assert.equal(analysis.mapping.conventions.dayFirstSource, "prior");
  assert.match((analysis as AnalysisExt).dayFirstReason ?? "", /N12345/);
  assert.match((analysis as AnalysisExt).dayFirstReason ?? "", /KSEA/);
  assert.deepEqual(applied.flights.map((f) => f.date), ["2024-05-03", "2024-06-03"]);
  const c = check(report, "day_first_dates");
  assert.equal(c.messageKey, "day_first_prior");
  assert.match(c.explanation ?? "", /read month-first/);
  assert.equal(c.vars?.dayFirst, "false");
});

test("R5: an explicit format in the header outranks registrations; Datum / Date de vol count as non-English", () => {
  const fmt = run("fmt.csv", csv(["Date (m/d/y),Reg,Type,Total", "05/03/2024,G-ABCD,C172,1.5", "06/03/2024,G-ABCD,C172,1.2"]));
  assert.equal(fmt.analysis.mapping.conventions.dayFirstDates, false, "m/d/y spelled out beats the G- registration");
  assert.equal(fmt.analysis.mapping.conventions.dayFirstSource, "prior");
  const de = run("de.csv", csv(["Datum,Muster,Total", "05/03/2024,C172,1.5", "06/03/2024,C172,1.2"]));
  assert.equal(de.analysis.mapping.conventions.dayFirstDates, true);
  assert.equal(de.analysis.mapping.conventions.dayFirstSource, "prior");
  const fr = run("fr.csv", csv(["Date de vol,Avion,Total", "05/03/2024,C172,1.5", "06/03/2024,C172,1.2"]));
  assert.equal(fr.analysis.mapping.conventions.dayFirstDates, true);
  assert.equal(fr.analysis.mapping.conventions.dayFirstSource, "prior");
});

test("R5: unambiguous values or row order are evidence — no info check", () => {
  const plain = run("uk.csv", csv(["Date,Aircraft,Reg,Total", "15/03/2024,C172,G-ABCD,1.5", "16/03/2024,C172,G-ABCD,1.2"]));
  assert.equal(plain.analysis.mapping.conventions.dayFirstDates, true);
  assert.equal(plain.analysis.mapping.conventions.dayFirstSource, "evidence");
  assert.ok(!ids(plain.report).includes("day_first_dates"));
  // Every value valid both ways, but only day-first keeps the column in order.
  const ordered = run("ordered.csv", csv(["Date,Aircraft,Reg,Total", "05/03/2024,C172,N1,1.5", "06/03/2024,C172,N1,1.2", "07/04/2024,C172,N1,1.1", "01/05/2024,C172,N1,2.0", "02/05/2024,C172,N1,1.0"]));
  assert.equal(ordered.analysis.mapping.conventions.dayFirstDates, true, "row order outranks the N-number prior");
  assert.equal(ordered.analysis.mapping.conventions.dayFirstSource, "evidence");
  assert.ok(!ids(ordered.report).includes("day_first_dates"));
  // ISO dates: nothing to settle.
  const iso = run("iso.csv", csv(LOG_CSV));
  assert.equal(iso.analysis.mapping.conventions.dayFirstDates, undefined);
  assert.equal(iso.analysis.mapping.conventions.dayFirstSource, undefined);
  assert.ok(!ids(iso.report).includes("day_first_dates"));
});

test("R5: no clue at all → the separator default, flagged as such", () => {
  const { analysis, report } = run("default.csv", csv(["Date,Aircraft,Total", "05/03/2024,C172,1.5", "06/03/2024,C172,1.2"]));
  assert.equal(analysis.mapping.conventions.dayFirstDates, false, "\"/\" defaults to month-first");
  assert.equal(analysis.mapping.conventions.dayFirstSource, "default");
  const c = check(report, "day_first_dates");
  assert.equal(c.messageKey, "day_first_default");
  assert.match(c.explanation ?? "", /by default — the file gives no clue either way/);
  // The user's own toggle silences the note.
  const user = reconcile(
    applyMapping(readWorkbook(csv(["Date,Aircraft,Total", "05/03/2024,C172,1.5"]), "u.csv"), analysis, analysis.mapping),
    analysis, { ...analysis.mapping, conventions: { ...analysis.mapping.conventions, dayFirstDates: true, dayFirstSource: "user" } },
  );
  assert.ok(!ids(user).includes("day_first_dates"));
});

// ---------------------------------------------------------------------------
// R13 — the Total column's declared sum covers only the rows apply keeps
// ---------------------------------------------------------------------------

test("R13: an unlabeled SUM footer is not part of the Total column's declared sum (csv + xlsx)", () => {
  const fromCsv = run("unlabeled-footer.csv", csv([...LOG_CSV, ",,,,2.7,4.0,2.5,6.7"]));
  const fromXlsx = run("unlabeled-footer.xlsx", xlsx([{ name: "Log", rows: [...LOG_ROWS, [null, null, null, null, 2.7, 4.0, 2.5, 6.7]] }]));
  for (const { analysis, report } of [fromCsv, fromXlsx]) {
    const totalCol = analysis.declaredTotals.find((d) => d.source === "total-column");
    assert.equal(totalCol?.value, 6.7, `declared Total column sum in ${analysis.filename}`);
    assert.deepEqual((analysis as AnalysisExt).undatedRowTotals, { 4: 6.7 }, "the footer's Total cell is remembered as an undated row");
    const grand = check(report, "grand_total");
    assert.equal(grand.status, "match", `${analysis.filename}: ${grand.explanation}`);
    assert.equal(grand.expected, 6.7);
    assert.equal(grand.actual, 6.7);
    assert.equal(check(report, "skipped:no_date").actual, 1);
    assert.equal(report.ok, true, mismatches(report));
  }
});

test("R13: subtotal rows and undated rows are left out too; date-bearing rows are what counts", () => {
  const { analysis } = run("mid.csv", csv([
    "Date,Aircraft,Reg,Route,PIC,SIC,Night,Total",
    "2019-03-05,C172,G-ABCD,EGLL-EGKK,1.5,,0.5,1.5",
    "Total 2019,,,,1.5,,0.5,1.5",
    ",C172,G-ABCD,EGLL-EGKK,9.9,,,9.9",
    "2020-04-01,PA28,G-BXYZ,EGLL-EGLL,2.0,,,2.0",
    "Grand Total,,,,3.5,,0.5,3.5",
  ]));
  assert.equal(analysis.declaredTotals.find((d) => d.source === "total-column")?.value, 3.5);
  assert.deepEqual((analysis as AnalysisExt).undatedRowTotals, { 3: 9.9 });
  assert.equal(isDateBearing({ kind: "date", value: "2024-03-05" }), true);
  assert.equal(isDateBearing({ kind: "number", value: 45000 }), true, "Excel serial");
  assert.equal(isDateBearing({ kind: "number", value: 1.5 }), false);
  assert.equal(isDateBearing({ kind: "text", value: "Sep 27, 2001" }), true);
  assert.equal(isDateBearing({ kind: "text", value: "Total" }), false);
  assert.equal(isDateBearing({ kind: "empty" }), false);
});

// ---------------------------------------------------------------------------
// R14 — count labels are never totals
// ---------------------------------------------------------------------------

test("R14: labels with count nouns never become a grand total", () => {
  for (const l of ["Total flights", "Total sectors", "Number of aircraft", "Flights per year", "Night flights", "Total legs", "Days flown", "Total entries", "Aircraft types", "Airports visited", "# of flights"]) {
    assert.ok(isCountLabel(l), `"${l}" counts things`);
  }
  for (const l of ["Total Time", "Total flight time", "Flight hours", "Total Time (all types)", "Night", "Total PIC", "Landings", "Total #IFR Approaches", "Sum", "Total Multi-Engine Time (Night)"]) {
    assert.ok(!isCountLabel(l), `"${l}" is not a count`);
  }
  const { analysis, report } = run("totals-unmatched.xlsx", xlsx([
    { name: "Log", rows: LOG_ROWS },
    { name: "Stats", rows: [["Total flights", 3], ["Total sectors", 3], ["Number of aircraft", 2], ["Favourite airport", "EGLL"], ["Longest flight", 4], ["Average per month", 2.2], ["Flights per year", 12], ["Night flights", 2], ["Landings", 3]] },
  ]));
  const sheetLabels = analysis.declaredTotals.filter((d) => d.source === "totals-sheet").map((d) => d.label);
  assert.deepEqual(sheetLabels, ["Landings"], `only the landings line is a comparable figure (have: ${sheetLabels.join(" | ")})`);
  const grand = check(report, "grand_total");
  assert.equal(grand.vars?.source, "total-column", "the grand total falls back to the Total column");
  assert.equal(grand.expected, 6.7);
  assert.equal(grand.status, "match", grand.explanation);
  assert.equal(check(report, "declared:field:landings_day|totals-sheet").status, "match");
  assert.equal(report.ok, true, mismatches(report));
});

// ---------------------------------------------------------------------------
// R17 — simulator rows and the sheet's Total column
// ---------------------------------------------------------------------------

const SIM_CSV = [
  "Date,Aircraft,Reg,Route,PIC,Dual,Night,IFR Approaches,Total",
  "2024-03-01,B787 FFS,,,,4.0,,6,4.0",
  "2024-03-02,A320 FNPT II,,,,2.0,,3,2.0",
  "2024-03-05,B787,G-ZBJA,EGLL-KJFK,8.0,,3.0,1,8.0",
  "2024-03-07,Grumman AA-5,G-BAAA,EGKK,1.0,,,,1.0",
];

test("R17: the Total column carries the sim sessions — they are added back and the check says so", () => {
  const { applied, report } = run("sim-total-column.csv", csv(SIM_CSV));
  assert.deepEqual(applied.flights.map((f) => f.category), ["SIM", "SIM", "ME", "SE"]);
  assert.equal(report.summary.totalHours, 9, "LogbookHQ's flight time still leaves the sims out");
  const grand = check(report, "grand_total");
  assert.equal(grand.status, "match", grand.explanation);
  assert.equal(grand.expected, 15);
  assert.equal(grand.actual, 15);
  assert.match(grand.explanation ?? "", /^Includes 2 sim sessions \(6 h\) logged in the Total column\.$/);
  assert.equal(grand.messageKey, "declared_match");
  assert.equal(grand.vars?.simSessions, 2);
  assert.equal(grand.vars?.simHours, 6);
  assert.equal(report.ok, true, mismatches(report));
});

test("R17: same for a labeled footer; a Totals-sheet line with or without sims is understood either way", () => {
  const footer = run("sim-footer.csv", csv([...SIM_CSV, "Totals,,,,9.0,6.0,3.0,10,15.0"]));
  const g = check(footer.report, "grand_total");
  assert.equal(g.vars?.source, "footer-row");
  assert.equal(g.status, "match", g.explanation);
  assert.equal(g.expected, 15);
  assert.match(g.explanation ?? "", /Includes 2 sim sessions \(6 h\)/);

  const simRows: Raw[][] = [
    ["Date", "Aircraft", "Reg", "Route", "PIC", "Dual", "Night", "IFR Approaches", "Total"],
    [new Date(2024, 2, 1), "B787 FFS", null, null, null, 4.0, null, 6, 4.0],
    [new Date(2024, 2, 5), "B787", "G-ZBJA", "EGLL-KJFK", 8.0, null, 3.0, 1, 8.0],
    [new Date(2024, 2, 7), "Grumman AA-5", "G-BAAA", "EGKK", 1.0, null, null, null, 1.0],
  ];
  const withSims = run("sim-totals-sheet-13.xlsx", xlsx([{ name: "Log", rows: simRows }, { name: "Totals", rows: [["Total Time", 13]] }]));
  const gs = check(withSims.report, "grand_total");
  assert.equal(gs.status, "explained", gs.explanation);
  assert.equal(gs.messageKey, "declared_sim_included");
  assert.match(gs.explanation ?? "", /includes 1 simulator session \(4 h\) — 13 h matches the declared 13 h/);
  assert.equal(gs.actual, 9, "the computed figure stays LogbookHQ's flight time");
  const withoutSims = run("sim-totals-sheet-9.xlsx", xlsx([{ name: "Log", rows: simRows }, { name: "Totals", rows: [["Total Time", 9]] }]));
  assert.equal(check(withoutSims.report, "grand_total").status, "match");
});

// ---------------------------------------------------------------------------
// R18 — tolerance floor + off rows
// ---------------------------------------------------------------------------

test("R18: the 1 h floor shrinks to 2 % for small totals; the 0.1 % term still covers big ones", () => {
  const small = [2.5, 2.5, 2.5]; // 7.5 h
  assert.equal(grandTotalCheck(small, 7.6).status, "match", "≤ 0.15 h");
  const c7 = grandTotalCheck(small, 7.7);
  assert.equal(c7.status, "mismatch", `0.2 h on 7.7 h is beyond min(1 h, 2 %) = 0.15 h: ${c7.explanation}`);
  assert.equal(c7.messageKey, "declared_mismatch");
  const c85 = grandTotalCheck(small, 8.5);
  assert.equal(c85.status, "mismatch", `1 h on 8.5 h is not rounding: ${c85.explanation}`);
  assert.equal(c85.suggestion?.kind, "review_mapping");
  const hundred = Array<number>(100).fill(1);
  assert.equal(grandTotalCheck(hundred, 100.9).status, "explained", "0.9 h on 100 h ≤ min(1 h, 2 h)");
  assert.equal(grandTotalCheck(hundred, 101.5).status, "mismatch", "1.5 h on 100 h > 1 h");
  const big = [...Array<number>(424).fill(10), 2.7]; // 4,242.7 h
  const c3 = grandTotalCheck(big, 4239.7);
  assert.equal(c3.status, "explained", `3 h on 4,240 h = 0.07 %: ${c3.explanation}`);
  assert.equal(c3.messageKey, "declared_small_gap");
  assert.equal(grandTotalCheck(big, 4237).status, "mismatch", "5.7 h > 0.1 %");
});

test("R18: rows off against their own Total cell suppress the AUG explanation and are named instead", () => {
  const rows: Raw[][] = [
    HEADER,
    [new Date(2024, 4, 20), "C172", "G-ABCD", "EGLL-EGKK", 2.0, null, null, 2.0],
    [new Date(2024, 4, 21), "C172", "G-ABCD", "EGKK-EGLL", 1.0, null, null, 1.0],
    [new Date(2024, 4, 22), "B738", "G-XLEA", "EGLL-EHAM", null, 4.0, 2.0, 4.0],
    [new Date(2024, 4, 23), "C172", "G-ABCD", "EGLL-EGKK", 3.0, null, null, 1.0], // 3.0 logged, Total says 1.0
  ];
  // Full 10 h, SIC-halved 8 h — the Totals sheet says 8, which the AUG rule would otherwise "explain".
  const { report } = run("off-rows.xlsx", xlsx([{ name: "Log", rows }, { name: "Totals", rows: [["Total Time", 8]] }]));
  const rt = check(report, "row_totals");
  assert.equal(rt.actual, 1);
  assert.equal(rt.status, "mismatch");
  assert.equal(rt.messageKey, "row_totals_off");
  assert.match(rt.explanation ?? "", /1 of 4 rows have a Total cell that differs .* \(2024-05-23\)\./);
  assert.equal(rt.vars?.dates, "2024-05-23");
  const grand = check(report, "grand_total");
  assert.equal(grand.status, "mismatch", grand.explanation);
  assert.equal(grand.messageKey, "declared_off_rows");
  assert.equal(grand.suggestion?.kind, "review_mapping", "no aug_half_credit suggestion");
  assert.match(grand.explanation ?? "", /^Computed 10 h vs\. declared 8 h \(difference 2 h\)\. 1 row differs from their own Total cell: 2024-05-23 — fix those rows first\.$/);
  assert.equal(grand.vars?.offRows, 1);
  assert.equal(grand.vars?.offDates, "2024-05-23");

  // Control: with the row fixed the AUG explanation is back.
  rows[4][7] = 3.0;
  const fixed = run("off-rows-fixed.xlsx", xlsx([{ name: "Log", rows }, { name: "Totals", rows: [["Total Time", 8]] }]));
  assert.equal(check(fixed.report, "row_totals").actual, 0);
  const g2 = check(fixed.report, "grand_total");
  assert.equal(g2.status, "explained", g2.explanation);
  assert.equal(g2.messageKey, "declared_aug_half");
  assert.equal(g2.suggestion?.kind, "aug_half_credit");
});

// ---------------------------------------------------------------------------
// R29 — declared figures in minutes
// ---------------------------------------------------------------------------

test("R29: \"(min)\" / \"minutes\" labels are divided by 60; an unlabeled 60× figure is called out", () => {
  for (const l of ["Total time (min)", "Night (minutes)", "PIC mins", "Total (Min.)", "Flugzeit Minuten"]) assert.ok(isMinutesLabel(l), `"${l}" is in minutes`);
  for (const l of ["Total Time", "Minimum", "Admin", "Night"]) assert.ok(!isMinutesLabel(l), `"${l}" is not in minutes`);

  const { report } = run("totals-minutes.xlsx", xlsx([
    { name: "Log", rows: LOG_ROWS },
    { name: "Totals", rows: [["Total time (min)", 402], ["Night (minutes)", 150], ["PIC", 162]] },
  ]));
  const grand = check(report, "grand_total");
  assert.equal(grand.status, "match", grand.explanation);
  assert.equal(grand.expected, 6.7);
  assert.equal(grand.explanation, "Declared as 402 min.");
  const night = check(report, "declared:time:any:night:any|totals-sheet");
  assert.equal(night.status, "match", night.explanation);
  assert.equal(night.expected, 2.5);
  const pic = check(report, "declared:time:any:any:pic|totals-sheet");
  assert.equal(pic.status, "explained", pic.explanation);
  assert.equal(pic.messageKey, "declared_minutes");
  assert.match(pic.explanation ?? "", /looks like minutes: 162 min = 2\.7 h, which matches the computed 2\.7 h/);
  assert.equal(report.ok, true, mismatches(report));

  const footer = run("footer-minutes.xlsx", xlsx([{ name: "Log", rows: [...LOG_ROWS, ["Total", null, null, null, 162, 240, 150, 402]] }]));
  const fg = check(footer.report, "grand_total");
  assert.equal(fg.status, "explained", fg.explanation);
  assert.equal(fg.messageKey, "declared_minutes");
  assert.equal(fg.expected, 402);
  assert.equal(check(footer.report, "declared:time:any:any:sic|footer-row").messageKey, "declared_minutes");
  assert.equal(footer.report.ok, true, mismatches(footer.report));
});

// ---------------------------------------------------------------------------
// R30 — skipped undated rows explain a footer gap
// ---------------------------------------------------------------------------

test("R30: undated rows the sheet's SUM counts but apply skips account for the whole gap", () => {
  const rows: Raw[][] = [
    HEADER,
    [new Date(2024, 2, 5), "C172", "G-ABCD", "EGLL-EGKK", 1.5, null, 0.5, 1.5],
    [null, "C172", "G-ABCD", "EGLL-EGKK", 1.2, null, null, 1.2],
    [new Date(2024, 2, 6), "C172", "G-ABCD", "EGKK-EGLL", 1.2, null, null, 1.2],
    [null, "C172", "G-ABCD", "EGKK-EGLL", 1.1, null, null, 1.1],
    [new Date(2024, 2, 7), "B738", "G-XLEA", "EGLL-EHAM", null, 4.0, 2.0, 4.0],
    ["Total", null, null, null, 5.0, 4.0, 2.5, 9.0],
  ];
  const { analysis, applied, report } = run("undated-rows.xlsx", xlsx([{ name: "Log", rows }]));
  assert.deepEqual((analysis as AnalysisExt).undatedRowTotals, { 2: 1.2, 4: 1.1 });
  assert.equal(analysis.declaredTotals.find((d) => d.source === "total-column")?.value, 6.7, "the Total column sum skips the undated rows");
  assert.deepEqual(applied.skipped.filter((s) => s.reason === "no_date").map((s) => s.row), [2, 4]);
  const grand = check(report, "grand_total");
  assert.equal(grand.vars?.source, "footer-row");
  assert.equal(grand.expected, 9);
  assert.equal(grand.actual, 6.7);
  assert.equal(grand.status, "explained", grand.explanation);
  assert.equal(grand.messageKey, "declared_skipped_rows");
  assert.equal(grand.explanation, "The 2 skipped rows (no date) carry 2.3 h in the Total column — that is the whole difference.");
  assert.deepEqual([grand.vars?.skippedRows, grand.vars?.skippedSum], [2, 2.3]);
  assert.equal(grand.suggestion?.kind, "none");
  assert.equal(report.ok, true, mismatches(report));
});

// ---------------------------------------------------------------------------
// R33 — unrecognised columns reach the arbiter / review list
// ---------------------------------------------------------------------------

test("R33: an ignored column with an unrecognised header and data is low-confidence; an empty one is not", () => {
  const { analysis } = run("uk-blorf.csv", csv([
    "Date,Dept,Arr,Type,Reg,Blorf,IFR Appr,Remarks,Foo",
    "05/03/2024,EGLL,EGKK,C172,G-ABCD,1.5,2,ILS practice,",
    "06/03/2024,EGKK,EGLL,C172,G-ABCD,1.2,,circuits,",
  ]));
  const col = (label: string) => {
    const p = analysis.header.paths.find((x) => x.label === label);
    assert.ok(p, `no column "${label}"`);
    return p.col;
  };
  const blorf = analysis.mapping.columns.find((c) => c.col === col("Blorf"));
  assert.equal(blorf?.target.kind, "ignore", "precondition: Blorf is not in the vocabulary");
  assert.ok((blorf?.confidence ?? 1) <= 0.3);
  assert.ok(analysis.lowConfidenceCols.includes(col("Blorf")), `Blorf column flagged (have: ${analysis.lowConfidenceCols.join(", ")})`);
  assert.ok(!analysis.lowConfidenceCols.includes(col("Foo")), "an empty unrecognised column is not worth asking about");
  assert.ok(!analysis.lowConfidenceCols.includes(col("Dept")), "a recognised departure column is not unrecognised");
});

// ---------------------------------------------------------------------------
// R10 — instrument time vs. flight time
// ---------------------------------------------------------------------------

test("R10: instrument (actual + hood) above flight time is clamped by apply and reported as info; unclamped rows are a mismatch", () => {
  const over = run("actual-plus-hood.csv", csv([
    "Date,Type,Reg,P1,Actual IMC,Hood,Total",
    "2024-03-05,B738,G-XLEA,1.5,1.2,0.8,1.5",
    "2024-03-06,B738,G-XLEA,2.0,0.5,,2.0",
  ]));
  assert.equal(over.applied.instrumentClamped, 1, "apply clamps the over-instrument row");
  const c = check(over.report, "instrument_gt_flight");
  assert.equal(c.status, "info");
  assert.equal(c.messageKey, "instrument_clamped");
  assert.equal(c.explanation, "1 row had instrument time above flight time; clamped to the flight time.");

  const clean = run("clean.csv", csv(LOG_CSV));
  assert.equal(check(clean.report, "instrument_gt_flight").status, "match");
  assert.equal(check(clean.report, "instrument_gt_flight").messageKey, "instrument_ok");

  // Flights that reach reconcile unclamped (e.g. hand-built) are a real mismatch.
  const unclamped = reconcile(
    { ...clean.applied, flights: clean.applied.flights.map((f, i) => (i === 0 ? { ...f, actual_inst: 2.0 } : f)) },
    clean.analysis, clean.analysis.mapping,
  );
  const u = check(unclamped, "instrument_gt_flight");
  assert.equal(u.status, "mismatch");
  assert.equal(u.actual, 1);
  assert.equal(u.messageKey, "instrument_gt_flight");
  assert.match(u.explanation ?? "", /1 row logs? more instrument time .* \(2024-03-05\)/);

  const clamped = reconcile({ ...clean.applied, instrumentClamped: 2 }, clean.analysis, clean.analysis.mapping);
  const cc = check(clamped, "instrument_gt_flight");
  assert.equal(cc.status, "info");
  assert.equal(cc.messageKey, "instrument_clamped");
  assert.equal(cc.explanation, "2 rows had instrument time above flight time; clamped to the flight time.");
});

// ---------------------------------------------------------------------------
// Message keys + the apply-reported checks (R2 / R11 / R15 / R31)
// ---------------------------------------------------------------------------

test("message keys: every check carries messageKey + vars; apply-reported conditions become checks", () => {
  const base = run("keys.csv", csv(SIM_CSV));
  const noKey = base.report.checks.filter((c) => typeof c.messageKey !== "string" || !c.messageKey || typeof c.vars !== "object" || c.vars === null);
  assert.equal(noKey.length, 0, `checks without messageKey/vars: ${noKey.map((c) => c.id).join(", ")}`);
  for (const c of base.report.checks) assert.match(c.messageKey ?? "", /^[a-z0-9_]+$/, `${c.id}: "${c.messageKey}" is not snake_case`);

  const result: ApplyResult = {
    ...base.applied,
    unknownRoles: [{ text: "PUT", count: 2 }, { text: "Copiloto", count: 1 }],
    cumulativeTotal: true,
    negativeHours: 3,
  };
  const analysis: Analysis = { ...base.analysis, header: { ...base.analysis.header, dateRowsAbove: 2 } };
  const report = reconcile(result, analysis, analysis.mapping);
  const noKey2 = report.checks.filter((c) => typeof c.messageKey !== "string" || typeof c.vars !== "object");
  assert.equal(noKey2.length, 0, `checks without messageKey/vars: ${noKey2.map((c) => c.id).join(", ")}`);

  const roles = check(report, "unknown_roles");
  assert.equal(roles.status, "info");
  assert.equal(roles.explanation, "3 rows with unrecognised role text (PUT, Copiloto) were imported as PIC — review the Role column.");
  assert.deepEqual(roles.vars, { count: 3, samples: "PUT, Copiloto" });

  const cumulative = check(report, "cumulative_total");
  assert.equal(cumulative.status, "explained");
  assert.equal(cumulative.explanation, "The Total column looks cumulative (running total) and was not used for row hours.");
  assert.equal(check(report, "grand_total").messageKey, "grand_total_none", "a running-total column is not a declared total");
  assert.ok(!ids(report).includes("row_totals"), "row totals mean nothing against a running total");
  assert.ok(!ids(report).includes("night_gt_total"));

  const negative = check(report, "negative_hours");
  assert.equal(negative.status, "info");
  assert.equal(negative.explanation, "3 cells with negative hours were treated as 0.");

  const above = check(report, "date_rows_above_header");
  assert.equal(above.status, "mismatch");
  assert.equal(above.explanation, "2 dated rows above the detected header were not imported — the header may have been detected too far down.");
  assert.deepEqual(above.vars, { count: 2 });
  assert.equal(report.ok, false);

  // Declared checks keep the sheet's label but still carry a key per outcome.
  const aug = run("aug.xlsx", xlsx([{ name: "Log", rows: LOG_ROWS }, { name: "Totals", rows: [["Total Time", 4.7], ["Night", 2.5], ["PIC", 2.7]] }]));
  assert.equal(check(aug.report, "grand_total").messageKey, "declared_aug_half");
  assert.equal(check(aug.report, "declared:time:any:night:any|totals-sheet").messageKey, "declared_match");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exitCode = 1;
}
