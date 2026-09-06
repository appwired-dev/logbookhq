/**
 * Fixture tests for the import pipeline (lib/import/*).
 *
 *   npm run test:import        (= npx tsx scripts/import-fixtures.test.ts)
 *
 * Pure and offline: reads tests/fixtures/import/*, no network, no database.
 * Every case prints PASS/FAIL with a reason; the process exits 1 on any FAIL.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import {
  analyzeWorkbook, applyMapping, arbitrateWithClaude, readWorkbook, reconcile, fingerprint, detectHeaderBand, mapColumns,
  CANONICAL_OPTIONS, targetKey, parseTargetKey,
  type Analysis, type ApplyResult, type FieldTarget, type ReconcileReport,
} from "../lib/import";
import { FIELDS } from "../lib/import/targets";
import { sourceRowGroups } from "../lib/import/apply";
import { sha1Hex } from "../lib/import/util";
import { classifyDeclaredLabel, classifyTotalLabel, isRecencyLabel, namesAllCategories } from "../lib/import/analyze";
import { detectFormat, parseAnyLogbook } from "../lib/import-formats";
import type { ParsedFlight } from "../lib/csv";

/** Header fingerprint of the founder's real Numbers → Excel export (the system template must match it). */
const REAL_NUMBERS_FINGERPRINT = "3bf044c69251d97414d2790abb41ccb1ea9da737";
const NUMBERS_TEMPLATE_NAME = "Apple Numbers logbook (3-row header)";

const FIXTURES = path.resolve(__dirname, "../tests/fixtures/import");

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

const results: { name: string; ok: boolean; reason: string }[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
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

function load(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
}

function loadText(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8");
}

function labelOf(a: Analysis, col: number): string {
  return a.header.paths.find((p) => p.col === col)?.label ?? "";
}

function keyOf(a: Analysis, col: number): string {
  const c = a.mapping.columns.find((x) => x.col === col);
  return c ? targetKey(c.target) : "(unmapped)";
}

function colByLabel(a: Analysis, label: string): number {
  const p = a.header.paths.find((x) => x.label === label);
  assert.ok(p, `no column labelled "${label}" (have: ${a.header.paths.map((x) => x.label).filter(Boolean).join(", ")})`);
  return p.col;
}

/** Assert targetKey per column index; reports every miss at once. */
function expectKeys(a: Analysis, expected: Record<number, string>): void {
  const bad: string[] = [];
  for (const [col, key] of Object.entries(expected)) {
    const got = keyOf(a, Number(col));
    if (got !== key) bad.push(`col ${col} "${labelOf(a, Number(col))}": expected ${key}, got ${got}`);
  }
  assert.equal(bad.length, 0, bad.join("\n"));
}

/** Same, addressed by header label (single-row headers). */
function expectKeysByLabel(a: Analysis, expected: Record<string, string>): void {
  const byIndex: Record<number, string> = {};
  for (const [label, key] of Object.entries(expected)) byIndex[colByLabel(a, label)] = key;
  expectKeys(a, byIndex);
}

function run(name: string, bytes: Uint8Array = load(name)) {
  const analysis = analyzeWorkbook(bytes, name);
  const workbook = readWorkbook(bytes, name);
  const applied = applyMapping(workbook, analysis, analysis.mapping);
  return { bytes, analysis, workbook, applied };
}

function check(report: ReconcileReport, id: string) {
  const c = report.checks.find((x) => x.id === id);
  assert.ok(c, `no reconcile check "${id}" (have: ${report.checks.map((x) => x.id).join(", ")})`);
  return c;
}

function sameRows(pipeline: ParsedFlight[], legacy: ParsedFlight[], fields: (keyof ParsedFlight)[]): void {
  assert.equal(pipeline.length, legacy.length, `row count: pipeline ${pipeline.length} vs legacy ${legacy.length}`);
  const bad: string[] = [];
  legacy.forEach((lf, i) => {
    const nf = pipeline[i];
    for (const k of fields) {
      if (JSON.stringify(nf[k]) !== JSON.stringify(lf[k])) {
        bad.push(`row ${i + 1} (${lf.date}) ${k}: pipeline=${JSON.stringify(nf[k])} legacy=${JSON.stringify(lf[k])}`);
      }
    }
  });
  assert.equal(bad.length, 0, bad.join("\n"));
}

const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 10) / 10;

type Raw = string | number | null;

/** The numbers-multihead fixture as typed rows (numeric strings → numbers), the way an xlsx export would carry them. */
function fixtureRows(): Raw[][] {
  return loadText("numbers-multihead.csv").split(/\r?\n/).filter((l) => l.length > 0).map((line) =>
    line.split(",").map((cell) => (cell === "" ? null : /^-?\d+(\.\d+)?$/.test(cell) ? Number(cell) : cell)),
  );
}

/** Build a two-sheet workbook (flight rows + a "Totals" sheet of label/value pairs) in memory. */
function buildXlsx(logbook: Raw[][], totals: Raw[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logbook), "Logbook");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totals), "Totals");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Single-sheet workbook of flight rows (no Totals sheet). */
function buildLogbook(logbook: Raw[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logbook), "Logbook");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

function rowByDate(rows: Raw[][], date: string): Raw[] {
  const row = rows.find((r) => r[0] === date);
  assert.ok(row, `no fixture row dated ${date}`);
  return row;
}

