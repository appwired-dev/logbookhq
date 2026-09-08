/**
 * Per-regime currency rules. Two distinct currency families:
 *
 *  1. Flight-time limits (rolling-window hour caps) — used by airline-style
 *     operators to enforce duty/rest. CAR 700.28, 14 CFR §117.23, ORO.FTL.210…
 *
 *  2. Recency requirements (IFR + day/night PAX) — what every pilot needs
 *     to legally carry passengers or fly IFR after a layoff. Counted against
 *     the recent flight history.
 *
 * Sources (flight-time limits — audited 2026-09):
 *   CA    — CAR 700.28 (SOR/2018-269; in force 12 Dec 2020 for 705 operators,
 *           12 Dec 2022 for 703/704). The pre-2020 CARs 700.15 set is kept
 *           selectable for logbooks that pre-date the change.
 *   ICAO  — Annex 6 Part I, 4.10 + Attachment A. ICAO sets NO numbers; the
 *           State of the Operator does. Our ICAO set is labelled "typical
 *           State limits" and must not be read as a hard rule.
 *   FAA   — 14 CFR §117.23(b) (Part 121 passenger flightcrew). §121.471(a)
 *           (domestic, non-117 e.g. all-cargo) is offered as a second set.
 *   EASA  — ORO.FTL.210(a) (CAT operators).
 *   UKCAA — Retained Regulation (EU) No 965/2012, ORO.FTL.210 — same numbers.
 *   GCAA  — UAE CAR-OPS 1 Subpart Q.
 *
 * Recency: CARs 401.05 / FAR 61.57 / Part-FCL.060 / ICAO Annex 1, simplified
 * to the most-common interpretation per authority. Edge cases (instrument
 * proficiency check substitution, full-stop vs. touch-and-go nuances) are
 * commented inline.
 *
 * NOTE — these figures are informational. The operator's approved FTL scheme
 * or FRMS governs, and several regimes below are marked UNVERIFIED in code
 * comments where a primary source could not be confirmed.
 */

import type { Flight, CurrencyReport, CurrencyWindow, RecencyStatus } from "./types";

export type Regime =
  | "CA" | "ICAO" | "FAA" | "EASA" | "UKCAA"
  | "GCAA" | "GACA" | "QCAA" | "HKCAD" | "CAAC";

/**
 * How a flight-time window is anchored.
 *   "rolling-days"     — the last N calendar dates, ending today (default).
 *   "calendar-year"    — 1 January of the current year → today.
 *   "calendar-months"  — the first day of the month (months − 1) back → today,
 *                        i.e. "any N consecutive calendar months".
 */
export type FlightTimeBasis = "rolling-days" | "calendar-year" | "calendar-months";

export interface FlightTimeWindow {
  label: string;
  /**
   * Nominal window length in days. Always populated — calendar-anchored
   * windows carry their nominal length (365 for a calendar year, 30 × months
   * for calendar months) so consumers that only understand rolling days still
   * get a usable number.
   */
  days: number;
  max: number;
  /** Defaults to "rolling-days" when absent (back-compat). */
  basis?: FlightTimeBasis;
  /** Number of consecutive calendar months — only for basis "calendar-months". */
  months?: number;
  /** Regulatory citation for this specific window. */
  citation?: string;
}

/**
 * One selectable set of flight-time limits for a regime. A regime has more
 * than one when the rules changed (Canada 2020) or when different operating
 * rules apply to different fleets (FAA Part 117 vs. Part 121 domestic).
 * The FIRST set in `ruleSets` is the default.
 */
export interface FlightTimeRuleSet {
  id: string;
  label: string;
  reference: string;
  flightTimeWindows: FlightTimeWindow[];
}

export interface RecencyRule {
  key: "ifr" | "pax-day" | "pax-night";
  label: string;
  windowDays: number;
  required: number;
  citation: string;
  /** What to count off each flight to add toward `achieved`. */
  count: "approaches" | "day-takeoffs+landings" | "night-takeoffs+landings";
}

