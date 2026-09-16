/**
 * Passenger-recency tests for lib/currency-rules.ts (the recency half that
 * scripts/limits.test.ts does not cover).
 *
 *   npm run test:recency
 *
 * Focus: day/night passenger currency — the min(takeoffs, landings) rule, the
 * required-count threshold, and window exclusion. (IFR-approach recency is left
 * as-is by design; not asserted here.)
 *
 * Pure and offline.
 */
import assert from "node:assert/strict";
import { computeCurrencyForRegime } from "../lib/currency-rules";
import type { Flight } from "../lib/types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS  ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${(e instanceof Error ? e.message : String(e)).split("\n").join("\n      ")}`); }
}

let nextId = 1;
function flight(date: string, over: Partial<Flight> = {}): Flight {
  return {
    id: nextId++, user_id: "u1", date,
    make_model: "C172", registration: "C-FABC",
    pic: null, copilot: null, third_pilot: null, check_pilot: null,
    route: null, remarks: null, category: "SE", role: "PIC",
    day_time: 1, night_time: 0, is_xcountry: false, multi_pilot: false,
    actual_inst: 0, hood_inst: 0, sim_inst: 0, ifr_approaches: 0,
    precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
    takeoffs_day: 0, takeoffs_night: 0, landings_day: 0, landings_night: 0,
    duty_time: 0, created_at: "", updated_at: "",
    ...over,
  };
}
const day = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const TODAY = day("2026-06-15");
const rec = (flights: Flight[], key: string) => {
  const r = computeCurrencyForRegime(flights, "FAA", TODAY).recency.find((x) => x.key === key);
  assert.ok(r, `no recency entry for ${key}`);
  return r;
};

test("FAA day PAX: min(takeoffs,landings) per flight, summed; current at >=3", () => {
  const flights = [
    flight("2026-06-10", { takeoffs_day: 1, landings_day: 1 }), // +1
    flight("2026-06-05", { takeoffs_day: 1, landings_day: 1 }), // +1
    flight("2026-05-20", { takeoffs_day: 1, landings_day: 1 }), // +1
    flight("2026-06-01", { takeoffs_day: 2, landings_day: 0 }), // +0 (min asymmetry)
    flight("2026-01-01", { takeoffs_day: 9, landings_day: 9 }), // out of 90d window
  ];
  const d = rec(flights, "pax-day");
  assert.equal(d.required, 3, "required");
  assert.equal(d.achieved, 3, "achieved = 3 (asymmetric + out-of-window excluded)");
  assert.equal(d.current, true, "current");
  assert.equal(rec(flights, "pax-night").achieved, 0, "night unaffected");
});

test("FAA day PAX: below threshold is not current", () => {
  const flights = [
    flight("2026-06-10", { takeoffs_day: 1, landings_day: 1 }),
    flight("2026-06-05", { takeoffs_day: 1, landings_day: 1 }),
  ];
  const d = rec(flights, "pax-day");
  assert.equal(d.achieved, 2, "achieved");
  assert.equal(d.current, false, "not current at 2/3");
});

test("FAA night PAX: min asymmetry, day currency independent", () => {
  const flights = [
    flight("2026-06-10", { takeoffs_night: 3, landings_night: 1 }), // min 1
    flight("2026-06-05", { takeoffs_night: 2, landings_night: 2 }), // min 2
  ];
  assert.equal(rec(flights, "pax-night").achieved, 3, "night achieved");
  assert.equal(rec(flights, "pax-night").current, true, "night current");
  assert.equal(rec(flights, "pax-day").achieved, 0, "day achieved 0");
});

test("Out-of-window landings never count", () => {
  const flights = [flight("2026-01-01", { takeoffs_day: 9, landings_day: 9 })];
  const d = rec(flights, "pax-day");
  assert.equal(d.achieved, 0, "achieved 0");
  assert.equal(d.current, false, "not current");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
