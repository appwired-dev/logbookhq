/**
 * i18n tests for the import wizard's generated prose (step 2 column reasons,
 * step 3 reconcile explanations).
 *
 *   npm run test:import        (picked up by scripts/run-import-tests.ts)
 *
 * Pure and offline. Three things are guarded:
 *
 *   1. Drift — the message keys and the reason wordings are re-derived from
 *      lib/import/reconcile.ts / lib/import/mapping.ts and compared with what
 *      app/app/import/check-messages.ts knows. A new or reworded library
 *      message fails here instead of silently falling back to English.
 *   2. Coverage — every messageKey has a template in all four locales, and
 *      a realistic check (English copied from the library) really does render
 *      in ko/zh/es rather than returning the English fallback.
 *   3. Placeholders — the `{name}` set matches across the four locales of
 *      every template, fragment and reason.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPLANATION, MESSAGE_KEYS, REASON, REASON_PATTERNS, SILENT_KEYS,
  explanationFor, placeholdersOf, reasonText, type MessageKey, type ReasonKey,
} from "../app/app/import/check-messages";
import { makeStrings } from "../app/app/import/import-strings";
import type { ReconcileCheck } from "../lib/import/types";
import type { Locale } from "../lib/i18n";

const ROOT = join(__dirname, "..");
const LOCALES: Locale[] = ["en", "ko", "zh", "es"];
const OTHER: Locale[] = ["ko", "zh", "es"];

let passed = 0;
let failed = 0;

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

// ---------------------------------------------------------------------------
// 1. Drift against the library
// ---------------------------------------------------------------------------

/** Message keys as reconcile.ts writes them: `messageKey:` (incl. ternaries), Alt `key:`, and `done(status, key, …)`. */
function libraryMessageKeys(): string[] {
  const src = readFileSync(join(ROOT, "lib/import/reconcile.ts"), "utf8");
  const keys = new Set<string>();
  // Not a key: the only other lowercase literal on a `messageKey:` line.
  const NOT_A_KEY = new Set(["prior"]);
  for (const m of src.matchAll(/messageKey:(.*)$/gm)) {
    for (const q of m[1].matchAll(/"([a-z0-9_]+)"/g)) if (!NOT_A_KEY.has(q[1])) keys.add(q[1]);
  }
  for (const m of src.matchAll(/\bkey:\s*"([a-z0-9_]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/done\(\s*"[a-z]+",\s*"([a-z0-9_]+)"/g)) keys.add(m[1]);
  return [...keys].sort();
}

/** Reason wordings as mapping.ts writes them, with every `${…}` collapsed to "•". */
function libraryReasonShapes(): string[] {
  const src = readFileSync(join(ROOT, "lib/import/mapping.ts"), "utf8");
  const shapes = new Set<string>();
  for (const line of src.split("\n")) {
    if (!/reason:|\badd\(|\bcand\(/.test(line)) continue;
    for (const m of line.matchAll(/`([^`]*)`|"([^"]*)"/g)) {
      const raw = m[1] ?? m[2];
      if (!raw.includes(" ")) continue; // enum members / field names, never a reason
      shapes.add(raw.replace(/\$\{[^}]*\}/g, "•"));
    }
  }
  return [...shapes].sort();
}

/** Every reason lib/import/mapping.ts can produce, as of the last review. */
const EXPECTED_REASON_SHAPES = [
  '"•" could be a type',
  '"•" could be an identifier',
  '"•" holds hours, not aircraft types',
  '"•" is an instrument subtotal (recomputed on import)',
  '"•" is not imported',
  '"•" might be the row total',
  '"•" under "•"',
  'block time — flight time comes from "•"',
  "cells look like PIC/FO/DUAL",
  "cells look like SE/ME/SIM",
  "cells look like aircraft type codes",
  "cells look like airport codes",
  "cells look like airport pairs",
  "cells look like dates",
  "cells look like free text",
  "cells look like hours",
  "cells look like small counts",
  "cells look like tail numbers",
  "covered by the actual/hood columns",
  "covered by the day/night • columns",
  'duplicate header "•" (also column •)',
  "empty column",
  'full-stop subset of the "•" landings column',
  'header "•" as a crew name',
  'header "•" could be flight time',
  'header "•" counts approaches',
  'header "•" counts holds',
  'header "•" counts landings',
  'header "•" counts takeoffs',
  'header "•" is a crew name',
  'header "•" is a cross-country flag',
  'header "•" is actual instrument',
  'header "•" is cross-country time',
  'header "•" is hood / simulated instrument',
  'header "•" is instruction given',
  'header "•" is instrument time',
  'header "•" is simulator time',
  'header "•" is simulator time by role',
  'header "•" is the row total',
  'header "•" matched •',
  'header "•" → •',
  "hours column without a header — flight time is taken from column •",
  "no header and no recognisable shape",
  "no suitable target",
  'unrecognised header "•"',
  "• already comes from column •",
];

test("message keys: check-messages knows exactly what reconcile.ts emits", () => {
  assert.deepEqual([...MESSAGE_KEYS].sort(), libraryMessageKeys());
});

test("message keys: every key is either explained or explicitly silent", () => {
  const covered = [...Object.keys(EXPLANATION), ...SILENT_KEYS].sort();
  assert.deepEqual(covered, [...MESSAGE_KEYS].sort());
});

test("reason shapes: mapping.ts wording has not drifted", () => {
  assert.deepEqual(libraryReasonShapes(), EXPECTED_REASON_SHAPES);
});

// ---------------------------------------------------------------------------
// 2. Placeholder parity
// ---------------------------------------------------------------------------

function assertParity(what: string, entry: Record<Locale, string>): void {
  const ref = placeholdersOf(entry.en).join(",");
  for (const l of LOCALES) {
    assert.equal(typeof entry[l], "string", `${what}: ${l} missing`);
    const got = placeholdersOf(entry[l]).join(",");
    assert.equal(got, ref, `${what}: en{${ref}} vs ${l}{${got}}`);
  }
}

test("placeholders match across locales in every explanation", () => {
  for (const [key, tpl] of Object.entries(EXPLANATION)) assertParity(`explanation ${key}`, tpl.text);
});

test("placeholders match across locales in every reason", () => {
  for (const [key, entry] of Object.entries(REASON)) assertParity(`reason ${key}`, entry);
});

test("no locale is left empty or identical to English", () => {
  const shared = new Set(["declared_match"]); // context-only: the sentence itself is empty
  for (const [key, tpl] of Object.entries(EXPLANATION)) {
    if (shared.has(key)) continue;
    for (const l of LOCALES) assert.ok(tpl.text[l].length > 0, `explanation ${key}: ${l} is empty`);
    for (const l of OTHER) assert.notEqual(tpl.text[l], tpl.text.en, `explanation ${key}: ${l} is still English`);
  }
  for (const [key, entry] of Object.entries(REASON)) {
    for (const l of LOCALES) assert.ok(entry[l].length > 0, `reason ${key}: ${l} is empty`);
    for (const l of OTHER) assert.notEqual(entry[l], entry.en, `reason ${key}: ${l} is still English`);
  }
});

// ---------------------------------------------------------------------------
// 3. Explanations render in every locale
// ---------------------------------------------------------------------------

type Vars = NonNullable<ReconcileCheck["vars"]>;
const check = (messageKey: string, explanation: string, vars: Vars, id = "declared:x"): ReconcileCheck =>
  ({ id, label: "Totals › Total", actual: 0, status: "info", explanation, messageKey, vars });

/** One realistic check per messageKey; `explanation` is copied from lib/import/reconcile.ts. */
const SAMPLES: { key: MessageKey; check: ReconcileCheck }[] = [
  { key: "grand_total_none", check: check("grand_total_none", "The file does not declare a grand total to compare against.", { computed: 1234.5 }, "grand_total") },
  { key: "hours_gt_24_some", check: check("hours_gt_24_some", "3 rows add up to more than 24 hours — usually a time column mapped to the wrong bucket or a clock-time column read as hours.", { count: 3 }, "hours_gt_24") },
  { key: "hours_gt_24_none", check: check("hours_gt_24_none", "No row adds up to more than 24 h.", { count: 0 }, "hours_gt_24") },
  { key: "date_rows_above_header", check: check("date_rows_above_header", "1 dated row above the detected header were not imported — the header may have been detected too far down.", { count: 1 }, "date_rows_above_header") },
  {
    key: "row_totals_off",
    check: check("row_totals_off", "2 of 100 rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h (2024-01-01, 2024-02-02).", { off: 2, compared: 100, halved: 0, dates: "2024-01-01, 2024-02-02" }, "row_totals"),
  },
  {
    key: "row_totals_off",
    check: check("row_totals_off", "2 of 100 rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h (2024-01-01). 3 AUG rows carry a Total cell at 50 % of their logged time — the sheet credits augmenting time at 50 % in its row totals.", { off: 2, compared: 100, halved: 3, dates: "2024-01-01" }, "row_totals"),
  },
  { key: "row_totals_halved", check: check("row_totals_halved", "1 AUG row carry a Total cell at 50 % of their logged time — the sheet credits augmenting time at 50 % in its row totals.", { off: 0, compared: 10, halved: 1, dates: "" }, "row_totals") },
  { key: "row_totals_ok", check: check("row_totals_ok", "Every row's Total cell equals the sum of its time buckets (within 0.1 h).", { off: 0, compared: 10, halved: 0, dates: "" }, "row_totals") },
  { key: "cumulative_total", check: check("cumulative_total", "The Total column looks cumulative (running total) and was not used for row hours.", {}, "cumulative_total") },
  { key: "split_rows", check: check("split_rows", "2 rows carry time in more than one role; each was imported as one flight per role so no hours are lost.", { count: 2 }, "split_rows") },
  { key: "instrument_gt_flight", check: check("instrument_gt_flight", "1 row log more instrument time (actual + hood) than flight time (2024-05-01) — an instrument column may be mapped twice or to the wrong field.", { count: 1, dates: "2024-05-01" }, "instrument_gt_flight") },
  { key: "instrument_clamped", check: check("instrument_clamped", "4 rows had instrument time above flight time; clamped to the flight time.", { count: 4 }, "instrument_gt_flight") },
  { key: "instrument_ok", check: check("instrument_ok", "No row logs more instrument time than flight time.", {}, "instrument_gt_flight") },
  { key: "date_order_reversed", check: check("date_order_reversed", "The sheet is in reverse-chronological order; flights are sorted by date once imported.", { count: 120 }, "date_order") },
  { key: "date_order_backfilled", check: check("date_order_backfilled", "5 rows are dated earlier than the row above them. Usually fine (back-filled entries) — worth a glance if the count is large.", { count: 5 }, "date_order") },
  { key: "future_dates_some", check: check("future_dates_some", "2 flights are dated after today — check the day/month order of the date column.", { count: 2, today: "2026-09-08" }, "future_dates") },
  { key: "future_dates_none", check: check("future_dates_none", "No flight is dated after today (2026-09-08).", { count: 0, today: "2026-09-08" }, "future_dates") },
  { key: "night_gt_total", check: check("night_gt_total", "The night columns add up to 120.5 h, more than the Total column's 100.2 h — a night column may be mis-mapped.", { night: 120.5, total: 100.2 }, "night_gt_total") },
  { key: "night_le_total", check: check("night_le_total", "12.5 night h ≤ 100 total h", { night: 12.5, total: 100 }, "night_gt_total") },
  { key: "unknown_roles", check: check("unknown_roles", "3 rows with unrecognised role text (P1, P2) were imported as PIC — review the Role column.", { count: 3, samples: "P1, P2" }, "unknown_roles") },
  { key: "negative_hours", check: check("negative_hours", "1 cell with negative hours were treated as 0.", { count: 1 }, "negative_hours") },
  {
    key: "day_first_prior",
    check: check("day_first_prior", 'Ambiguous dates were read day-first (day/month/year) because of the "Datum" header spells out day/month order. "05.03.2024" was read as 2024-03-05 (not 2024-05-03). Flip the day-first switch if that is wrong.', { dayFirst: "true", reason: 'the "Datum" header spells out day/month order', example: "05.03.2024", readAs: "2024-03-05", other: "2024-05-03" }, "day_first_dates"),
  },
  {
    key: "day_first_default",
    check: check("day_first_default", 'Ambiguous dates were read month-first (month/day/year) by default — the file gives no clue either way. "05/03/2024" was read as 2024-05-03. Flip the day-first switch if that is wrong.', { dayFirst: "false", reason: "", example: "05/03/2024", readAs: "2024-05-03", other: "" }, "day_first_dates"),
  },
  { key: "sibling_sheets", check: check("sibling_sheets", "Also importing 2 sheets with the same layout (2023, 2024).", { count: 2, names: "2023, 2024", rows: 400 }, "sibling_sheets") },
  { key: "other_dated_sheet", check: check("other_dated_sheet", 'Sheet "Sim" has 12 dated rows in a different layout and was not imported.', { sheet: "Sim", rows: 12 }, "other_sheet:2") },
  {
    key: "declared_match",
    check: check("declared_match", "Includes 4 sim sessions (6.5 h) logged in the Total column.", { source: "total-column", declaredLabel: "Total", simSessions: 4, simHours: 6.5, declared: 100, computed: 100, delta: 0, unit: "h", label: "Total time" }, "grand_total"),
  },
  {
    key: "declared_mismatch",
    check: check("declared_mismatch", "Computed 950 h vs. declared 1,000 h (difference -50 h). A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.", { declared: 1000, computed: 950, delta: -50, unit: "h", label: "Total" }),
  },
  {
    key: "declared_mismatch",
    check: check("declared_mismatch", "Computed 950 h vs. declared 1,000 h (difference -50 h). The other AUG convention gets closer (975 h) but does not match either. A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.", { declared: 1000, computed: 950, delta: -50, unit: "h", label: "Total", alternative: 975 }),
  },
  {
    key: "declared_off_rows",
    check: check("declared_off_rows", "Computed 90 h vs. declared 100 h (difference -10 h). 2 rows differ from their own Total cell: 2024-01-01, 2024-02-02 — fix those rows first.", { declared: 100, computed: 90, delta: -10, unit: "h", offRows: 2, offDates: "2024-01-01, 2024-02-02" }),
  },
  {
    key: "declared_small_gap",
    check: check("declared_small_gap", "Differs by 0.5 h on 1,000 h. This small a gap is almost always the spreadsheet's own totals formula (a range that stops short of the newest rows, or rounding), not a mapping problem.", { declared: 1000, computed: 999.5, delta: -0.5, unit: "h" }),
  },
  {
    key: "declared_minutes",
    check: check("declared_minutes", "The declared figure looks like minutes: 402 min = 6.7 h, which matches the computed 6.7 h.", { declared: 402, computed: 6.7, delta: -395.3, unit: "h", minutes: 402, hours: 6.7 }),
  },
  { key: "declared_not_compared", check: check("declared_not_compared", "No single column in the file corresponds to this line (declared 12), so it wasn't compared.", { declared: 12, unit: "count", declaredLabel: "Total landings" }) },
  {
    key: "declared_skipped_rows",
    check: check("declared_skipped_rows", "The 2 skipped rows (no date) carry 2.3 h in the Total column — that is the whole difference.", { declared: 100, computed: 97.7, delta: -2.3, unit: "h", skippedRows: 2, skippedSum: 2.3 }, "grand_total"),
  },
  {
    key: "declared_skipped_rows",
    check: check("declared_skipped_rows", "The 1 skipped row (no date) carry 0.8 h in those columns — that is the whole difference.", { declared: 10, computed: 9.2, delta: -0.8, unit: "h", skippedRows: 1, skippedSum: 0.8 }),
  },
  {
    key: "declared_text_cells",
    check: check("declared_text_cells", 'The sheet\'s total skips 2 cells stored as text (3.5 h) in "Night", "Total" — spreadsheet SUM formulas ignore text, the import reads it. That accounts for the whole difference.', { declared: 100, computed: 103.5, delta: 3.5, unit: "h", textCells: 2, textCellsSum: 3.5, textCellColumns: "Night, Total" }),
  },
  {
    key: "declared_aug_half",
    check: check("declared_aug_half", "Your spreadsheet credits augmenting (AUG/SIC) time at 50 % — the SIC-halved total (1,000 h) matches the declared 1,000 h. Turn on the 50 % AUG credit setting so LogbookHQ's totals agree with your sheet.", { declared: 1000, computed: 1100, delta: 100, unit: "h", alternative: 1000 }, "grand_total"),
  },
  {
    key: "declared_aug_full",
    check: check("declared_aug_full", "Your spreadsheet counts augmenting (AUG/SIC) time in full — 1,000.4 h comes within 0.4 h of the declared 1,000 h. Your account's 50 % AUG credit setting is what decides how that time is credited in LogbookHQ.", { declared: 1000, computed: 900, delta: -100, unit: "h", alternative: 1000.4 }, "grand_total"),
  },
  {
    key: "declared_aug_column",
    check: check("declared_aug_column", "Your spreadsheet credits the AUG column at 50 % in this line — 50 h matches the declared 50 h. LogbookHQ counts cross-country time in full.", { declared: 50, computed: 60, delta: 10, unit: "h", alternative: 50, field: "xc_time" }),
  },
  {
    key: "declared_aug_column",
    check: check("declared_aug_column", "Your spreadsheet credits the AUG columns at 50 % in this line — 50 h matches the declared 50 h. LogbookHQ counts actual instrument time in full.", { declared: 50, computed: 60, delta: 10, unit: "h", alternative: 50, field: "actual_inst" }),
  },
  {
    key: "declared_sim_included",
    check: check("declared_sim_included", "This figure includes 4 simulator sessions (6.5 h) — 106.5 h matches the declared 106.5 h. LogbookHQ keeps simulator time out of total flight time.", { declared: 106.5, computed: 100, delta: -6.5, unit: "h", alternative: 106.5, simSessions: 4 }, "grand_total"),
  },
  {
    key: "declared_xc_whole_flight",
    check: check("declared_xc_whole_flight", "LogbookHQ credits whole flights as cross-country (+3.2 h vs. your sheet's cross-country column).", { declared: 50, computed: 50, delta: 0, unit: "h", gap: 3.2, field: "xc_time" }),
  },
];

test("every explained messageKey has a sample", () => {
  const sampled = new Set(SAMPLES.map((x) => x.key));
  const missing = Object.keys(EXPLANATION).filter((k) => !sampled.has(k as MessageKey));
  assert.deepEqual(missing, []);
});

test("every sample renders in ko / zh / es instead of falling back to English", () => {
  for (const { key, check: c } of SAMPLES) {
    for (const l of OTHER) {
      const out = explanationFor(makeStrings(l), c);
      assert.ok(out, `${key} (${l}): nothing rendered`);
      assert.notEqual(out, c.explanation, `${key} (${l}): fell back to the English "${c.explanation}"`);
    }
  }
});

test("English is returned untouched", () => {
  for (const { check: c } of SAMPLES) assert.equal(explanationFor(makeStrings("en"), c), c.explanation);
});

test("numbers are formatted for the locale and the sheet's own text is kept", () => {
  const c = SAMPLES.find((x) => x.key === "declared_mismatch")!.check;
  const es = explanationFor(makeStrings("es"), c)!;
  assert.ok(es.includes("1000") || es.includes("1.000"), `es grouping: ${es}`);
  const ko = explanationFor(makeStrings("ko"), SAMPLES.find((x) => x.key === "other_dated_sheet")!.check)!;
  assert.ok(ko.includes('"Sim"'), `sheet name must survive verbatim: ${ko}`);
});

test("trailing context / note sentences are localised too", () => {
  const c = check("declared_mismatch", 'Computed 950 h vs. declared 1,000 h (difference -50 h). A column may be mapped to the wrong bucket, or the sheet\'s total includes rows that were skipped. Declared as 402 min. Compared with the sum of "Day", "Night".', { declared: 1000, computed: 950, delta: -50, unit: "h", label: "Total" });
  const zh = explanationFor(makeStrings("zh"), c)!;
  assert.ok(zh.includes("402 分钟"), `minutes note: ${zh}`);
  assert.ok(zh.includes('"Day", "Night"'), `column list must survive verbatim: ${zh}`);
  assert.ok(!/Declared as|Compared with/.test(zh), `English left over: ${zh}`);
});

test("fallbacks: unknown key, missing var, and no explanation at all", () => {
  const s = makeStrings("ko");
  const unknown = check("brand_new_library_key", "Something new the library says.", { count: 1 });
  assert.equal(explanationFor(s, unknown), unknown.explanation);
  // `count` is required by the template — without it the English stands.
  const missing = check("hours_gt_24_some", "3 rows add up to more than 24 hours — usually a time column mapped to the wrong bucket or a clock-time column read as hours.", {}, "hours_gt_24");
  assert.equal(explanationFor(s, missing), missing.explanation);
  // Reworded upstream: the variant matching refuses to guess.
  const reworded = check("instrument_ok", "No row logs more instrument time than flight time (new wording).", {}, "instrument_gt_flight");
  assert.equal(explanationFor(s, reworded), reworded.explanation);
  // Keys the library emits with no explanation render nothing at all.
  for (const key of SILENT_KEYS) {
    assert.equal(explanationFor(s, { id: key, label: "L", actual: 0, status: "info", messageKey: key, vars: {} }), undefined);
  }
});

// ---------------------------------------------------------------------------
// 4. Column-mapping reasons
// ---------------------------------------------------------------------------

/** One concrete reason per pattern, as mapping.ts would write it. */
const REASON_SAMPLES: { key: ReasonKey; reason: string }[] = [
  { key: "notImported", reason: '"Sig" is not imported' },
  { key: "xcTime", reason: 'header "XC" is cross-country time' },
  { key: "xcFlag", reason: 'header "XC?" is a cross-country flag' },
  { key: "instructionGiven", reason: 'header "Dual Given" is instruction given' },
  { key: "countsApproaches", reason: 'header "Appr" counts approaches' },
  { key: "countsHolds", reason: 'header "Holds" counts holds' },
  { key: "countsLandings", reason: 'header "Ldg" counts landings' },
  { key: "countsTakeoffs", reason: 'header "T/O" counts takeoffs' },
  { key: "matchedField", reason: 'header "Datum" matched Date' },
  { key: "couldBeIdentifier", reason: '"Ident" could be an identifier' },
  { key: "holdsHours", reason: '"Type" holds hours, not aircraft types' },
  { key: "couldBeType", reason: '"Reg" could be a type' },
  { key: "hoodInst", reason: 'header "Hood" is hood / simulated instrument' },
  { key: "actualInst", reason: 'header "IMC" is actual instrument' },
  { key: "simByRole", reason: 'header "Sim PIC" is simulator time by role' },
  { key: "simTime", reason: 'header "Sim" is simulator time' },
  { key: "instSubtotal", reason: '"Total Inst" is an instrument subtotal (recomputed on import)' },
  { key: "mightBeRowTotal", reason: '"Sum" might be the row total' },
  { key: "instTime", reason: 'header "Inst" is instrument time' },
  { key: "underParents", reason: '"PIC" under "Multi-Engine › Night"' },
  { key: "isRowTotal", reason: 'header "Total" is the row total' },
  { key: "couldBeFlightTime", reason: 'header "Hours" could be flight time' },
  { key: "mappedTo", reason: 'header "Night" → Multi-engine · Night · PIC time' },
  { key: "asCrewName", reason: 'header "P1" as a crew name' },
  { key: "isCrewName", reason: 'header "Captain" is a crew name' },
  { key: "shapeDates", reason: "cells look like dates" },
  { key: "shapePairs", reason: "cells look like airport pairs" },
  { key: "shapeTail", reason: "cells look like tail numbers" },
  { key: "shapeTypes", reason: "cells look like aircraft type codes" },
  { key: "shapeAirports", reason: "cells look like airport codes" },
  { key: "shapeFreeText", reason: "cells look like free text" },
  { key: "shapeHours", reason: "cells look like hours" },
  { key: "shapeSmallCounts", reason: "cells look like small counts" },
  { key: "shapeCategory", reason: "cells look like SE/ME/SIM" },
  { key: "shapeRole", reason: "cells look like PIC/FO/DUAL" },
  { key: "unrecognisedHeader", reason: 'unrecognised header "Anmerkung"' },
  { key: "noHeaderNoShape", reason: "no header and no recognisable shape" },
  { key: "emptyColumn", reason: "empty column" },
  { key: "alreadyFrom", reason: "Date already comes from column B" },
  { key: "noSuitableTarget", reason: "no suitable target" },
  { key: "hoursNoHeader", reason: "hours column without a header — flight time is taken from column F" },
  { key: "fullStopSubset", reason: 'full-stop subset of the "Landings" landings column' },
  { key: "coveredLandings", reason: "covered by the day/night landings columns" },
  { key: "coveredTakeoffs", reason: "covered by the day/night takeoffs columns" },
  { key: "coveredActualHood", reason: "covered by the actual/hood columns" },
  { key: "blockTime", reason: 'block time — flight time comes from "Gesamtflugzeit"' },
  { key: "duplicateHeader", reason: 'duplicate header "PIC" (also column D)' },
];

test("every reason pattern has a sample and matches the right key", () => {
  assert.deepEqual(
    [...new Set(REASON_SAMPLES.map((x) => x.key))].sort(),
    [...new Set(REASON_PATTERNS.map((p) => p.key))].sort(),
  );
  for (const { key, reason } of REASON_SAMPLES) {
    const hit = REASON_PATTERNS.find((p) => p.re.test(reason));
    assert.equal(hit?.key, key, `"${reason}" matched ${hit?.key ?? "nothing"}`);
  }
});

test("every reason sample localises in ko / zh / es and keeps the sheet's text", () => {
  for (const { key, reason } of REASON_SAMPLES) {
    for (const l of OTHER) {
      const out = reasonText(makeStrings(l), reason);
      assert.ok(out, `${key} (${l}): nothing rendered`);
      assert.notEqual(out, reason, `${key} (${l}): fell back to English`);
    }
  }
  assert.ok(reasonText(makeStrings("ko"), 'header "Datum" matched Date')!.includes('"Datum"'));
  assert.equal(reasonText(makeStrings("en"), "empty column"), "empty column");
});

test("reason targets are localised, not left in English", () => {
  const ko = reasonText(makeStrings("ko"), 'header "Datum" matched Date')!;
  assert.ok(ko.includes("날짜"), ko);
  const zh = reasonText(makeStrings("zh"), "Date already comes from column B")!;
  assert.ok(zh.includes("日期"), zh);
});

test("an unknown reason keeps the library's English", () => {
  const odd = "some brand new reason the library invented";
  assert.equal(reasonText(makeStrings("ko"), odd), odd);
  assert.equal(reasonText(makeStrings("ko"), undefined), undefined);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