export interface RegimeRules {
  code: Regime;
  name: string;
  authority: string;
  /** Citation for the DEFAULT rule set (mirrors ruleSets[0].reference). */
  reference: string;
  /** Windows of the DEFAULT rule set (mirrors ruleSets[0].flightTimeWindows). */
  flightTimeWindows: FlightTimeWindow[];
  /** Present only where a regime offers a choice; default first. */
  ruleSets?: FlightTimeRuleSet[];
  recency: RecencyRule[];
}

// ============================================================
// Shared recency baselines — used as starting points per regime
// ============================================================

const FAA_RECENCY: RecencyRule[] = [
  { key: "ifr",       label: "IFR Currency",   windowDays: 180, required: 6, citation: "FAR 61.57(c)", count: "approaches" },
  { key: "pax-day",   label: "Day PAX",        windowDays: 90,  required: 3, citation: "FAR 61.57(a)", count: "day-takeoffs+landings" },
  { key: "pax-night", label: "Night PAX",      windowDays: 90,  required: 3, citation: "FAR 61.57(b)", count: "night-takeoffs+landings" },
];

const TCCA_RECENCY: RecencyRule[] = [
  { key: "ifr",       label: "IFR Currency",   windowDays: 180, required: 6, citation: "CARs 401.05",  count: "approaches" },
  { key: "pax-day",   label: "Day PAX",        windowDays: 180, required: 5, citation: "CARs 401.05",  count: "day-takeoffs+landings" },
  { key: "pax-night", label: "Night PAX",      windowDays: 180, required: 5, citation: "CARs 401.05",  count: "night-takeoffs+landings" },
];

const EASA_RECENCY: RecencyRule[] = [
  { key: "ifr",       label: "IFR Currency",   windowDays: 365, required: 6, citation: "Part-FCL.060", count: "approaches" },
  { key: "pax-day",   label: "Day PAX",        windowDays: 90,  required: 3, citation: "Part-FCL.060", count: "day-takeoffs+landings" },
  { key: "pax-night", label: "Night PAX",      windowDays: 90,  required: 3, citation: "Part-FCL.060", count: "night-takeoffs+landings" },
];

const ICAO_RECENCY: RecencyRule[] = [
  { key: "ifr",       label: "IFR Currency",   windowDays: 180, required: 6, citation: "ICAO Annex 1", count: "approaches" },
  { key: "pax-day",   label: "Day PAX",        windowDays: 90,  required: 3, citation: "ICAO Annex 1", count: "day-takeoffs+landings" },
  { key: "pax-night", label: "Night PAX",      windowDays: 90,  required: 3, citation: "ICAO Annex 1", count: "night-takeoffs+landings" },
];

// ============================================================
// Flight-time window sets
// ============================================================

/**
 * Canada, current rules. CAR 700.28 replaced CARs 700.15 for commercial air
 * services (705 operators from 12 Dec 2020, 703/704 from 12 Dec 2022).
 * Paragraph lettering below follows SOR/2018-269 as published; only the
 * section number (700.28) is asserted in the citations.
 */
const CA_700_28: FlightTimeWindow[] = [
  // 700.28 (a) — 1,000 h flight time in any 365 consecutive days.
  { label: "Last 365 Days", days: 365, max: 1000, citation: "CAR 700.28" },
  // 700.28 (b) — 300 h flight time in any 90 consecutive days.
  { label: "Last 90 Days",  days: 90,  max: 300,  citation: "CAR 700.28" },
  // 700.28 (c) — 112 h flight time in any 28 consecutive days.
  { label: "Last 28 Days",  days: 28,  max: 112,  citation: "CAR 700.28" },
];

