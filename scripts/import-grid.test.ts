/**
 * Grid-typing tests for the import pipeline (lib/import/grid.ts + util.ts).
 *
 *   npm run test:import        (runs after scripts/import-fixtures.test.ts)
 *
 * Pure and offline: workbooks are built in memory with SheetJS, no fixtures,
 * no network, no database. Every case prints PASS/FAIL with a reason; the
 * process exits 1 on any FAIL.
 *
 * Background: SheetJS with `cellDates` turns a duration-formatted cell
 * (serial 0.0625 shown as "1:30") into a Date on the Excel epoch, 1899-12-30
 * 01:30 local. Before the fix that Date was rejected as an out-of-range
 * calendar date, every hours cell became EMPTY, each row was skipped
 * `no_time`, and the empty "PIC" hours column was mapped as a crew name.
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { analyzeWorkbook, applyMapping, readWorkbook, targetKey, type Analysis, type Cell } from "../lib/import";
import { gridFromValues, isTimeFormat, workbookFromSheetJS } from "../lib/import/grid";
import { excelDurationHours, excelEpochFraction } from "../lib/import/util";

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

type AoaCell = string | number | Date | XLSX.CellObject | null;

/** Serial fraction of a day formatted as a duration — what Excel stores for "1:30". */
function durationSerial(hours: number, z = "h:mm"): XLSX.CellObject {
  return { t: "n", v: hours / 24, z };
}

/** A duration as SheetJS materialises it after `cellDates`: epoch day + local time-of-day. */
function epochDate(hours: number): Date {
  const mins = Math.round(hours * 60);
  return new Date(1899, 11, 30, Math.floor(mins / 60), mins % 60);
}

const HEADER: AoaCell[] = ["Date", "Aircraft", "Registration", "PIC", "Night", "Remarks"];

/** Three flights; `pic(h)` builds the hours cells (serial or Date variant). */
function logbookRows(pic: (hours: number) => AoaCell): AoaCell[][] {
  return [
    HEADER,
    [new Date(2024, 2, 5), "C172", "C-GABC", pic(1.5), null, "Circuits"],
    [new Date(2024, 2, 6), "C172", "C-GABC", pic(2), pic(0.5), "Night circuits"],
    [new Date(2024, 2, 7), "PA28", "C-FXYZ", pic(1.5), null, "Local"],
  ];
}