/** A reconcile run over synthetic flights (all SE › PIC, day hours as given) against one declared grand total. */
function grandTotalCheck(hours: number[], declared: number) {
  const { analysis, applied } = run("numbers-multihead.csv");
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
// 1. numbers-multihead.csv — the founder's Apple Numbers layout
// ---------------------------------------------------------------------------

const SE = "Single Engine Aircraft", ME = "Multi-Engine Aircraft", XC = "Cross Country";

/** Derived from the fixture's three header rows and parseNumbersMultihead's column map. */
const NUMBERS_KEYS: Record<number, string> = {
  0: "field:date", 1: "field:make_model", 2: "field:registration", 3: "field:pic", 4: "field:copilot",
  5: "field:route", 6: "field:remarks",
  7: "time:se:day:dual", 8: "time:se:day:pic", 9: "time:se:night:dual", 10: "time:se:night:pic",
  11: "time:me:day:dual", 12: "time:me:day:pic", 13: "time:me:day:fo", 14: "time:me:day:sic",
  15: "time:me:night:dual", 16: "time:me:night:pic", 17: "time:me:night:fo", 18: "time:me:night:sic",
  19: "field:xc_time", 20: "field:xc_time", 21: "field:xc_time", 22: "field:xc_time", 23: "field:xc_time", 24: "field:xc_time",
  25: "field:actual_inst", 26: "field:hood_inst", 27: "field:sim_inst", 28: "field:ifr_approaches",
  29: "field:total_time",
};

async function numbersMultihead(): Promise<void> {
  const name = "numbers-multihead.csv";
  const { analysis: a, applied } = run(name);

  await test("numbers-multihead: 3-row header band with qualified paths (as the real Numbers export writes them)", () => {
    assert.deepEqual(a.header.rows, [1, 2, 3], `header rows ${JSON.stringify(a.header.rows)}`);
    assert.equal(a.header.dataStart, 4);
    assert.equal(labelOf(a, 0), "Date (d/m/y)");
    assert.equal(labelOf(a, 1), "Aircraft › Make/Model", "the Aircraft group spans Make/Model …");
    assert.equal(labelOf(a, 2), "Aircraft", "… and a sub-header-less registration column");
    assert.equal(labelOf(a, 3), "Pilot in Command");
    assert.equal(labelOf(a, 7), `${SE} › Day › Dual`);
    assert.equal(labelOf(a, 10), `${SE} › Night › PIC`);
    assert.equal(labelOf(a, 14), `${ME} › Day › AUG.`);
    assert.equal(labelOf(a, 17), `${ME} › Night › FO`);
    assert.equal(labelOf(a, 24), `${XC} › Night › AUG.`);
    assert.equal(labelOf(a, 26), "Instrument › Hood");
    assert.equal(labelOf(a, 28), "Instrument › #IFR Appchs");
    assert.equal(labelOf(a, 29), "Total", "Total stands alone in the top header row");
  });

  await test("numbers-multihead: fingerprint matches the system Numbers template (and the founder's real export)", () => {
    assert.equal(a.fingerprint, REAL_NUMBERS_FINGERPRINT);
    assert.equal(a.templateName, NUMBERS_TEMPLATE_NAME);
    assert.equal(a.templateId, "system:numbers-multihead");
    const notTemplate = a.mapping.columns.filter((c) => c.source !== "template").map((c) => `col ${c.col} ${c.source}`);
    assert.equal(notTemplate.length, 0, `columns not filled from the template: ${notTemplate.join(", ")}`);
  });

  await test("numbers-multihead: every column maps to the legacy parser's bucket", () => {
    expectKeys(a, NUMBERS_KEYS);
    assert.equal(a.mapping.columns.length, 30);
    const weak = a.mapping.columns.filter((c) => c.confidence < 0.6).map((c) => `col ${c.col} ${c.confidence}`);
    assert.equal(weak.length, 0, `low-confidence columns: ${weak.join(", ")}`);
    assert.deepEqual(a.lowConfidenceCols, []);
    assert.equal(a.mapping.conventions.blankAircraftIsSim, true, "blank aircraft + sim time rows are sims");
  });

  await test("numbers-multihead: the synonym mapper alone (no template) reaches the same buckets", () => {
    const grid = readWorkbook(load(name), name).sheets[0];
    const header = detectHeaderBand(grid);
    const mapping = mapColumns(header, grid, header.dataStart, {});
    const bad: string[] = [];
    for (const [col, key] of Object.entries(NUMBERS_KEYS)) {
      const c = mapping.columns.find((x) => x.col === Number(col));
      const got = c ? targetKey(c.target) : "(unmapped)";
      if (got !== key) bad.push(`col ${col} "${labelOf(a, Number(col))}": expected ${key}, got ${got}`);
      if (c && c.confidence < 0.6) bad.push(`col ${col} confidence ${c.confidence}`);
      if (c && c.source === "template") bad.push(`col ${col} came from a template`);
    }
    assert.equal(bad.length, 0, bad.join("\n"));
  });

  await test("numbers-multihead: applyMapping reproduces parseNumbersMultihead row for row", () => {
    const legacy = parseAnyLogbook(loadText(name));
    assert.equal(legacy.format, "numbers-multihead", `detectFormat picked ${legacy.format}`);
    assert.equal(legacy.flights.length, 14);
    sameRows(applied.flights, legacy.flights, [
      "date", "make_model", "registration", "pic", "copilot", "route", "remarks", "category", "role",
      "day_time", "night_time", "is_xcountry", "actual_inst", "hood_inst", "sim_inst", "ifr_approaches",
      "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
    ]);
    assert.deepEqual(applied.skipped.map((s) => s.reason), ["header_or_total_row"], "only the Totals footer is skipped");
    const sim = applied.flights.find((f) => f.date === "2016-03-03");
    assert.ok(sim && sim.category === "SIM" && sim.make_model === "SIM" && sim.sim_inst === 4 && sim.ifr_approaches === 4, "blank-aircraft PPC row is a SIM › DUAL session");
  });

  await test("numbers-multihead: footer total at 50 % AUG credit → explained + aug_half_credit", () => {
    const report = reconcile(applied, a, a.mapping);
    const grand = check(report, "grand_total");
    assert.equal(grand.expected, 38, "footer declares 38 h");
    assert.equal(grand.actual, 45.5, "full-credit sum is 45.5 h");
    assert.equal(grand.status, "explained", grand.explanation);
    assert.equal(grand.suggestion?.kind, "aug_half_credit");
    // With the account setting on, the same file is a plain match.
    const withAug = reconcile(applied, a, a.mapping, { augHalfCredit: true });
    assert.equal(check(withAug, "grand_total").status, "match");
    assert.equal(check(withAug, "grand_total").actual, 38);
  });

  await test("numbers-multihead: per-column footers reconcile (XC split over six columns is summed)", () => {
    const report = reconcile(applied, a, a.mapping);
    assert.equal(check(report, "declared:time:me:day:pic|footer-row").status, "match");
    assert.equal(check(report, "declared:time:me:night:sic|footer-row").status, "match");
    assert.equal(check(report, "declared:field:actual_inst|footer-row").status, "match");
    assert.equal(check(report, "declared:field:ifr_approaches|footer-row").status, "match");
    const xc = check(report, "declared:field:xc_time|footer-row");
    assert.equal(xc.expected, 39.2, "3 + 12.6 + 5 + 7.6 + 1 + 10 across the six Cross Country footer cells");
    assert.equal(xc.status, "match", xc.explanation);
    const mismatches = report.checks.filter((c) => c.status === "mismatch").map((c) => c.id);
    assert.equal(report.ok, true, `hard mismatches: ${mismatches.join(", ")}`);
  });

  await test("numbers-multihead: summary carries raw and credited hours; invariants carry no fake declared values", () => {
    const plain = reconcile(applied, a, a.mapping);
    assert.equal(plain.summary.totalHours, 45.5);
    assert.equal(plain.summary.creditedHours, 45.5, "no 50 % setting → credited equals raw");
    const withAug = reconcile(applied, a, a.mapping, { augHalfCredit: true });
    assert.equal(withAug.summary.totalHours, 45.5, "totalHours stays the raw day+night sum");
    assert.equal(withAug.summary.creditedHours, 38, "SIC/AUG at 50 %");
    assert.equal(withAug.summary.byRole.SIC, 7.5);
    for (const id of ["hours_gt_24", "future_dates", "night_gt_total", "row_totals"]) {
      const c = check(plain, id);
      assert.equal(c.expected, undefined, `${id} should not carry an expected value`);
      assert.equal(c.delta, undefined, `${id} should not carry a delta`);
      assert.equal(c.status, "match", `${id}: ${c.explanation}`);
    }
    assert.match(check(plain, "night_gt_total").explanation ?? "", /^[\d,.]+ night h ≤ [\d,.]+ total h$/);
    assert.equal(check(plain, "night_gt_total").actual, 19.7, "1.1 + 0.6 + 6 + 4 + 7 + 1 night hours");
  });

  await test("numbers-multihead: full-credit footer total → match", () => {
    const lines = loadText(name).split(/\r?\n/);
    const i = lines.findIndex((l) => l.startsWith("Totals,"));
    assert.ok(i >= 0 && lines[i].endsWith(",38"), "fixture footer ends with the 50 % total");
    lines[i] = lines[i].replace(/,38$/, ",45.5");
    const variant = run("numbers-multihead-full.csv", new TextEncoder().encode(lines.join("\n")));
    const report = reconcile(variant.applied, variant.analysis, variant.analysis.mapping);
    const grand = check(report, "grand_total");
    assert.equal(grand.expected, 45.5);
    assert.equal(grand.status, "match", grand.explanation);
    assert.equal(grand.suggestion, undefined);
    // …and with the 50 % setting on, it is the mirror-image explanation.
    const withAug = reconcile(variant.applied, variant.analysis, variant.analysis.mapping, { augHalfCredit: true });
    assert.equal(check(withAug, "grand_total").status, "explained");
    assert.equal(check(withAug, "grand_total").suggestion?.kind, "none");
  });
}

// ---------------------------------------------------------------------------
// 2. foreflight.csv
// ---------------------------------------------------------------------------

async function foreflight(): Promise<void> {
  const name = "foreflight.csv";
  const { analysis: a, applied } = run(name);

  await test("foreflight: legacy format detected and every column mapped", () => {
    assert.equal(detectFormat(loadText(name)), "foreflight");
    assert.equal(a.legacyFormat, "foreflight");
    assert.deepEqual(a.header.rows, [8], "header is the Flights Table row");
    expectKeysByLabel(a, {
      Date: "field:date", AircraftID: "field:registration", From: "field:from", To: "field:to", Route: "field:route",
      TimeOut: "field:block_off", TimeIn: "field:block_on", TotalTime: "field:total_time",
      PIC: "time:any:any:pic", SIC: "time:any:any:sic", Night: "time:any:night:any", Solo: "time:any:any:solo",
      DualReceived: "time:any:any:dual", CrossCountry: "field:xc_time",
      ActualInstrument: "field:actual_inst", SimulatedInstrument: "field:hood_inst",
      Holds: "field:holds", Approach1: "field:ifr_approaches",
      DayTakeoffs: "field:takeoffs_day", DayLandingsFullStop: "field:landings_day",
      NightTakeoffs: "field:takeoffs_night", NightLandingsFullStop: "field:landings_night",
      PilotComments: "field:remarks",
    });
    assert.deepEqual(a.lowConfidenceCols, []);
  });

  await test("foreflight: fingerprint is identical across two separate reads", () => {
    const b = analyzeWorkbook(load(name), name);
    assert.match(a.fingerprint, /^[0-9a-f]{40}$/);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.fingerprint, fingerprint(a.header.paths.map((p) => p.path)));
  });

  await test("foreflight: applied rows agree with the legacy ForeFlight parser", () => {
    const legacy = parseAnyLogbook(loadText(name));
    assert.equal(legacy.format, "foreflight");
    // hood/sim differ by design: the legacy parser files SimulatedInstrument
    // under sim_inst, the pipeline under hood_inst (it is hood time).
    sameRows(applied.flights, legacy.flights, [
      "date", "make_model", "registration", "route", "remarks", "category", "role",
      "day_time", "night_time", "is_xcountry", "actual_inst", "ifr_approaches",
      "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
    ]);
    assert.deepEqual(applied.flights.map((f) => f.make_model), ["C172", "DH8C", "C172", "DH8C", "C172", "DH8C"], "types resolved via the Aircraft Table");
    const hood = applied.flights.find((f) => f.date === "2024-05-20");
    assert.ok(hood && hood.hood_inst === 0.5 && hood.holds === 0, "SimulatedInstrument lands in hood_inst");
    const ils = applied.flights.find((f) => f.date === "2024-05-15");
    assert.ok(ils && ils.ifr_approaches === 1 && ils.holds === 1, "text approach cell counts as one approach; Holds mapped");
  });
}