/** Canada, superseded. CARs 700.15 as it stood before the 2018 FDT overhaul. */
const CA_700_15: FlightTimeWindow[] = [
  // 700.15(1)(a) — 1,200 h in any 365 consecutive days.
  { label: "Last 365 Days", days: 365, max: 1200, citation: "CARs 700.15 (superseded)" },
  // 700.15(1)(b) — 300 h in any 90 consecutive days.
  { label: "Last 90 Days",  days: 90,  max: 300,  citation: "CARs 700.15 (superseded)" },
  // 700.15(1)(c) — 120 h in any 30 consecutive days.
  { label: "Last 30 Days",  days: 30,  max: 120,  citation: "CARs 700.15 (superseded)" },
  // 700.15(1)(d) — 40 h in any 7 consecutive days.
  { label: "Last 7 Days",   days: 7,   max: 40,   citation: "CARs 700.15 (superseded)" },
];

/**
 * FAA Part 117 (Part 121 passenger flightcrew, and Part 91K/135 crews flown
 * under 117 by election). §117.23(b) has exactly two flight-time caps — the
 * "30 h / 7 days" figure that used to sit here is §121.471(a)(3), a domestic
 * Part 121 limit, and has been moved to the second FAA set below.
 */
const FAA_117: FlightTimeWindow[] = [
  // §117.23(b)(1) — 100 h in any 672 CONSECUTIVE HOURS. 672 h = 28 days
  // exactly; logbook rows are date-granular, so we evaluate it as 28 calendar
  // dates. A pilot near the cap should check the clock-hour figure.
  { label: "Last 28 Days",  days: 28,  max: 100,  citation: "14 CFR §117.23(b)(1)" },
  // §117.23(b)(2) — 1,000 h in any 365 consecutive calendar days.
  { label: "Last 365 Days", days: 365, max: 1000, citation: "14 CFR §117.23(b)(2)" },
];

/**
 * FAA Part 121 domestic (§121.471(a)) — still the governing flight-time rule
 * for all-cargo operations that have not opted into Part 117.
 * §121.471(a)(4) (8 h between required rest periods) is a per-duty limit, not
 * a rolling window, so it is not modelled here.
 */
const FAA_121_DOMESTIC: FlightTimeWindow[] = [
  // §121.471(a)(1) — 1,000 h in any CALENDAR YEAR.
  { label: "Calendar Year", days: 365, max: 1000, basis: "calendar-year",   citation: "14 CFR §121.471(a)(1)" },
  // §121.471(a)(2) — 100 h in any CALENDAR MONTH.
  { label: "Calendar Month", days: 30, max: 100,  basis: "calendar-months", months: 1, citation: "14 CFR §121.471(a)(2)" },
  // §121.471(a)(3) — 30 h in any 7 consecutive days.
  { label: "Last 7 Days",   days: 7,   max: 30,   citation: "14 CFR §121.471(a)(3)" },
];

/**
 * EASA ORO.FTL.210(a) — flight times for CAT operators. The "60 h / 7 days"
 * entry that used to live here is ORO.FTL.210(b), a DUTY limit (60 duty hours
 * in 7 consecutive days), not flight time, and has been removed.
 */
const EASA_FTL_210: FlightTimeWindow[] = [
  // (a)(1) — 100 flight hours in any 28 consecutive days.
  { label: "Last 28 Days",   days: 28,  max: 100,  citation: "ORO.FTL.210(a)(1)" },
  // (a)(2) — 900 flight hours in any CALENDAR YEAR.
  { label: "Calendar Year",  days: 365, max: 900,  basis: "calendar-year",   citation: "ORO.FTL.210(a)(2)" },
  // (a)(3) — 1,000 flight hours in any 12 consecutive CALENDAR MONTHS.
  { label: "Last 12 Months", days: 365, max: 1000, basis: "calendar-months", months: 12, citation: "ORO.FTL.210(a)(3)" },
];

