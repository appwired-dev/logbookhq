/**
 * Flight-time limit tests for lib/currency-rules.ts.
 *
 *   npm run test:limits
 *
 * Covers, in order:
 *   1. Every regime's DEFAULT rule set carries the audited windows + citations,
 *      and `REGIME_RULES[r].flightTimeWindows` still mirrors `ruleSets[0]`
 *      (the charts page reads the top-level field).
 *   2. Canada's rule-set switch: CAR 700.28 is the default (1,000 h / 365 d),
 *      the superseded CARs 700.15 set is NOT offered.
 *   3. Rolling windows over a synthetic flight list. Window semantics:
 *      BOTH ENDS INCLUSIVE — a `days: 28` window ending 2026-03-15 starts
 *      2026-02-16 and covers 28 calendar dates; a flight dated exactly on
 *      `start_date` counts, one dated the day before does not, and a
 *      future-dated flight (after `today`) never counts.
 *   4. Simulator rows (category "SIM") contribute nothing, and `sim_inst`
 *      (simulated instrument time flown in a real aircraft) is never added on
 *      top of block time.
 *   5. Calendar-year windows reset on 1 January; "N consecutive calendar
 *      months" windows start on the 1st of the month N-1 back.
 *   6. The aug-half-credit setting cannot affect limits: computeCurrencyForRegime
 *      takes no options and reads day_time + night_time as logged, so a SIC row
 *      counts for its full block time (that 50 % convention lives in
 *      lib/derive.ts `creditedHours`, for experience totals only).
 *
 * Pure and offline — no fixtures, no network, no database.
 */
import assert from "node:assert/strict";
import {
  computeCurrencyForRegime, flightTimeHours, flightTimeWindowStart,
  REGIME_RULES, resolveRuleSet, ruleSetsFor, yearlyCeiling,
  type FlightTimeWindow, type Regime,
} from "../lib/currency-rules";
import type { Flight } from "../lib/types";

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

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
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1;

/** A minimal PIC flight of `hours` day time on `date` ("YYYY-MM-DD"). */
function flight(date: string, hours: number, over: Partial<Flight> = {}): Flight {
  return {
    id: nextId++, user_id: "u1", date,
    make_model: "B737", registration: "C-FABC",
    pic: null, copilot: null, third_pilot: null, check_pilot: null,
    route: null, remarks: null,
    category: "ME", role: "PIC",
    day_time: hours, night_time: 0, is_xcountry: false,
    actual_inst: 0, hood_inst: 0, sim_inst: 0, ifr_approaches: 0,
    precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
    takeoffs_day: 0, takeoffs_night: 0, landings_day: 0, landings_night: 0,
    duty_time: 0, created_at: "", updated_at: "",
    ...over,
  };
}