// ---------------------------------------------------------------------------
// 3. korean.csv
// ---------------------------------------------------------------------------

async function korean(): Promise<void> {
  const name = "korean.csv";
  const { analysis: a, workbook, applied } = run(name);

  await test("korean: every non-empty column is mapped with confidence ≥ 0.6", () => {
    const grid = workbook.sheets[a.sheetIndex];
    const bad: string[] = [];
    for (const c of a.mapping.columns) {
      const nonEmpty = grid.rows.slice(a.header.dataStart).some((r) => r[c.col] && r[c.col].kind !== "empty");
      if (!nonEmpty) continue;
      if (c.target.kind === "ignore" || c.confidence < 0.6) bad.push(`col ${c.col} "${labelOf(a, c.col)}" → ${targetKey(c.target)} @ ${c.confidence}`);
    }
    assert.equal(bad.length, 0, bad.join("\n"));
    expectKeysByLabel(a, {
      "날짜": "field:date", "기종": "field:make_model", "등록번호": "field:registration", "출발": "field:from", "도착": "field:to",
      "기장": "time:any:any:pic", "주간": "time:any:day:any", "야간": "time:any:night:any",
      "단발": "time:se:any:any", "다발": "time:me:any:any", "야외비행": "field:xc_time",
      "계기": "field:actual_inst", "착륙": "field:landings_day", "비고": "field:remarks",
    });
  });

  await test("korean: 2024년 3월 5일 dates and 1:30 clock hours parse", () => {
    assert.equal(a.mapping.conventions.clockTimes, true, "clock-time hours detected");
    assert.equal(applied.flights.length, 5);
    assert.deepEqual(applied.skipped, []);
    const [f0, , f2, f3, f4] = applied.flights;
    assert.equal(f0.date, "2024-03-05");
    assert.equal(f0.day_time, 1.5, "주간 1:30 → 1.5 h");
    assert.equal(f0.night_time, 0);
    assert.equal(f0.landings_day, 2);
    assert.ok(f0.category === "SE" && f0.role === "PIC", `${f0.category}/${f0.role}`);
    assert.ok(f2.day_time === 0 && f2.night_time === 1, "야간 1:00 → 1 h night");
    assert.ok(f3.category === "ME" && f3.actual_inst === 0.5, "다발 1:30 → ME, 계기 0:30 → 0.5 h");
    assert.ok(f4.day_time === 2.5 && f4.is_xcountry && f4.actual_inst === 1, "2:30 day, 야외비행 set, 1:00 instrument");
  });

  await test("korean: decimal-comma hours (\"1,5\") parse to 1.5", () => {
    const csv = "날짜;기종;등록번호;주간;야간\n2024년 3월 5일;C172;HL1234;1,5;0,5\n2024년 3월 6일;C172;HL1234;2,0;\n";
    const v = run("korean-comma.csv", new TextEncoder().encode(csv));
    assert.equal(v.analysis.mapping.conventions.decimalComma, true);
    assert.deepEqual(v.workbook.sheets[0].rows[1][3], { kind: "number", value: 1.5, raw: "1,5" }, "\"1,5\" typed as 1.5");
    assert.equal(v.applied.flights.length, 2);
    // Explicit 주간 (day) and 야간 (night) cells: 1,5 day + 0,5 night.
    assert.equal(v.applied.flights[0].day_time, 1.5);
    assert.equal(v.applied.flights[0].night_time, 0.5);
    assert.equal(v.applied.flights[1].day_time, 2);
    assert.equal(v.applied.flights[1].night_time, 0);
  });
}

