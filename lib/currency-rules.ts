/**
 * Per-regime currency rules. Two distinct currency families:
 *
 *  1. Flight-time limits (rolling-window hour caps) — used by airline-style
 *     operators to enforce duty/rest. CARs 700.15, FAR 117, ORO.FTL, etc.
 *
 *  2. Recency requirements (IFR + day/night PAX) — what every pilot needs
 *     to legally carry passengers or fly IFR after a layoff. Counted against
 *     the recent flight history.
 *
 * Sources:
 *   CA    — CARs 700.15(1) hours; CARs 401.05 recency.
 *   ICAO  — Annex 6 Part I §9.5 hours; Annex 1 §2.1.10 recency baseline.
 *   FAA   — 14 CFR §117.23 hours; 14 CFR §61.57 recency.
 *   EASA  — ORO.FTL.210 hours; Part-FCL.060 recency.
 *   UKCAA — UK CAA ORS4 (post-Brexit, mirrors EASA with UK addenda).
 *
 * Recency rules are simplified to the most-common interpretation per
 * authority. Edge cases (instrument proficiency check substitution, full-
 * stop vs. touch-and-go nuances) are commented inline.
 */

import type { Flight, CurrencyReport, CurrencyWindow, RecencyStatus } from "./types";

export type Regime =
  | "CA" | "ICAO" | "FAA" | "EASA" | "UKCAA"
  | "GCAA" | "GACA" | "QCAA" | "HKCAD" | "CAAC";

export interface FlightTimeWindow {
  label: string;
  days: number;
  max: number;
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
  reference: string;
  flightTimeWindows: FlightTimeWindow[];
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
// Regimes
// ============================================================

export const REGIME_RULES: Record<Regime, RegimeRules> = {
  CA: {
    code: "CA",
    name: "Canada",
    authority: "Transport Canada",
    reference: "CARs 700.15",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1200 },
      { label: "Last 90 Days",  days: 90,  max: 300 },
      { label: "Last 30 Days",  days: 30,  max: 120 },
      { label: "Last 7 Days",   days: 7,   max: 40 },
    ],
    recency: TCCA_RECENCY,
  },
  ICAO: {
    code: "ICAO",
    name: "ICAO",
    authority: "ICAO",
    reference: "Annex 6 Part I §9.5",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 35 },
    ],
    recency: ICAO_RECENCY,
  },
  FAA: {
    code: "FAA",
    name: "United States",
    authority: "FAA",
    reference: "14 CFR §117.23 (Part 121 flightcrew)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 30 },
    ],
    recency: FAA_RECENCY,
  },
  EASA: {
    code: "EASA",
    name: "Europe",
    authority: "EASA",
    reference: "ORO.FTL.210 (CAT operators)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 60 },
    ],
    recency: EASA_RECENCY,
  },
  UKCAA: {
    code: "UKCAA",
    name: "United Kingdom",
    authority: "UK CAA",
    reference: "UK CAA ORS4 / retained EASA Part-ORO",
    flightTimeWindows: [
      // UK CAA retained the EASA caps post-Brexit.
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 60 },
    ],
    recency: EASA_RECENCY, // Effectively identical for PPL/CPL recency.
  },
  GCAA: {
    code: "GCAA",
    name: "United Arab Emirates",
    authority: "GCAA",
    reference: "UAE CAR-OPS 1 (mirrors EASA)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 55 },
    ],
    recency: EASA_RECENCY,
  },
  GACA: {
    code: "GACA",
    name: "Saudi Arabia",
    authority: "GACA",
    reference: "GACAR Part 121 (FAR-aligned)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 30 },
    ],
    recency: FAA_RECENCY, // Saudi GACAR mirrors FAR for recency.
  },
  QCAA: {
    code: "QCAA",
    name: "Qatar",
    authority: "QCAA",
    reference: "QCAR Part-OPS (EASA-aligned)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 55 },
    ],
    recency: EASA_RECENCY,
  },
  HKCAD: {
    code: "HKCAD",
    name: "Hong Kong",
    authority: "HK CAD",
    reference: "Cap. 448 ANO (UK-aligned)",
    flightTimeWindows: [
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 60 },
    ],
    recency: EASA_RECENCY,
  },
  CAAC: {
    code: "CAAC",
    name: "China",
    authority: "CAAC",
    reference: "CCAR-121 / CCAR-61",
    flightTimeWindows: [
      // CAAC tends slightly stricter than ICAO baseline on weekly hours.
      { label: "Last 365 Days", days: 365, max: 1000 },
      { label: "Last 28 Days",  days: 28,  max: 100 },
      { label: "Last 7 Days",   days: 7,   max: 30 },
    ],
    recency: ICAO_RECENCY, // CCAR-61 currency aligns with ICAO baseline.
  },
};

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
): CurrencyReport {
  const rules = REGIME_RULES[regime];
  const todayIso = localIso(today);

  // ----- Flight-time windows (existing logic) -----
  const windows: CurrencyWindow[] = rules.flightTimeWindows.map((w) => {
    const start = new Date(today);
    start.setDate(start.getDate() - (w.days - 1));
    const startIso = localIso(start);
    let used = 0;
    for (const f of flights) {
      if (f.date >= startIso && f.date <= todayIso) used += Number(f.day_time) + Number(f.night_time);
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
