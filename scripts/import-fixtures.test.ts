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
import {
  analyzeWorkbook, applyMapping, arbitrateWithClaude, readWorkbook, reconcile, fingerprint,
  CANONICAL_OPTIONS, targetKey, parseTargetKey,
  type Analysis, type FieldTarget, type ReconcileReport,
} from "../lib/import";
import { FIELDS } from "../lib/import/targets";
import { sha1Hex } from "../lib/import/util";
import { detectFormat, parseAnyLogbook } from "../lib/import-formats";
import type { ParsedFlight } from "../lib/csv";

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

  await test("numbers-multihead: 3-row header band with qualified paths", () => {
    assert.deepEqual(a.header.rows, [1, 2, 3], `header rows ${JSON.stringify(a.header.rows)}`);
    assert.equal(a.header.dataStart, 4);
    assert.equal(labelOf(a, 7), `${SE} › Day › Dual`);
    assert.equal(labelOf(a, 10), `${SE} › Night › PIC`);
    assert.equal(labelOf(a, 14), `${ME} › Day › AUG`);
    assert.equal(labelOf(a, 17), `${ME} › Night › FO`);
    assert.equal(labelOf(a, 24), `${XC} › Night › AUG`);
    assert.equal(labelOf(a, 26), "Instrument › Hood");
    assert.equal(labelOf(a, 28), "Instrument › #IFR Appchs");
    assert.equal(labelOf(a, 29), "Total");
  });

  await test("numbers-multihead: every column maps to the legacy parser's bucket", () => {
    expectKeys(a, NUMBERS_KEYS);
    assert.equal(a.mapping.columns.length, 30);
    const weak = a.mapping.columns.filter((c) => c.confidence < 0.6).map((c) => `col ${c.col} ${c.confidence}`);
    assert.equal(weak.length, 0, `low-confidence columns: ${weak.join(", ")}`);
    assert.deepEqual(a.lowConfidenceCols, []);
    assert.equal(a.mapping.conventions.blankAircraftIsSim, true, "blank aircraft + sim time rows are sims");
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

async function main(): Promise<void> {
  await numbersMultihead();
  await foreflight();
  await korean();
  await messy();
  await fingerprints();
  await arbiter();
  await targets();

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