/** UK CAA: retained ORO.FTL.210 — numerically identical to EASA. */
const UK_FTL_210: FlightTimeWindow[] = [
  { label: "Last 28 Days",   days: 28,  max: 100,  citation: "ORO.FTL.210(a)(1) (UK retained)" },
  { label: "Calendar Year",  days: 365, max: 900,  basis: "calendar-year",   citation: "ORO.FTL.210(a)(2) (UK retained)" },
  { label: "Last 12 Months", days: 365, max: 1000, basis: "calendar-months", months: 12, citation: "ORO.FTL.210(a)(3) (UK retained)" },
];

/**
 * UAE GCAA CAR-OPS 1 Subpart Q. UNVERIFIED against a primary GCAA source —
 * the two caps below are the ones the UAE scheme is generally quoted as
 * carrying. A calendar-year cap (900 h, as in EU-OPS 1.1265 / ORO.FTL.210(a)(2))
 * may also apply; it is deliberately NOT modelled rather than invented.
 */
const GCAA_SUBPART_Q: FlightTimeWindow[] = [
  // 100 h flight time in any 28 consecutive days.
  { label: "Last 28 Days",   days: 28,  max: 100,  citation: "UAE CAR-OPS 1 Subpart Q" },
  // 1,000 h flight time in any 12 consecutive calendar months.
  { label: "Last 12 Months", days: 365, max: 1000, basis: "calendar-months", months: 12, citation: "UAE CAR-OPS 1 Subpart Q" },
];

/**
 * ICAO reference set. Annex 6 Part I, 4.10 requires the State of the Operator
 * to ESTABLISH flight time limits — it prescribes no numbers, and Attachment A
 * only offers guidance on building the scheme. The figures below are the
 * values most States land on, shown as a yardstick, never as a hard rule.
 */
const ICAO_TYPICAL: FlightTimeWindow[] = [
  // Typical State limit — 1,000 h / 365 days. Not an ICAO number.
  { label: "Last 365 Days", days: 365, max: 1000, citation: "Annex 6 Part I, 4.10 (State-set)" },
  // Typical State limit — 100 h / 28 days. Not an ICAO number.
  { label: "Last 28 Days",  days: 28,  max: 100,  citation: "Annex 6 Part I, 4.10 (State-set)" },
];

/**
 * Saudi GACA. GACAR is modelled on the FAR, and GACAR Part 117 mirrors
 * 14 CFR §117.23. UNVERIFIED — treat as FAA-aligned until a GACA source is
 * checked. The old "30 h / 7 days" row was inherited from the FAA set and is
 * removed for the same reason (it is a §121.471 figure, not a 117 one).
 */
const GACA_117: FlightTimeWindow[] = [
  { label: "Last 28 Days",  days: 28,  max: 100,  citation: "GACAR Part 117 (FAR-aligned)" },
  { label: "Last 365 Days", days: 365, max: 1000, citation: "GACAR Part 117 (FAR-aligned)" },
];

/**
 * Qatar QCAA. QCAR-OPS Subpart Q is EASA-aligned. UNVERIFIED — the numbers
 * below are EASA's; confirm against QCAA before relying on them.
 */
const QCAA_SUBPART_Q: FlightTimeWindow[] = [
  { label: "Last 28 Days",   days: 28,  max: 100,  citation: "QCAR-OPS Subpart Q (EASA-aligned)" },
  { label: "Calendar Year",  days: 365, max: 900,  basis: "calendar-year",   citation: "QCAR-OPS Subpart Q (EASA-aligned)" },
  { label: "Last 12 Months", days: 365, max: 1000, basis: "calendar-months", months: 12, citation: "QCAR-OPS Subpart Q (EASA-aligned)" },
];

/**
 * Hong Kong CAD. The HK scheme derives from UK CAP 371: 100 h flying in any
 * 28 consecutive days and 900 h in any 12 consecutive calendar months.
 * UNVERIFIED against the current CAD 371 edition. The old "60 h / 7 days" row
 * was a duty figure and is removed.
 */