// ---------------------------------------------------------------------------
// 4. messy.xlsx — blank leading column, 2-row header, dd/mm dates, Total footer, Totals sheet
// ---------------------------------------------------------------------------

async function messy(): Promise<void> {
  const name = "messy.xlsx";
  const { analysis: a, applied } = run(name);

  await test("messy.xlsx: day-first dates, 2-row header, blank column ignored", () => {
    assert.equal(a.sheetName, "Flights", "flight sheet picked over the Totals sheet");
    assert.equal(a.mapping.conventions.dayFirstDates, true);
    assert.deepEqual(a.header.rows, [0, 1]);
    expectKeys(a, { 0: "ignore" });
    expectKeysByLabel(a, {
      Date: "field:date", Aircraft: "field:make_model", Reg: "field:registration", Route: "field:route",
      "Single Engine › Dual": "time:se:any:dual", "Single Engine › PIC": "time:se:any:pic",
      "Multi Engine › PIC": "time:me:any:pic", "Multi Engine › SIC": "time:me:any:sic",
      Night: "time:any:night:any", XC: "field:xc_time", Total: "field:total_time", Remarks: "field:remarks",
    });
  });

  await test("messy.xlsx: Total footer skipped; day/night sums match hand-computed 7.1 / 1.5", () => {
    assert.deepEqual(applied.skipped, [{ row: 6, reason: "header_or_total_row" }]);
    assert.deepEqual(applied.flights.map((f) => f.date), ["2024-09-27", "2024-09-28", "2024-10-03", "2024-10-15"], "27/09/2024 read day-first");
    // Rows: 1.5 dual (0.5 night) → 1.0/0.5; 1.2 PIC → 1.2/0; 1.8 ME PIC → 1.8/0; 4.1 ME SIC (1.0 night) → 3.1/1.0
    assert.deepEqual(applied.flights.map((f) => f.day_time), [1, 1.2, 1.8, 3.1]);
    assert.deepEqual(applied.flights.map((f) => f.night_time), [0.5, 0, 0, 1]);
    assert.equal(sum(applied.flights.map((f) => f.day_time)), 7.1);
    assert.equal(sum(applied.flights.map((f) => f.night_time)), 1.5);
    assert.deepEqual(applied.flights.map((f) => `${f.category}/${f.role}`), ["SE/DUAL", "SE/PIC", "ME/PIC", "ME/SIC"]);
  });

  await test("messy.xlsx: Totals sheet + footer reconcile", () => {
    const report = reconcile(applied, a, a.mapping);
    const grand = check(report, "grand_total");
    assert.equal(grand.expected, 8.6);
    assert.equal(grand.status, "match", grand.explanation);
    assert.match(grand.label, /Total Time/, "grand total taken from the Totals sheet");
    assert.equal(check(report, "declared:time:any:night:any|totals-sheet").status, "match");
    assert.equal(check(report, "declared:field:xc_time|totals-sheet").status, "match");
    assert.equal(check(report, "declared:field:landings_day|totals-sheet").status, "match");
    assert.equal(check(report, "declared:time:me:any:sic|footer-row").status, "match");
    assert.equal(report.ok, true, report.checks.filter((c) => c.status === "mismatch").map((c) => c.id).join(", "));
  });
}

// ---------------------------------------------------------------------------
// 5. fingerprint
// ---------------------------------------------------------------------------

async function fingerprints(): Promise<void> {
  await test("fingerprint: case / whitespace / punctuation insensitive, order + content sensitive", () => {
    assert.equal(fingerprint([["Date"], ["Make/Model"]]), fingerprint([[" date "], ["make model"]]));
    assert.equal(fingerprint([["Date"], ["Make/Model"]]), fingerprint([["DATE"], ["Make  /  Model"]]));
    assert.notEqual(fingerprint([["Date"], ["Make/Model"]]), fingerprint([["Date"], ["Registration"]]));
    assert.notEqual(fingerprint([["Date"], ["Make/Model"]]), fingerprint([["Make/Model"], ["Date"]]));
    // Blank columns and empty segments do not count.
    assert.equal(fingerprint([[], ["Date"], ["", "Reg"]]), fingerprint([["Date"], ["Reg"]]));
    assert.match(fingerprint([["Date"]]), /^[0-9a-f]{40}$/);
  });

  await test("fingerprint: pure-TS SHA-1 agrees with node:crypto", () => {
    const samples = [
      "", "abc", "date | make model | reg",
      "The quick brown fox jumps over the lazy dog. ".repeat(4),           // multi-block
      "날짜 | 기종 | 등록번호 | 출발 | 도착 | single engine aircraft > day > dual", // multibyte
      "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(119),        // padding boundaries
    ];
    for (const s of samples) {
      assert.equal(sha1Hex(s), createHash("sha1").update(s, "utf8").digest("hex"), `sha1 of ${JSON.stringify(s.slice(0, 30))}…`);
    }
  });
}

// ---------------------------------------------------------------------------
// 6. arbiter without an API key
// ---------------------------------------------------------------------------

async function arbiter(): Promise<void> {
  await test("arbitrateWithClaude: no ANTHROPIC_API_KEY → mapping returned unchanged, no network", async () => {
    const { analysis } = run("korean.csv");
    // Pretend some columns are uncertain so the only reason to bail is the missing key.
    const a: Analysis = { ...analysis, lowConfidenceCols: [5, 11] };
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const savedFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error("network call attempted"); }) as unknown as typeof fetch;
    try {
      const before = JSON.stringify(a.mapping);
      const mapping = await arbitrateWithClaude(a);
      assert.deepEqual(mapping, a.mapping);
      assert.equal(JSON.stringify(mapping), before, "mapping not mutated");
      assert.equal(calls, 0, "fetch was called");
      const explicit = await arbitrateWithClaude(a, { onlyCols: [5] });
      assert.deepEqual(explicit, a.mapping);
    } finally {
      globalThis.fetch = savedFetch;
      if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });
}

// ---------------------------------------------------------------------------
// 7. CANONICAL_OPTIONS / targetKey round-trip
// ---------------------------------------------------------------------------

