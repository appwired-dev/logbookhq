/**
 * Totals-engine tests for lib/derive.ts.
 *
 *   npm run test:derive
 *
 * Pins the numbers that appear on the dashboard, the PDF/CSV exports and the
 * public /share snapshot — and, crucially, the aug-half-credit convention,
 * which is applied deliberately INCONSISTENTLY (total_time / by_type / me_sic
 * are halved for SIC time; total_pic and every xc_* figure stay full). Nothing
 * else pins that split, so a refactor could silently change logged hours.
 *
 * Pure and offline — no fixtures, no network, no database.
 */
import assert from "node:assert/strict";
import { computeTotals, creditedHours, deriveFlight } from "../lib/derive";
import type { Flight } from "../lib/types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS  ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${(e instanceof Error ? e.message : String(e)).split("\n").join("\n      ")}`); }
}

let nextId = 1;
function flight(over: Partial<Flight> = {}): Flight {
  return {
    id: nextId++, user_id: "u1", date: "2026-01-01",
    make_model: "B737", registration: "C-FABC",
    pic: null, copilot: null, third_pilot: null, check_pilot: null,
    route: null, remarks: null,
    category: "ME", role: "PIC",
    day_time: 0, night_time: 0, is_xcountry: false, multi_pilot: false,
    actual_inst: 0, hood_inst: 0, sim_inst: 0, ifr_approaches: 0,
    precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
    takeoffs_day: 0, takeoffs_night: 0, landings_day: 0, landings_night: 0,
    duty_time: 0, created_at: "", updated_at: "",
    ...over,
  };
}

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: got ${a}, want ${b}`);

// A mixed fixture used by several tests.
const FIXTURE: Flight[] = [
  flight({ category: "SE", role: "PIC",  make_model: "C172", day_time: 2.0 }),                    // PIC 2.0
  flight({ category: "ME", role: "FO",   make_model: "B737", night_time: 1.5, actual_inst: 0.5, ifr_approaches: 2, holds: 1, precision_approaches: 1 }), // FO 1.5 night
  flight({ category: "ME", role: "SIC",  make_model: "B737", day_time: 3.0, is_xcountry: true }), // SIC 3.0 XC
  flight({ category: "SE", role: "DUAL", make_model: "B737", day_time: 1.0, cfi_time: 1.0 }),      // DUAL 1.0
];

test("computeTotals: block, role, class, xc, instrument aggregates", () => {
  const t = computeTotals(FIXTURE);
  near(t.total_time, 7.5, "total_time");
  near(t.total_pic, 2.0, "total_pic");
  near(t.total_fo, 1.5, "total_fo");
  near(t.se_pic_day, 2.0, "se_pic_day");
  near(t.se_dual_day, 1.0, "se_dual_day");
  near(t.se_total, 3.0, "se_total");
  near(t.me_fo_night, 1.5, "me_fo_night");
  near(t.me_sic_day, 3.0, "me_sic_day");
  near(t.me_total, 4.5, "me_total");
  near(t.xc_day, 3.0, "xc_day");
  near(t.xc_sic, 3.0, "xc_sic");
  near(t.xc_total, 3.0, "xc_total");
  near(t.actual_inst, 0.5, "actual_inst");
  near(t.inst_total, 0.5, "inst_total");
  near(t.ifr_approaches, 2, "ifr_approaches");
  near(t.total_holds, 1, "total_holds");
  near(t.total_precision, 1, "total_precision");
  near(t.total_cfi, 1.0, "total_cfi");
  near(t.by_type["C172"], 2.0, "by_type C172");
  near(t.by_type["B737"], 5.5, "by_type B737");
});

test("aug-half-credit halves SIC block time but leaves PIC and every xc_* full", () => {
  const base = computeTotals(FIXTURE);
  const half = computeTotals(FIXTURE, { augHalfCredit: true });
  // total_time drops by exactly half the one SIC flight (3.0 -> 1.5)
  near(half.total_time, base.total_time - 1.5, "total_time halved for SIC");
  near(half.me_sic_day, base.me_sic_day * 0.5, "me_sic_day halved");
  near(half.by_type["B737"], 4.0, "by_type B737 (fo 1.5 + sic 1.5 + dual 1.0)");
  // deliberately NOT halved:
  near(half.total_pic, base.total_pic, "total_pic unchanged");
  near(half.xc_sic, base.xc_sic, "xc_sic stays full");
  near(half.xc_day, base.xc_day, "xc_day stays full");
  near(half.xc_total, base.xc_total, "xc_total stays full");
});

test("creditedHours: only SIC + augHalfCredit is halved", () => {
  const sic = deriveFlight(flight({ role: "SIC", category: "ME", day_time: 3.0 }));
  near(creditedHours(sic, true), 1.5, "SIC half");
  near(creditedHours(sic, false), 3.0, "SIC full without opt");
  const pic = deriveFlight(flight({ role: "PIC", category: "SE", day_time: 2.0 }));
  near(creditedHours(pic, true), 2.0, "PIC never halved");
});

test("deriveFlight: legacy AUG -> SIC, and category/role/xc mapping", () => {
  const aug = deriveFlight(flight({ role: "AUG" as Flight["role"], category: "ME", day_time: 2.0 }));
  assert.equal(aug.role, "SIC", "AUG normalized to SIC");
  near(aug.me_sic_day, 2.0, "AUG counts as me_sic_day");
  const sePic = deriveFlight(flight({ category: "SE", role: "PIC", day_time: 2.0, night_time: 0.5 }));
  near(sePic.se_pic_day, 2.0, "se_pic_day"); near(sePic.se_pic_night, 0.5, "se_pic_night");
  near(sePic.total_time, 2.5, "total_time = day + night");
  const xc = deriveFlight(flight({ category: "ME", role: "PIC", day_time: 1.0, is_xcountry: true }));
  near(xc.xc_day, 1.0, "xc_day set when is_xcountry");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