const HKCAD_371: FlightTimeWindow[] = [
  { label: "Last 28 Days",   days: 28,  max: 100, citation: "HK CAD 371 (CAP 371-derived)" },
  { label: "Last 12 Months", days: 365, max: 900, basis: "calendar-months", months: 12, citation: "HK CAD 371 (CAP 371-derived)" },
];

/**
 * China CAAC. CCAR-121 Subpart Q sets the flight-time limits. UNVERIFIED —
 * the exact CCAR-121 figures could not be confirmed, so the ICAO-typical
 * 1,000 h / 365 d and 100 h / 28 d are shown as a placeholder. The old
 * "30 h / 7 days" row was inherited from the FAA set and is removed.
 */
const CAAC_121: FlightTimeWindow[] = [
  { label: "Last 365 Days", days: 365, max: 1000, citation: "CCAR-121 Subpart Q (unverified)" },
  { label: "Last 28 Days",  days: 28,  max: 100,  citation: "CCAR-121 Subpart Q (unverified)" },
];

// ============================================================
// Regimes
// ============================================================

export const REGIME_RULES: Record<Regime, RegimeRules> = {
  CA: {
    code: "CA",
    name: "Canada",
    authority: "Transport Canada",
    reference: "CAR 700.28",
    flightTimeWindows: CA_700_28,
    ruleSets: [
      { id: "car-700-28",  label: "Canada — current (CAR 700.28)",       reference: "CAR 700.28",   flightTimeWindows: CA_700_28 },
      { id: "cars-700-15", label: "Canada — pre-2020 (CARs 700.15)",     reference: "CARs 700.15",  flightTimeWindows: CA_700_15 },
    ],
    recency: TCCA_RECENCY,
  },
  ICAO: {
    code: "ICAO",
    name: "ICAO",
    authority: "ICAO",
    reference: "Annex 6 Part I, 4.10 — typical State limits",
    flightTimeWindows: ICAO_TYPICAL,
    recency: ICAO_RECENCY,
  },
  FAA: {
    code: "FAA",
    name: "United States",
    authority: "FAA",
    reference: "14 CFR §117.23",
    flightTimeWindows: FAA_117,
    ruleSets: [
      { id: "part-117",     label: "US — Part 117 (§117.23)",                   reference: "14 CFR §117.23",   flightTimeWindows: FAA_117 },
      { id: "part-121-dom", label: "US — Part 121 domestic / cargo (§121.471)",  reference: "14 CFR §121.471",  flightTimeWindows: FAA_121_DOMESTIC },
    ],
    recency: FAA_RECENCY,
  },
  EASA: {
    code: "EASA",
    name: "Europe",
    authority: "EASA",
    reference: "ORO.FTL.210",
    flightTimeWindows: EASA_FTL_210,
    recency: EASA_RECENCY,
  },
  UKCAA: {
    code: "UKCAA",
    name: "United Kingdom",
    authority: "UK CAA",
    reference: "ORO.FTL.210 (UK retained)",
    flightTimeWindows: UK_FTL_210,
    recency: EASA_RECENCY, // Effectively identical for PPL/CPL recency.
  },
  GCAA: {
    code: "GCAA",
    name: "United Arab Emirates",
    authority: "GCAA",
    reference: "UAE CAR-OPS 1 Subpart Q",
    flightTimeWindows: GCAA_SUBPART_Q,
    recency: EASA_RECENCY,
  },
  GACA: {
    code: "GACA",
    name: "Saudi Arabia",
    authority: "GACA",
    reference: "GACAR Part 117 (FAR-aligned)",
    flightTimeWindows: GACA_117,
    recency: FAA_RECENCY, // Saudi GACAR mirrors FAR for recency.
  },
  QCAA: {
    code: "QCAA",
    name: "Qatar",
    authority: "QCAA",
    reference: "QCAR-OPS Subpart Q (EASA-aligned)",
    flightTimeWindows: QCAA_SUBPART_Q,
    recency: EASA_RECENCY,
  },
  HKCAD: {
    code: "HKCAD",
    name: "Hong Kong",
    authority: "HK CAD",
    reference: "HK CAD 371",
    flightTimeWindows: HKCAD_371,
    recency: EASA_RECENCY,
  },
  CAAC: {
    code: "CAAC",
    name: "China",
    authority: "CAAC",
    reference: "CCAR-121 Subpart Q",
    flightTimeWindows: CAAC_121,
    recency: ICAO_RECENCY, // CCAR-61 currency aligns with ICAO baseline.
  },
};