/** Compile-time exhaustive list of FieldTarget — adding a field without listing it here fails tsc. */
const ALL_FIELDS: Record<FieldTarget, true> = {
  date: true, make_model: true, registration: true, pic: true, copilot: true, third_pilot: true, check_pilot: true,
  route: true, from: true, to: true, remarks: true, category: true, role: true, xc_time: true, xc_flag: true,
  actual_inst: true, hood_inst: true, sim_inst: true,
  ifr_approaches: true, precision_approaches: true, non_precision_approaches: true, holds: true, cfi_time: true,
  takeoffs_day: true, takeoffs_night: true, landings_day: true, landings_night: true,
  total_time: true, block_off: true, block_on: true,
};

async function targets(): Promise<void> {
  await test("CANONICAL_OPTIONS contains every FieldTarget exactly once", () => {
    const options = CANONICAL_OPTIONS.flatMap((g) => g.options);
    const keys = new Set(options.map((o) => o.key));
    assert.equal(keys.size, options.length, "duplicate option keys");
    const fields = Object.keys(ALL_FIELDS) as FieldTarget[];
    const missing = fields.filter((f) => !keys.has(`field:${f}`));
    assert.equal(missing.length, 0, `missing from CANONICAL_OPTIONS: ${missing.join(", ")}`);
    assert.deepEqual([...FIELDS].sort(), [...fields].sort(), "targets.ts FIELDS drifted from the FieldTarget union");
    assert.ok(keys.has("ignore"));
    assert.ok(keys.has("time:any:any:any") && keys.has("time:me:night:fo") && keys.has("time:sim:any:any"));
  });

  await test("parseTargetKey(targetKey(t)) round-trips for every option", () => {
    const bad: string[] = [];
    for (const o of CANONICAL_OPTIONS.flatMap((g) => g.options)) {
      const key = targetKey(o.target);
      if (key !== o.key) bad.push(`${o.key}: targetKey gives ${key}`);
      const back = parseTargetKey(key);
      if (JSON.stringify(back) !== JSON.stringify(o.target)) bad.push(`${o.key}: parseTargetKey gives ${JSON.stringify(back)}`);
    }
    assert.equal(bad.length, 0, bad.join("\n"));
    assert.deepEqual(parseTargetKey("field:nope"), { kind: "ignore" });
    assert.deepEqual(parseTargetKey("time:me:dusk:pic"), { kind: "ignore" });
    assert.deepEqual(parseTargetKey(""), { kind: "ignore" });
  });
}

// ---------------------------------------------------------------------------
// 8. Declared totals: classification + reconcile tiers
// ---------------------------------------------------------------------------

/** Totals sheet in the founder's style, with values that agree with the fixture's columns. */
const FIXTURE_TOTALS: Raw[][] = [
  ["Total Times", null],
  ["Total Multi-Engine Augment (Night) =", 5],        // 10 h of night AUG at 50 %
  ["Sum", 38],
  ["Total X-Country Dual (Day) =", 3],                // the sheet's own mislabel of the Day › FO column
  ["Total X-Country PIC (Day) =", 12.6],
  ["Total X-Country Augment (Day) =", 5],
  ["Total X-Country (Day) =", 20.6],
  ["Total X-Country Co-Pilot (Night) =", 7.6],
  ["Total X-Country (Night) =", 18.6],
  ["Total X-Country Time =", 39.2],
  ["Last 365 Days", 100],
  ["Last 90 Days", 12.3],
  ["Total Actual Instrument =", 4.9],
  ["Total Instrument Time =", 8.9],                   // 4.9 actual + 0 hood + 4 sim
  ["Total Time (Multi & Single) =", 38],
  ["Total Time PIC (Multi & Single) =", 14.1],
];