/** Local-midnight date from "YYYY-MM-DD" (never UTC — see lib/dates.ts). */
function day(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Compact view of a rule set's windows: [days, max, basis, months]. */
type Row = [number, number, string, number | undefined];
const rowsOf = (ws: FlightTimeWindow[]): Row[] =>
  ws.map((w) => [w.days, w.max, w.basis ?? "rolling-days", w.months]);

/** The computed window whose cap is `max` (windows are unique by cap per set). */
function windowWithMax(regime: Regime, today: Date, max: number, ruleSetId?: string) {
  const { windows } = computeCurrencyForRegime([], regime, today, ruleSetId);
  const w = windows.find((x) => x.max === max);
  assert.ok(w, `no window with max ${max} for ${regime}${ruleSetId ? "/" + ruleSetId : ""}`);
  return w;
}

// ---------------------------------------------------------------------------
// 1. Per-regime default sets
// ---------------------------------------------------------------------------

/** regime → [expected default windows, citation substring every window carries] */
const EXPECTED: Record<Regime, { rows: Row[]; cite: string }> = {
  // CAR 700.28: 1,000 / 365 d, 300 / 90 d, 112 / 28 d.
  CA:    { rows: [[365, 1000, "rolling-days", undefined], [90, 300, "rolling-days", undefined], [28, 112, "rolling-days", undefined]], cite: "700.28" },
  // Annex 6 Part I 4.10 sets no numbers — typical State limits only.
  ICAO:  { rows: [[365, 1000, "rolling-days", undefined], [28, 100, "rolling-days", undefined]], cite: "Annex 6" },
  // §117.23(b): 100 / 672 consecutive hours (= 28 days), 1,000 / 365 days.
  FAA:   { rows: [[28, 100, "rolling-days", undefined], [365, 1000, "rolling-days", undefined]], cite: "117.23" },
  // ORO.FTL.210(a): 100 / 28 d, 900 / calendar year, 1,000 / 12 calendar months.
  EASA:  { rows: [[28, 100, "rolling-days", undefined], [365, 900, "calendar-year", undefined], [365, 1000, "calendar-months", 12]], cite: "ORO.FTL.210" },
  UKCAA: { rows: [[28, 100, "rolling-days", undefined], [365, 900, "calendar-year", undefined], [365, 1000, "calendar-months", 12]], cite: "ORO.FTL.210" },
  // UAE CAR-OPS 1 Subpart Q: 100 / 28 d, 1,000 / 12 calendar months.
  GCAA:  { rows: [[28, 100, "rolling-days", undefined], [365, 1000, "calendar-months", 12]], cite: "CAR-OPS 1" },
  GACA:  { rows: [[28, 100, "rolling-days", undefined], [365, 1000, "rolling-days", undefined]], cite: "GACAR" },
  QCAA:  { rows: [[28, 100, "rolling-days", undefined], [365, 900, "calendar-year", undefined], [365, 1000, "calendar-months", 12]], cite: "QCAR" },
  HKCAD: { rows: [[28, 100, "rolling-days", undefined], [365, 900, "calendar-months", 12]], cite: "CAD 371" },
  CAAC:  { rows: [[365, 1000, "rolling-days", undefined], [28, 100, "rolling-days", undefined]], cite: "CCAR-121" },
};

const REGIMES = Object.keys(REGIME_RULES) as Regime[];

for (const regime of REGIMES) {
  test(`${regime}: default windows + citations`, () => {
    const expected = EXPECTED[regime];
    const set = ruleSetsFor(regime)[0];
    assert.deepEqual(rowsOf(set.flightTimeWindows), expected.rows);
    for (const w of set.flightTimeWindows) {
      assert.ok(w.citation, `${regime} window "${w.label}" has no citation`);
      assert.ok(
        w.citation.includes(expected.cite),
        `${regime} window "${w.label}" cites "${w.citation}", expected to mention "${expected.cite}"`,
      );
    }
  });
}

test("REGIME_RULES top-level fields still mirror the default set (charts read them)", () => {
  for (const regime of REGIMES) {
    const set = ruleSetsFor(regime)[0];
    assert.equal(REGIME_RULES[regime].flightTimeWindows, set.flightTimeWindows);
    assert.equal(REGIME_RULES[regime].reference, set.reference);
    assert.ok(REGIME_RULES[regime].reference.length > 0);
  }
});

test("no default set carries a 7-day flight-time window (those were duty limits)", () => {
  for (const regime of REGIMES) {
    const seven = ruleSetsFor(regime)[0].flightTimeWindows.filter((w) => w.days === 7);
    assert.deepEqual(seven, [], `${regime} still has a 7-day flight-time window`);
  }
});

test("ICAO is presented as typical State limits, not a hard rule", () => {
  const set = ruleSetsFor("ICAO")[0];
  assert.match(set.reference, /Annex 6 Part I, 4\.10/);
  assert.match(set.reference + set.label, /typical State limits/i);
});

// ---------------------------------------------------------------------------
// 2. Canada: 700.28 default, 700.15 legacy — and yearlyCeiling
// ---------------------------------------------------------------------------

test("CA offers only the current CAR 700.28 set; the superseded 700.15 rules are gone", () => {
  const sets = ruleSetsFor("CA");
  assert.equal(sets.length, 1, "only the current rule set is offered");
  assert.equal(sets[0].reference, "CAR 700.28");
  assert.deepEqual(
    sets[0].flightTimeWindows.map((w) => [w.days, w.max]),
    [[365, 1000], [90, 300], [28, 112]],
  );
  // Nothing anywhere may still cite the repealed section or its 1,200 h ceiling.
  const all = ruleSetsFor("CA").flatMap((x) => x.flightTimeWindows);
  assert.ok(!all.some((w) => /700\.15/.test(w.citation ?? "")), "no superseded citation");
  assert.ok(!all.some((w) => w.max === 1200), "no 1,200 h ceiling");
});

test("yearlyCeiling: CA = 1,000 h (700.28), and an unknown set id falls back to the default", () => {
  const ca = yearlyCeiling("CA");
  assert.equal(ca.max, 1000);
  assert.equal(ca.days, 365);
  assert.match(ca.reference, /700\.28/);
  // A stale id persisted in a browser must not resurrect old numbers.
  assert.equal(yearlyCeiling("CA", "cars-700-15").max, 1000);
});

test("yearlyCeiling: annual cap per regime", () => {
  assert.equal(yearlyCeiling("FAA").max, 1000);            // §117.23(b)(2), 365 rolling
  assert.equal(yearlyCeiling("FAA", "part-121-dom").max, 1000); // §121.471(a)(1), calendar year
  assert.equal(yearlyCeiling("EASA").max, 900);            // calendar-year cap binds first
  assert.equal(yearlyCeiling("UKCAA").max, 900);
  assert.equal(yearlyCeiling("GCAA").max, 1000);           // only a 12-calendar-month cap exists
  assert.equal(yearlyCeiling("HKCAD").max, 900);
  assert.equal(yearlyCeiling("ICAO").max, 1000);
  for (const regime of REGIMES) assert.equal(yearlyCeiling(regime).days, 365);
});

test("resolveRuleSet falls back to the default for unknown/absent ids", () => {
  assert.equal(resolveRuleSet("CA").reference, "CAR 700.28");
  assert.equal(resolveRuleSet("CA", "nope").reference, "CAR 700.28");
  // CA has a single set, so it resolves through the synthesized default like every other single-set regime.
  assert.equal(resolveRuleSet("CA", "cars-700-15").reference, "CAR 700.28", "a stale id resolves to the current set");
  assert.equal(resolveRuleSet("EASA", "cars-700-15").id, ruleSetsFor("EASA")[0].id);
});

test("FAA keeps the 30 h / 7 days figure only in the Part 121 domestic set", () => {
  const sets = ruleSetsFor("FAA");
  assert.equal(sets[0].id, "part-117");
  assert.equal(sets[0].flightTimeWindows.some((w) => w.days === 7), false);
  const dom = resolveRuleSet("FAA", "part-121-dom");
  assert.match(dom.reference, /121\.471/);
  assert.deepEqual(rowsOf(dom.flightTimeWindows), [
    [365, 1000, "calendar-year", undefined],
    [30, 100, "calendar-months", 1],
    [7, 30, "rolling-days", undefined],
  ]);
});

// ---------------------------------------------------------------------------
// 3. Rolling windows — boundaries are inclusive at both ends
// ---------------------------------------------------------------------------

test("rolling 28-day window: start_date is today − 27 days (28 dates)", () => {
  const w = windowWithMax("FAA", day("2026-03-15"), 100);
  assert.equal(w.start_date, "2026-02-16");
  assert.equal(w.days, 28);
});

test("rolling window includes both endpoints and excludes the day before / the future", () => {
  const today = day("2026-03-15");
  const flights = [
    flight("2026-02-15", 4),  // one day before the window opens — excluded
    flight("2026-02-16", 5),  // exactly on start_date — included
    flight("2026-03-15", 6),  // today — included
    flight("2026-03-16", 7),  // future-dated — excluded
  ];
  const w = windowWithMaxOn(flights, "FAA", today, 100);
  assert.equal(w.start_date, "2026-02-16");
  assert.equal(w.used, 11);
  assert.equal(w.remaining, 89);
  assert.equal(w.pct, 11);
});

test("365-day window: the 365th day back counts, the 366th does not", () => {
  const today = day("2026-03-15");
  const flights = [flight("2025-03-16", 3), flight("2025-03-15", 9)];
  const w = windowWithMaxOn(flights, "CA", today, 1000);
  assert.equal(w.start_date, "2025-03-16");
  assert.equal(w.used, 3);
});

test("CA 700.28 caps: 1,000 / 300 / 112 over the same flight list", () => {
  const today = day("2026-03-15");
  const flights = [
    flight("2026-03-10", 10), // inside 28 / 90 / 365
    flight("2026-02-01", 20), // inside 90 / 365 only
    flight("2025-06-01", 30), // inside 365 only
    flight("2024-06-01", 40), // outside every window
  ];
  const { windows } = computeCurrencyForRegime(flights, "CA", today);
  assert.deepEqual(windows.map((w) => [w.days, w.max, w.used]), [
    [365, 1000, 60],
    [90, 300, 30],
    [28, 112, 10],
  ]);
});

test("rule-set choice changes the caps but not the hours", () => {
  const today = day("2026-03-15");
  const flights = [flight("2026-03-01", 50)];
  const current = computeCurrencyForRegime(flights, "CA", today).windows[0];
  const stale = computeCurrencyForRegime(flights, "CA", today, "cars-700-15").windows[0];
  assert.equal(stale.max, 1000, "a stale rule-set id yields the current ceiling, not 1,200");
  assert.equal(stale.used, 50);
});

// ---------------------------------------------------------------------------
// 4. Simulators never count as flight time
// ---------------------------------------------------------------------------

test("category SIM rows contribute nothing, however their time was logged", () => {
  const today = day("2026-03-15");
  const flights = [
    flight("2026-03-10", 4, { category: "SIM" }),                    // sim session logged as day time
    flight("2026-03-11", 0, { category: "SIM", night_time: 3.5 }),   // …and as night time
    flight("2026-03-12", 2),                                         // real flying
  ];
  const w = windowWithMaxOn(flights, "FAA", today, 100);
  assert.equal(w.used, 2);
  assert.equal(flightTimeHours(flights[0]), 0);
  assert.equal(flightTimeHours(flights[1]), 0);
  assert.equal(flightTimeHours(flights[2]), 2);
});

test("sim_inst (hood time in a real aircraft) is not added on top of block time", () => {
  const f = flight("2026-03-12", 3, { sim_inst: 1.5, hood_inst: 1.5, actual_inst: 0.5 });
  assert.equal(flightTimeHours(f), 3);
  const w = windowWithMaxOn([f], "FAA", day("2026-03-15"), 100);
  assert.equal(w.used, 3);
});

// ---------------------------------------------------------------------------
// 5. Calendar-anchored windows
// ---------------------------------------------------------------------------

test("calendar-year window starts on 1 January and resets there", () => {
  const easa = ruleSetsFor("EASA")[0].flightTimeWindows.find((w) => w.basis === "calendar-year");
  assert.ok(easa);
  assert.equal(flightTimeWindowStart(easa, day("2026-03-15")).getMonth(), 0);
  assert.equal(flightTimeWindowStart(easa, day("2026-03-15")).getDate(), 1);

  const flights = [flight("2025-12-31", 40), flight("2026-01-01", 10), flight("2026-03-01", 5)];
  const midYear = windowWithMaxOn(flights, "EASA", day("2026-03-15"), 900);
  assert.equal(midYear.start_date, "2026-01-01");
  assert.equal(midYear.used, 15);          // last year's 40 h dropped out

  // On 1 January the window holds only that day's flying.
  const newYear = windowWithMaxOn(flights, "EASA", day("2026-01-01"), 900);
  assert.equal(newYear.start_date, "2026-01-01");
  assert.equal(newYear.used, 10);

  // 31 December still counts the whole outgoing year.
  const yearEnd = windowWithMaxOn(flights, "EASA", day("2025-12-31"), 900);
  assert.equal(yearEnd.start_date, "2025-01-01");
  assert.equal(yearEnd.used, 40);
});

test("12 consecutive calendar months = the 1st of the month 11 back → today", () => {
  const flights = [flight("2025-03-31", 20), flight("2025-04-01", 6), flight("2026-03-15", 4)];
  const w = windowWithMaxOn(flights, "EASA", day("2026-03-15"), 1000);
  assert.equal(w.start_date, "2025-04-01");
  assert.equal(w.used, 10);
});

test("one calendar month (FAA §121.471(a)(2)) starts on the 1st", () => {
  const flights = [flight("2026-02-28", 12), flight("2026-03-01", 8)];
  const w = windowWithMaxOn(flights, "FAA", day("2026-03-15"), 100, "part-121-dom");
  assert.equal(w.start_date, "2026-03-01");
  assert.equal(w.used, 8);
});

// ---------------------------------------------------------------------------
// 6. Limits use full logged time — the aug-half-credit setting cannot apply
// ---------------------------------------------------------------------------

test("SIC / augmenting hours count in full (aug-half-credit is a totals-only convention)", () => {
  const today = day("2026-03-15");
  const pic = [flight("2026-03-10", 12, { role: "PIC" })];
  const sic = [flight("2026-03-10", 12, { role: "SIC" })];
  const asPic = windowWithMaxOn(pic, "FAA", today, 100);
  const asSic = windowWithMaxOn(sic, "FAA", today, 100);
  assert.equal(asPic.used, 12);
  assert.equal(asSic.used, 12);
  // computeCurrencyForRegime has no options argument at all — there is no
  // path by which profiles.aug_half_credit could reach it.
  assert.equal(computeCurrencyForRegime.length, 2); // flights, regime (today/ruleSetId are optional)
});

test("night time counts, and malformed numbers do not poison the sum", () => {
  const flights = [
    flight("2026-03-10", 2, { night_time: 3 }),
    flight("2026-03-11", 0, { day_time: Number.NaN as unknown as number }),
  ];
  const w = windowWithMaxOn(flights, "FAA", day("2026-03-15"), 100);
  assert.equal(w.used, 5);
});

// ---------------------------------------------------------------------------

/** Same as windowWithMax, but over a real flight list. */
function windowWithMaxOn(flights: Flight[], regime: Regime, today: Date, max: number, ruleSetId?: string) {
  const { windows } = computeCurrencyForRegime(flights, regime, today, ruleSetId);
  const w = windows.find((x) => x.max === max);
  assert.ok(w, `no window with max ${max} for ${regime}`);
  return w;
}

console.log(`\n${passed + failed} test(s) — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