// ============================================================
// Rule-set helpers
// ============================================================

/**
 * Every selectable rule set for a regime, default first. Regimes with a
 * single set get a synthetic one built from the top-level fields, so callers
 * never have to special-case `ruleSets === undefined`.
 */
export function ruleSetsFor(regime: Regime): FlightTimeRuleSet[] {
  const rules = REGIME_RULES[regime];
  return rules.ruleSets ?? [{
    id: "default",
    label: `${rules.name} — ${rules.reference}`,
    reference: rules.reference,
    flightTimeWindows: rules.flightTimeWindows,
  }];
}

/** The named rule set, or the regime's default when the id is unknown/absent. */
export function resolveRuleSet(regime: Regime, ruleSetId?: string): FlightTimeRuleSet {
  const sets = ruleSetsFor(regime);
  return sets.find((s) => s.id === ruleSetId) ?? sets[0];
}

/**
 * The annual ceiling of a rule set — what a "hours this year" gauge should
 * draw its red line at.
 *
 * Preference order: an explicit calendar-year window (EASA's 900 h is the cap
 * that binds inside one calendar year), then a 365-day rolling window, then
 * the longest calendar-months window of a year or more (EASA/UAE 1,000 h over
 * 12 consecutive calendar months). `days` is the window's nominal length —
 * 365 for both calendar-year and 12-calendar-month windows.
 */
export function yearlyCeiling(regime: Regime, ruleSetId?: string): { max: number; days: number; reference: string } {
  const set = resolveRuleSet(regime, ruleSetId);
  const w =
    set.flightTimeWindows.find((x) => x.basis === "calendar-year") ??
    set.flightTimeWindows.find((x) => (x.basis ?? "rolling-days") === "rolling-days" && x.days === 365) ??
    set.flightTimeWindows.find((x) => x.basis === "calendar-months" && (x.months ?? 0) >= 12) ??
    // Nothing annual in this set — fall back to its longest window so callers
    // always get a number rather than undefined.
    [...set.flightTimeWindows].sort((a, b) => b.days - a.days)[0];
  return { max: w.max, days: w.days, reference: w.citation ?? set.reference };
}

// ============================================================
// Compute
// ============================================================

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * First calendar date inside `w`, given the day the window ends on.
 * Windows are INCLUSIVE at both ends: a 28-day window ending 2026-01-28 starts
 * 2026-01-01 and covers 28 calendar dates (not 29).
 */
export function flightTimeWindowStart(w: FlightTimeWindow, today: Date): Date {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (w.basis ?? "rolling-days") {
    case "calendar-year":
      return new Date(today.getFullYear(), 0, 1);
    case "calendar-months":
      // "Any N consecutive calendar months" = the current month plus the
      // N − 1 complete months before it.
      return new Date(today.getFullYear(), today.getMonth() - ((w.months ?? 12) - 1), 1);
    default:
      start.setDate(start.getDate() - (w.days - 1));
      return start;
  }
}

/**
 * Hours a flight contributes to a regulatory flight-time limit.
 *
 * Simulator sessions are NOT flight time — a category "SIM" row contributes
 * nothing even when day_time/night_time are populated (several importers put
 * session length there). `sim_inst` is simulated *instrument* time flown in a
 * real aircraft under the hood, so it is already inside day/night time and is
 * never added separately.
 *
 * The aug-half-credit preference (profiles.aug_half_credit) is deliberately
 * ignored: it is an experience-totals convention, and the regulator counts
 * every logged hour in the seat. See lib/derive.ts `creditedHours`.
 */