async function declaredTotals(): Promise<void> {
  await test("declared totals: recency windows are not totals", () => {
    for (const l of ["Last 365 Days", "Past 90 days", "Previous 12 months", "Rolling 12 Months", "90-day", "Within 30 days", "12 months (last)",
      "최근 90일", "지난 12개월", "最近90天", "últimos 90 días", "Últimas 24 horas", "letzte 90 Tage", "derniers 90 jours", "YTD hours", "This year"]) {
      assert.ok(isRecencyLabel(l), `"${l}" should be a recency window`);
    }
    for (const l of ["Total Time", "Total Multi-Engine Time (Night)", "Total to date", "Night", "Total X-Country PIC (Day) =", "Day", "합계", "Total #IFR Approaches"]) {
      assert.ok(!isRecencyLabel(l), `"${l}" is a total, not a recency window`);
    }
  });

  await test("declared totals: labels naming both engine classes carry no category", () => {
    for (const l of ["Total Time (Multi & Single) =", "Single & Multi", "Multi/Single", "SE + ME PIC", "single and multi engine", "All types", "all aircraft"]) {
      assert.ok(namesAllCategories(l), `"${l}" spans every category`);
    }
    for (const l of ["Total Multi-Engine Time", "Single Engine Sea", "Total Time", "ME Night PIC"]) {
      assert.ok(!namesAllCategories(l), `"${l}" names one category (or none)`);
    }
    assert.deepEqual(classifyTotalLabel("Total Time (Multi & Single) ="), { kind: "grand_total" });
    assert.deepEqual(classifyTotalLabel("Total Time PIC (Multi & Single) ="), { kind: "time", category: "any", condition: "any", role: "pic" });
    assert.deepEqual(classifyTotalLabel("Total Time PIC"), { kind: "time", category: "any", condition: "any", role: "pic" });
    assert.deepEqual(classifyTotalLabel("Total Multi-Engine Time ="), { kind: "time", category: "me", condition: "any", role: "any" });
    assert.deepEqual(classifyTotalLabel("Total Multi-Engine Augment (Night) ="), { kind: "time", category: "me", condition: "night", role: "sic" });
    assert.deepEqual(classifyTotalLabel("Sum"), { kind: "grand_total" });
  });

  await test("declared totals: a bare \"Instrument\" total is actual + hood + sim", () => {
    assert.deepEqual(classifyDeclaredLabel("Total Instrument Time ="), {
      meaning: { kind: "field", field: "actual_inst" }, composite: ["actual_inst", "hood_inst", "sim_inst"],
    });
    assert.deepEqual(classifyDeclaredLabel("Total Actual Instrument ="), { meaning: { kind: "field", field: "actual_inst" } });
    assert.deepEqual(classifyDeclaredLabel("Total Hood Instrument ="), { meaning: { kind: "field", field: "hood_inst" } });
    assert.deepEqual(classifyDeclaredLabel("Total Sim ="), { meaning: { kind: "field", field: "sim_inst" } });
  });

  await test("reconcile: tiered tolerance — ≤ 0.15 h match, ≤ max(1 h, 0.1 %) explained, beyond that mismatch", () => {
    const big = [...Array<number>(424).fill(10), 2.7]; // 4,242.7 h
    const c07 = grandTotalCheck(big, 4242.04);
    assert.equal(c07.delta, 0.7);
    assert.equal(c07.status, "explained", c07.explanation);
    assert.equal(c07.suggestion?.kind, "none");
    assert.match(c07.explanation ?? "", /^Differs by 0\.7 h on 4,242 h\./);
    assert.match(c07.explanation ?? "", /not a mapping problem/);
    const c3 = grandTotalCheck(big, 4239.7); // 3 h on 4,240 h = 0.07 %
    assert.equal(c3.status, "explained", c3.explanation);
    const c5 = grandTotalCheck(big, 4237); // 5.7 h > 0.1 %
    assert.equal(c5.status, "mismatch", c5.explanation);
    assert.equal(c5.suggestion?.kind, "review_mapping");
    const small = Array<number>(45).fill(1); // 45 h
    assert.equal(grandTotalCheck(small, 45.1).status, "match");
    assert.equal(grandTotalCheck(small, 44.5).status, "explained");
    assert.equal(grandTotalCheck(small, 43.5).status, "mismatch");
  });

  // ---- end-to-end on an xlsx with a Totals sheet in the founder's style ----
  const bytes = buildXlsx(fixtureRows(), FIXTURE_TOTALS);
  const { analysis: a, applied } = run("numbers-multihead-totals.xlsx", bytes);
  const plain = reconcile(applied, a, a.mapping);
  const withAug = reconcile(applied, a, a.mapping, { augHalfCredit: true });

  await test("xlsx totals sheet: recency lines dropped, grand total taken from the strongest label", () => {
    assert.equal(a.sheetName, "Logbook");
    assert.equal(a.templateName, NUMBERS_TEMPLATE_NAME, "same header paths → same template");
    assert.equal(applied.flights.length, 14);
    const labels = a.declaredTotals.map((d) => d.label);
    assert.ok(!labels.some((l) => /last \d+ days/i.test(l)), `recency windows leaked into declared totals: ${labels.join(" | ")}`);
    assert.ok(labels.includes("Total X-Country PIC (Day)"), "trailing \"=\" stripped from labels");
    const grand = check(plain, "grand_total");
    assert.equal(grand.label, 'Total time (declared: "Total Time (Multi & Single)")', "preferred over \"Sum\", the footer and the Total column");
    assert.equal(grand.expected, 38);
    assert.equal(grand.status, "explained", grand.explanation);
    assert.equal(grand.suggestion?.kind, "aug_half_credit");
    assert.equal(check(withAug, "grand_total").status, "match");
    assert.equal(check(withAug, "grand_total").actual, 38);
  });

  await test("xlsx totals sheet: \"Total Time PIC (Multi & Single)\" is the PIC total, AUG line follows the 50 % convention", () => {
    const pic = check(plain, "declared:time:any:any:pic|totals-sheet");
    assert.equal(pic.actual, 14.1);
    assert.equal(pic.status, "match", pic.explanation);
    const augNight = check(plain, "declared:time:me:night:sic|totals-sheet");
    assert.equal(augNight.actual, 10);
    assert.equal(augNight.status, "explained", augNight.explanation);
    assert.equal(augNight.suggestion?.kind, "aug_half_credit");
    assert.equal(check(withAug, "declared:time:me:night:sic|totals-sheet").status, "match");
    assert.equal(check(withAug, "declared:time:me:night:sic|totals-sheet").actual, 5);
  });

  await test("xlsx totals sheet: instrument composite compared against actual + hood + sim", () => {
    const inst = check(plain, "declared:composite:actual_inst+hood_inst+sim_inst|totals-sheet");
    assert.equal(inst.label, "Instrument time (actual + hood + sim)");
    assert.equal(inst.expected, 8.9);
    assert.equal(inst.actual, 8.9);
    assert.equal(inst.status, "match", inst.explanation);
    const actual = check(plain, "declared:field:actual_inst|totals-sheet");
    assert.equal(actual.actual, 4.9, "the plain actual-instrument line is a separate check");
    assert.equal(actual.status, "match");
    assert.ok(!plain.checks.some((c) => c.id === "grand_total" && /Instrument/.test(c.label)), "the composite is never the grand total");
  });

  await test("xlsx totals sheet: X-Country lines compared per facet-matching column", () => {
    const byId = (id: string) => check(plain, id);
    const dayPic = byId("declared:field:xc_time|totals-sheet|any:day:pic");
    assert.equal(dayPic.actual, 12.6, "Cross Country › Day › PIC column");
    assert.equal(dayPic.status, "match", dayPic.explanation);
    const dayAug = byId("declared:field:xc_time|totals-sheet|any:day:sic");
    assert.equal(dayAug.actual, 5);
    assert.equal(dayAug.status, "match", dayAug.explanation);
    const day = byId("declared:field:xc_time|totals-sheet|any:day:any");
    assert.equal(day.actual, 20.6, "Day › FO + PIC + AUG");
    assert.equal(day.status, "match", day.explanation);
    const nightFo = byId("declared:field:xc_time|totals-sheet|any:night:fo");
    assert.equal(nightFo.actual, 7.6, "Co-Pilot → FO column");
    assert.equal(nightFo.status, "match", nightFo.explanation);
    const night = byId("declared:field:xc_time|totals-sheet|any:night:any");
    assert.equal(night.actual, 18.6);
    assert.equal(night.status, "match", night.explanation);
    const all = byId("declared:field:xc_time|totals-sheet");
    assert.equal(all.actual, 39.2, "all six columns");
    assert.equal(all.status, "match", all.explanation);
    const dual = byId("declared:field:xc_time|totals-sheet|any:day:dual");
    assert.equal(dual.status, "info", "no Dual cross-country column exists → not compared");
    assert.equal(dual.expected, undefined);
    assert.match(dual.explanation ?? "", /No single column in the file corresponds to this line/);
    assert.equal(plain.ok, true, plain.checks.filter((c) => c.status === "mismatch").map((c) => c.id).join(", "));
    // Unaffected by the 50 % setting: cross-country is never credited at 50 %.
    assert.equal(check(withAug, "declared:field:xc_time|totals-sheet|any:day:sic").status, "match");
    assert.equal(check(withAug, "declared:field:xc_time|totals-sheet").actual, 39.2);
  });

  await test("xlsx: a number stored as text explains a short SUM; halved AUG row totals are recognised", () => {
    const rows = fixtureRows();
    const aug1 = rowByDate(rows, "14-Feb-16"), aug2 = rowByDate(rows, "20-Feb-16");
    aug1[21] = "5";          // Cross Country › Day › AUG. stored as text → the sheet's SUM skips it
    aug1[29] = 5.5; aug2[29] = 2; // row Total cells at 50 % for the AUG rows
    const totals = FIXTURE_TOTALS.map((r) => [...r]);
    const set = (label: string, v: number) => { const row = totals.find((r) => r[0] === label); assert.ok(row); row[1] = v; };
    set("Total X-Country Augment (Day) =", 0);
    set("Total X-Country (Day) =", 15.6);
    set("Total X-Country Time =", 34.2);
    const v = run("numbers-multihead-text.xlsx", buildXlsx(rows, totals));
    assert.deepEqual(v.analysis.textNumberCells, { 21: { count: 1, sum: 5 } });
    assert.equal(v.applied.flights.find((f) => f.date === "2016-02-14")?.is_xcountry, true, "the text cell still counts as cross-country time");
    const report = reconcile(v.applied, v.analysis, v.analysis.mapping);
    for (const id of ["declared:field:xc_time|totals-sheet|any:day:sic", "declared:field:xc_time|totals-sheet|any:day:any", "declared:field:xc_time|totals-sheet"]) {
      const c = check(report, id);
      assert.equal(c.delta, 5, `${id} delta`);
      assert.equal(c.status, "explained", `${id}: ${c.explanation}`);
      assert.equal(c.suggestion?.kind, "none");
      assert.match(c.explanation ?? "", /1 cell stored as text \(5 h\) in "Cross Country › Day › AUG\."/);
    }
    const rt = check(report, "row_totals");
    assert.equal(rt.status, "match", rt.explanation);
    assert.equal(rt.actual, 0);
    assert.match(rt.explanation ?? "", /^2 AUG rows carry a Total cell at 50 %/);
    assert.equal(report.ok, true, report.checks.filter((c) => c.status === "mismatch").map((c) => c.id).join(", "));
    // The CSV fixture is all text, so nothing is flagged there.
    assert.equal(a.textNumberCells, undefined);
  });
}