/** Sheet → xlsx bytes → back through the real reader, as an upload would be. */
function roundTrip(rows: AoaCell[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Log");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}

function run(bytes: Uint8Array, name: string) {
  const analysis = analyzeWorkbook(bytes, name);
  const workbook = readWorkbook(bytes, name);
  const applied = applyMapping(workbook, analysis, analysis.mapping);
  return { analysis, workbook, applied };
}

function colByLabel(a: Analysis, label: string): number {
  const p = a.header.paths.find((x) => x.label === label);
  assert.ok(p, `no column labelled "${label}" (have: ${a.header.paths.map((x) => x.label).join(", ")})`);
  return p.col;
}

function assignmentOf(a: Analysis, label: string) {
  const col = colByLabel(a, label);
  const c = a.mapping.columns.find((x) => x.col === col);
  assert.ok(c, `column "${label}" has no assignment`);
  return c;
}

const hoursCell = (value: number, raw: string): Cell => ({ kind: "number", value, raw });

/** The assertions both round-trip variants must satisfy. */
function expectDurationLogbook(bytes: Uint8Array, name: string): void {
  const { analysis, workbook, applied } = run(bytes, name);

  // Cells are typed as hours with the "h:mm" text, not as dates or EMPTY.
  const grid = workbook.sheets[0];
  assert.deepEqual(grid.rows[1][3], hoursCell(1.5, "1:30"), "row 1 PIC cell");
  assert.deepEqual(grid.rows[2][3], hoursCell(2, "2:00"), "row 2 PIC cell");
  assert.deepEqual(grid.rows[2][4], hoursCell(0.5, "0:30"), "row 2 Night cell");
  assert.deepEqual(grid.rows[1][0], { kind: "date", value: "2024-03-05" }, "genuine dates still read as dates");

  // The hours column maps to a time target, not to the PIC crew-name field.
  const pic = assignmentOf(analysis, "PIC");
  assert.equal(pic.target.kind, "time", `PIC column mapped to ${targetKey(pic.target)}`);
  assert.notEqual(targetKey(pic.target), "field:pic");
  if (pic.target.kind === "time") assert.equal(pic.target.role, "pic");
  const night = assignmentOf(analysis, "Night");
  assert.equal(night.target.kind, "time", `Night column mapped to ${targetKey(night.target)}`);
  assert.equal(analysis.mapping.conventions.clockTimes, true, "h:mm cells count as clock-time evidence");

  // Every row imports; none is skipped for lack of time. (apply rounds flight times to 0.1.)
  assert.deepEqual(applied.skipped, [], `skipped: ${JSON.stringify(applied.skipped)}`);
  assert.equal(applied.flights.length, 3);
  assert.deepEqual(applied.flights.map((f) => f.day_time), [1.5, 1.5, 1.5]);
  assert.deepEqual(applied.flights.map((f) => f.night_time), [0, 0.5, 0]);
  assert.deepEqual(applied.flights.map((f) => f.date), ["2024-03-05", "2024-03-06", "2024-03-07"]);
}

// ---------------------------------------------------------------------------
// Unit: epoch fraction + duration formatting
// ---------------------------------------------------------------------------

test("excelEpochFraction: epoch day + time-of-day → fraction; other dates → null", () => {
  assert.equal(excelEpochFraction(new Date(1899, 11, 30, 1, 30)), 0.0625);
  assert.equal(excelEpochFraction(new Date(1899, 11, 30, 0, 0)), 0);
  assert.equal(excelEpochFraction(new Date(1899, 11, 30, 8, 30)), 8.5 / 24);
  assert.equal(excelEpochFraction(new Date(2024, 2, 5)), null);
  assert.equal(excelEpochFraction(new Date(2024, 2, 5, 1, 30)), null);
  // Serial ≥ 1 (an [h]:mm value of a day or more) is not a sub-day duration.
  assert.equal(excelEpochFraction(new Date(1899, 11, 31, 1, 30)), null);
  assert.equal(excelEpochFraction(new Date(NaN)), null);
});

test("excelDurationHours: hours to 0.01 with Excel's h:mm text", () => {
  assert.deepEqual(excelDurationHours(0.0625), { hours: 1.5, raw: "1:30" });
  assert.deepEqual(excelDurationHours(0.75 / 24), { hours: 0.75, raw: "0:45" });
  assert.deepEqual(excelDurationHours(20 / 1440), { hours: 0.33, raw: "0:20" });
  assert.deepEqual(excelDurationHours(0), { hours: 0, raw: "0:00" });
  // Float artefacts (1:29:59.999) settle on the minute.
  assert.deepEqual(excelDurationHours(0.0625 - 1e-9), { hours: 1.5, raw: "1:30" });
  // Seconds fold into the value; the text stays h:mm.
  assert.deepEqual(excelDurationHours((1 * 3600 + 30 * 60 + 36) / 86400), { hours: 1.51, raw: "1:31" });
});

test("isTimeFormat: duration/clock formats yes, date and plain formats no", () => {
  for (const z of ["h:mm", "hh:mm", "hh:mm:ss", "[h]:mm", "[hh]:mm:ss", "h:mm AM/PM", "[hh]:mm;@", "[Red]h:mm", '[$-409]h:mm', 'h"h"mm"m"']) {
    assert.equal(isTimeFormat(z), true, `expected "${z}" to be a time format`);
  }
  for (const z of ["m/d/yy", "yyyy-mm-dd", "m/d/yy h:mm", "dd-mmm-yy", "0.00", "General", "#,##0", "@", "mm:ss"]) {
    assert.equal(isTimeFormat(z), false, `expected "${z}" not to be a time format`);
  }
});

// ---------------------------------------------------------------------------
// Grid typing (no file round trip)
// ---------------------------------------------------------------------------

test("gridFromValues: an epoch Date becomes an hours cell, a real Date stays a date", () => {
  const grid = gridFromValues("t", [[new Date(1899, 11, 30, 1, 30), new Date(2024, 2, 5), new Date(1899, 11, 30, 0, 0)]]);
  assert.deepEqual(grid.rows[0][0], hoursCell(1.5, "1:30"));
  assert.deepEqual(grid.rows[0][1], { kind: "date", value: "2024-03-05" });
  assert.deepEqual(grid.rows[0][2], hoursCell(0, "0:00"));
});

test("workbookFromSheetJS: raw serials with a time format are durations (in-memory sheet, no cellDates conversion)", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Day", "Off", "Plain", "Date"],
    [durationSerial(1.5), durationSerial(8.5, "[h]:mm"), 0.0625, new Date(2024, 2, 5)],
    [durationSerial(0.75, "hh:mm:ss"), { t: "n", v: 1.0625, z: "[h]:mm" }, 1.5, new Date(2024, 2, 6)],
  ], { cellDates: true });
  assert.deepEqual(ws["A2"], { t: "n", v: 0.0625, z: "h:mm" }, "precondition: the sheet still holds the raw serial");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Log");
  const grid = workbookFromSheetJS(wb, "mem.xlsx").sheets[0];
  assert.deepEqual(grid.rows[1][0], hoursCell(1.5, "1:30"));
  assert.deepEqual(grid.rows[1][1], hoursCell(8.5, "8:30"), "[h]:mm clock value");
  assert.deepEqual(grid.rows[1][2], { kind: "number", value: 0.0625 }, "an unformatted 0.0625 is still just a number");
  assert.deepEqual(grid.rows[1][3], { kind: "date", value: "2024-03-05" });
  assert.deepEqual(grid.rows[2][0], hoursCell(0.75, "0:45"));
  assert.deepEqual(grid.rows[2][1], { kind: "number", value: 1.0625 }, "a serial of a day or more is left as a number");
  assert.deepEqual(grid.rows[2][2], { kind: "number", value: 1.5 });
});

// ---------------------------------------------------------------------------
// Full pipeline through xlsx bytes
// ---------------------------------------------------------------------------

test("xlsx round trip: { t: 'n', v: 0.0625, z: 'h:mm' } cells import as 1.5 h and map to a time target", () => {
  expectDurationLogbook(roundTrip(logbookRows((h) => durationSerial(h))), "durations-serial.xlsx");
});

test("xlsx round trip: Date(1899, 11, 30, 1, 30) cells import as 1.5 h and map to a time target", () => {
  expectDurationLogbook(roundTrip(logbookRows((h) => epochDate(h))), "durations-date.xlsx");
});

test("xlsx round trip: [h]:mm elapsed format behaves the same", () => {
  expectDurationLogbook(roundTrip(logbookRows((h) => durationSerial(h, "[h]:mm"))), "durations-elapsed.xlsx");
});

test("xlsx round trip: decimal hours are untouched by the duration rule", () => {
  const { workbook, applied } = run(roundTrip(logbookRows((h) => h)), "decimals.xlsx");
  assert.deepEqual(workbook.sheets[0].rows[1][3], { kind: "number", value: 1.5 });
  assert.deepEqual(applied.skipped, []);
  assert.deepEqual(applied.flights.map((f) => f.day_time), [1.5, 1.5, 1.5]);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