export function flightTimeHours(f: Flight): number {
  if (f.category === "SIM") return 0;
  return (Number(f.day_time) || 0) + (Number(f.night_time) || 0);
}

/**
 * Sum the count metric for a recency rule over flights in the window.
 * Returns total achieved and the earliest contributing flight date (so we
 * can compute when the bucket drops below threshold).
 */
function tallyRecency(
  flights: Flight[],
  rule: RecencyRule,
  todayIso: string,
  windowStartIso: string,
): { achieved: number; earliestContributingDate: string | null } {
  let achieved = 0;
  let earliest: string | null = null;
  for (const f of flights) {
    if (f.date < windowStartIso || f.date > todayIso) continue;
    let inc = 0;
    switch (rule.count) {
      case "approaches":
        inc = Number(f.ifr_approaches) || 0;
        break;
      case "day-takeoffs+landings":
        // Count whichever is smaller — both are required for currency.
        inc = Math.min(Number(f.takeoffs_day) || 0, Number(f.landings_day) || 0);
        break;
      case "night-takeoffs+landings":
        inc = Math.min(Number(f.takeoffs_night) || 0, Number(f.landings_night) || 0);
        break;
    }
    if (inc > 0) {
      achieved += inc;
      if (earliest === null || f.date < earliest) earliest = f.date;
    }
  }
  return { achieved, earliestContributingDate: earliest };
}

export function computeCurrencyForRegime(
  flights: Flight[],
  regime: Regime,
  today: Date = new Date(),
  ruleSetId?: string,
): CurrencyReport {
  const rules = REGIME_RULES[regime];
  const set = resolveRuleSet(regime, ruleSetId);
  const todayIso = localIso(today);

  // ----- Flight-time windows -----
  // Both ends inclusive: a flight dated exactly on `start_date` counts, a
  // flight dated in the future (after `today`) does not.
  const windows: CurrencyWindow[] = set.flightTimeWindows.map((w) => {
    const startIso = localIso(flightTimeWindowStart(w, today));
    let used = 0;
    for (const f of flights) {
      if (f.date >= startIso && f.date <= todayIso) used += flightTimeHours(f);
    }
    used = r1(used);
    return {
      label: w.label,
      days: w.days,
      used,
      max: w.max,
      start_date: startIso,
      remaining: r1(w.max - used),
      pct: Math.round((used / w.max) * 1000) / 10,
    };
  });

  // ----- Recency (IFR + PAX) -----
  const recency: RecencyStatus[] = rules.recency.map((rule) => {
    const winStart = new Date(today);
    winStart.setDate(winStart.getDate() - (rule.windowDays - 1));
    const winStartIso = localIso(winStart);
    const { achieved, earliestContributingDate } = tallyRecency(flights, rule, todayIso, winStartIso);
    const current = achieved >= rule.required;

    // Expiry: when the earliest contributing flight drops out of the
    // window, do we still meet the requirement? Simple model: if we have
    // EXACTLY `required` contributors, expiry = earliest + windowDays. If
    // we have more, look at the (achieved - required + 1)th oldest. For
    // MVP we just use the earliest contributor — pessimistic but safe.
    let expiresOn: string | null = null;
    let daysUntilExpiry: number | null = null;
    if (current && earliestContributingDate) {
      const dropOut = new Date(earliestContributingDate);
      dropOut.setDate(dropOut.getDate() + rule.windowDays);
      expiresOn = localIso(dropOut);
      const msPerDay = 86400000;
      daysUntilExpiry = Math.max(0, Math.round((dropOut.getTime() - today.getTime()) / msPerDay));
    }

    return {
      key: rule.key,
      label: rule.label,
      windowDays: rule.windowDays,
      required: rule.required,
      achieved,
      current,
      expiresOn,
      daysUntilExpiry,
      citation: rule.citation,
    };
  });

  return { today: todayIso, windows, recency };
}