// ---------------------------------------------------------------------------
// 9. Rows split across (category, role) buckets, dataStart guard, partial cross-country
// ---------------------------------------------------------------------------

/** Numbers layout column indices used below (see NUMBERS_KEYS). */
const COL = { seDayDual: 7, seDayPic: 8, meDayFo: 13, meDayAug: 14, xcDayFo: 19, xcDayPic: 20, xcDayAug: 21, actual: 25, ifr: 28, total: 29 } as const;

async function splitRows(): Promise<void> {
  const baseline = run("numbers-multihead-baseline.xlsx", buildLogbook(fixtureRows()));
  const dataStart = baseline.analysis.header.dataStart;

  await test("split rows: SE PIC 1.0 + SE Dual 1.0 on one row → two flights, 2.0 h, instrument and counts on the first only", () => {
    const rows = fixtureRows();
    const row = rowByDate(rows, "06-Jun-13"); // 1.2 h SE Day Dual in the fixture
    row[COL.seDayDual] = 1; row[COL.seDayPic] = 1; row[COL.actual] = 0.5; row[COL.ifr] = 1; row[COL.total] = 2;
    const v = run("numbers-multihead-split-se.xlsx", buildLogbook(rows));
    assert.equal(v.applied.flights.length, 15, "one extra flight");
    const [dual, pic] = v.applied.flights;
    assert.equal(`${dual.category}/${dual.role}`, "SE/DUAL", "tie → legacy DUAL › PIC order picks DUAL first");
    assert.equal(`${pic.category}/${pic.role}`, "SE/PIC");
    assert.deepEqual([dual.day_time, dual.night_time, pic.day_time, pic.night_time], [1, 0, 1, 0]);
    assert.equal(sum([dual.day_time, pic.day_time]), 2, "no hours lost");
    for (const k of ["date", "make_model", "registration", "pic", "copilot", "route", "remarks", "is_xcountry"] as const) {
      assert.deepEqual(pic[k], dual[k], `${k} shared by both halves`);
    }
    assert.equal(dual.is_xcountry, false);
    assert.ok(dual.actual_inst === 0.5 && dual.ifr_approaches === 1, "instrument + approaches on the primary bucket");
    assert.ok(pic.actual_inst === 0 && pic.ifr_approaches === 0, "…and never double-counted");
    assert.deepEqual([dual.takeoffs_day, dual.landings_day, pic.takeoffs_day, pic.landings_day], [1, 1, 0, 0], "one takeoff/landing for the row, on the primary");
    // Bookkeeping stays per SOURCE row.
    assert.deepEqual(v.applied.splitRows, [{ row: dataStart, buckets: 2 }]);
    assert.deepEqual(v.applied.skipped.map((s) => s.reason), ["header_or_total_row"]);
    assert.equal(v.applied.rowTotals?.length, 14, "one Total entry per source row, not per flight");
    assert.equal(v.applied.rowTotals?.[0], 2);
    assert.equal(v.applied.sourceRows?.length, 14);
    assert.equal(v.applied.sourceRows?.[0], dataStart);
    const groups = sourceRowGroups(v.applied);
    assert.deepEqual(groups[0], { row: dataStart, total: 2, flights: [0, 1] });
    assert.deepEqual(groups[1], { row: dataStart + 1, total: 1, flights: [2] });
    assert.equal(groups.length, 14);
    assert.deepEqual(v.applied.flights.slice(2), baseline.applied.flights.slice(1), "every other row is untouched");
    const report = reconcile(v.applied, v.analysis, v.analysis.mapping);
    const rt = check(report, "row_totals");
    assert.equal(rt.status, "match", rt.explanation);
    assert.equal(rt.actual, 0, "the row's Total (2.0) is compared with the SUM of its two flights");
    assert.equal(check(report, "split_rows").actual, 1);
    assert.equal(report.summary.totalHours, 46.3, "45.5 − 1.2 + 2.0");
  });

  await test("split rows: founder-style ME Day FO 3.0 + AUG 2.0 with Total 5.0 → FO + SIC flights, split info check, row total vs. their sum", () => {
    const rows = fixtureRows();
    const row = rowByDate(rows, "06-Jan-15"); // 1.1 h ME Day FO, 0.4 actual, 1 approach in the fixture
    row[COL.meDayFo] = 3; row[COL.meDayAug] = 2; row[COL.xcDayFo] = 3; row[COL.xcDayAug] = 2; row[COL.total] = 5;
    const v = run("numbers-multihead-split-me.xlsx", buildLogbook(rows));
    assert.equal(v.applied.flights.length, 15);
    const fo = v.applied.flights[8], aug = v.applied.flights[9];
    assert.ok(fo.date === "2015-01-06" && aug.date === "2015-01-06", `${fo.date} / ${aug.date}`);
    assert.equal(`${fo.category}/${fo.role}/${fo.day_time}/${fo.night_time}`, "ME/FO/3/0");
    assert.equal(`${aug.category}/${aug.role}/${aug.day_time}/${aug.night_time}`, "ME/SIC/2/0");
    assert.ok(fo.is_xcountry && aug.is_xcountry, "cross-country row → both flights cross-country");
    assert.ok(fo.actual_inst === 0.4 && fo.ifr_approaches === 1 && fo.takeoffs_day === 1 && fo.landings_day === 1, "row-level fields on the larger (FO) bucket");
    assert.ok(aug.actual_inst === 0 && aug.ifr_approaches === 0 && aug.takeoffs_day === 0 && aug.landings_day === 0);
    assert.deepEqual(v.applied.splitRows, [{ row: dataStart + 8, buckets: 2 }]);
    assert.equal(v.applied.rowTotals?.[8], 5, "the Total cell applies to the row, once");
    assert.equal(v.applied.rowTotals?.length, 14);
    const report = reconcile(v.applied, v.analysis, v.analysis.mapping);
    const split = check(report, "split_rows");
    assert.equal(split.label, "Rows split across roles");
    assert.equal(split.status, "info");
    assert.equal(split.actual, 1);
    assert.equal(split.expected, undefined);
    assert.match(split.explanation ?? "", /^1 row carries time in more than one role; each was imported as one flight per role so no hours are lost\.$/);
    const rt = check(report, "row_totals");
    assert.equal(rt.status, "match", rt.explanation);
    assert.equal(rt.actual, 0, "Total 5.0 = 3.0 FO + 2.0 SIC");
    assert.equal(report.summary.totalHours, 49.4, "45.5 − 1.1 + 5.0: nothing dropped");
    const withAug = reconcile(v.applied, v.analysis, v.analysis.mapping, { augHalfCredit: true });
    assert.equal(withAug.summary.creditedHours, 40.9, "SIC half of the split row credited at 50 % like any other AUG time");
    assert.equal(withAug.summary.byRole.SIC, 8.5, "7.5 existing + 2.0 × 50 %");
    // A sheet that halves AUG in its row totals: Total 4.0 = 3.0 + 2.0 × 50 % is recognised as the 50 % convention.
    row[COL.total] = 4;
    const halved = run("numbers-multihead-split-me-half.xlsx", buildLogbook(rows));
    const rtHalf = check(reconcile(halved.applied, halved.analysis, halved.analysis.mapping), "row_totals");
    assert.equal(rtHalf.status, "match", rtHalf.explanation);
    assert.equal(rtHalf.actual, 0);
    assert.match(rtHalf.explanation ?? "", /^1 AUG row carry a Total cell at 50 %/);
    // Unsplit files report no split check at all.
    assert.equal(baseline.applied.splitRows?.length, 0);
    assert.ok(!reconcile(baseline.applied, baseline.analysis, baseline.analysis.mapping).checks.some((c) => c.id === "split_rows"));
  });

  await test("applyMapping: a negative / fractional / NaN dataStart is clamped — no phantom skipped rows", () => {
    const { analysis: a, workbook, applied } = run("numbers-multihead.csv");
    const withStart = (dataStart: number) => applyMapping(workbook, { ...a, header: { ...a.header, dataStart } }, a.mapping);
    // Clamped to 0: the title + header rows are visited and rejected by the date guards (rows 0–3), but no row index is ever negative.
    for (const bogus of [-3, Number.NaN]) {
      const r = withStart(bogus);
      assert.deepEqual(r.flights, applied.flights, `dataStart ${bogus}: same flights`);
      assert.deepEqual([r.rowTotals, r.sourceRows, r.splitRows, r.columnSums], [applied.rowTotals, applied.sourceRows, applied.splitRows, applied.columnSums], `dataStart ${bogus}: same bookkeeping`);
      assert.ok(r.skipped.every((s) => s.row >= 0), `dataStart ${bogus}: phantom rows ${JSON.stringify(r.skipped.filter((s) => s.row < 0))}`);
      assert.deepEqual(r.skipped.filter((s) => s.row >= a.header.dataStart), applied.skipped, `dataStart ${bogus}: data-area skips unchanged`);
      assert.deepEqual(r.skipped.filter((s) => s.row < a.header.dataStart).map((s) => s.row), [0, 1, 2, 3], `dataStart ${bogus}: only the header rows are the extra skips`);
    }
    assert.deepEqual(withStart(a.header.dataStart + 0.9), applied, "fractional dataStart is floored");
    const far = withStart(10_000);
    assert.deepEqual(far.flights, []);
    assert.deepEqual(far.skipped, []);
    assert.deepEqual(far.rowTotals, []);
  });

  await test("reconcile: a cross-country column that matches its total but not the whole-flight figure → explained (+1 h)", () => {
    const rows = fixtureRows();
    rowByDate(rows, "15-Sep-13")[COL.xcDayPic] = 1.3;   // 2.3 h flight, only 1.3 h of it logged as cross-country
    rowByDate(rows, "Totals")[COL.xcDayPic] = 11.6;     // footer follows the column
    const totals = FIXTURE_TOTALS.map((r) => [...r]);
    const set = (label: string, v: number) => { const row = totals.find((r) => r[0] === label); assert.ok(row); row[1] = v; };
    set("Total X-Country PIC (Day) =", 11.6);
    set("Total X-Country (Day) =", 19.6);
    set("Total X-Country Time =", 38.2);
    const v = run("numbers-multihead-partial-xc.xlsx", buildXlsx(rows, totals));
    const f = v.applied.flights.find((x) => x.date === "2013-09-15");
    assert.ok(f && f.is_xcountry && f.day_time === 2.3, "the flight is still cross-country, in full");
    const report = reconcile(v.applied, v.analysis, v.analysis.mapping);
    const WHOLE = /^LogbookHQ credits whole flights as cross-country \(\+1 h vs\. your sheet's cross-country column\)\./;
    for (const id of ["declared:field:xc_time|footer-row", "declared:field:xc_time|totals-sheet", "declared:field:xc_time|totals-sheet|any:day:pic", "declared:field:xc_time|totals-sheet|any:day:any"]) {
      const c = check(report, id);
      assert.equal(c.delta, 0, `${id}: column sum equals the declared figure`);
      assert.equal(c.status, "explained", `${id}: ${c.explanation}`);
      assert.equal(c.suggestion?.kind, "none");
      assert.match(c.explanation ?? "", WHOLE, id);
    }
    assert.equal(check(report, "declared:field:xc_time|footer-row").expected, 38.2);
    assert.equal(check(report, "declared:field:xc_time|totals-sheet|any:day:pic").actual, 11.6);
    assert.match(check(report, "declared:field:xc_time|footer-row").explanation ?? "", /Compared with the sum of/, "the column note is kept");
    const night = check(report, "declared:field:xc_time|totals-sheet|any:night:any");
    assert.equal(night.status, "match", "night cross-country is untouched → plain match");
    assert.equal(night.explanation, undefined);
    assert.equal(report.ok, true, report.checks.filter((c) => c.status === "mismatch").map((c) => c.id).join(", "));
    // Within 0.15 h the column stays a plain match (the untouched fixture: 39.2 both ways).
    assert.equal(check(reconcile(baseline.applied, baseline.analysis, baseline.analysis.mapping), "declared:field:xc_time|footer-row").status, "match");
  });
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await numbersMultihead();
  await foreflight();
  await korean();
  await messy();
  await fingerprints();
  await arbiter();
  await targets();
  await declaredTotals();
  await splitRows();

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "-".repeat(72));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  console.log("-".repeat(72));
  console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("harness crashed:", e);
  process.exitCode = 1;
});
