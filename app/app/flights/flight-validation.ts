/**
 * Pure form-state helpers for the flight form: string-backed numeric fields
 * (so "1," and ".5" survive typing), tolerant parsing (comma decimals),
 * client-side validation and the live summary. No React, no I/O.
 */
import type { Category, FlightInput, Role } from "@/lib/types";

export const HOUR_FIELDS = [
  "day_time", "night_time", "actual_inst", "hood_inst", "sim_inst", "cfi_time", "duty_time",
] as const;
export const COUNT_FIELDS = [
  "ifr_approaches", "precision_approaches", "non_precision_approaches", "holds",
  "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
] as const;

export type HourField = (typeof HOUR_FIELDS)[number];
export type CountField = (typeof COUNT_FIELDS)[number];
export type NumericField = HourField | CountField;
export type TextField =
  | "make_model" | "registration" | "pic" | "copilot" | "third_pilot" | "check_pilot" | "route" | "remarks";

/** What the form edits. Numbers are strings until submit; nullable text is "". */
export type FlightFormValues = Record<TextField, string> & Record<NumericField, string> & {
  date: string;
  category: Category;
  role: Role;
  is_xcountry: boolean;
};

/** Same option sets as the previous <select>s and the server-side validator. */
export const CATEGORIES: readonly Category[] = ["SE", "ME", "SES", "MES", "HELI", "SIM"];
export const ROLES: readonly Role[] = ["PIC", "DUAL", "FO", "SIC", "CHECK"];

export const MAX_HOURS = 24;
export const MAX_COUNT = 999;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** "" → 0, "1,5" → 1.5, "1." → 1, ".5" → 0.5; anything else → null. */
export function parseHours(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return 0;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "" → 0, "12" → 12; decimals, signs or letters → null. */
export function parseCount(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return 0;
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/** Hours for an input: one decimal, blank for zero (the placeholder shows 0.0). */
export function formatHours(n: number): string {
  return n > 0 ? r1(n).toFixed(1) : "";
}

/** Counts for an input: integer string, blank for zero. */
export function formatCount(n: number): string {
  return n > 0 ? String(Math.trunc(n)) : "";
}

/** Blur normalisation: comma → dot, one decimal. Invalid text is left for validation to flag. */
export function normaliseHours(raw: string): string {
  const n = parseHours(raw);
  return n === null ? raw.trim() : formatHours(n);
}

export function normaliseCount(raw: string): string {
  const n = parseCount(raw);
  return n === null ? raw.trim() : formatCount(n);
}

function numericStrings(src: Partial<Record<NumericField, number | string | null>>): Record<NumericField, string> {
  const out = {} as Record<NumericField, string>;
  for (const k of HOUR_FIELDS) out[k] = formatHours(Number(src[k] ?? 0));
  for (const k of COUNT_FIELDS) out[k] = formatCount(Number(src[k] ?? 0));
  return out;
}

/** New-flight defaults. `date` stays "" so the client can fill in its local today. */
export function blankFlightValues(): FlightFormValues {
  return {
    date: "",
    make_model: "", registration: "", pic: "", copilot: "", third_pilot: "", check_pilot: "", route: "", remarks: "",
    category: "SE", role: "PIC", is_xcountry: false,
    ...numericStrings({ takeoffs_day: 1, landings_day: 1 }),
  };
}

export function flightToValues(f: FlightInput): FlightFormValues {
  const str = (x: string | null | undefined) => x ?? "";
  return {
    date: f.date ?? "",
    make_model: str(f.make_model),
    registration: str(f.registration),
    pic: str(f.pic),
    copilot: str(f.copilot),
    third_pilot: str(f.third_pilot),
    check_pilot: str(f.check_pilot),
    route: str(f.route),
    remarks: str(f.remarks),
    category: f.category,
    role: f.role,
    is_xcountry: !!f.is_xcountry,
    ...numericStrings(f),
  };
}

/** Form values → server payload. Blank text becomes null; registration and route are upper-cased. */
export function valuesToFlightInput(v: FlightFormValues): FlightInput {
  const text = (x: string) => {
    const y = x.trim();
    return y ? y : null;
  };
  const hours = (k: HourField) => r1(parseHours(v[k]) ?? 0);
  const count = (k: CountField) => parseCount(v[k]) ?? 0;
  return {
    date: v.date,
    make_model: v.make_model.trim(),
    registration: text(v.registration.toUpperCase()),
    pic: text(v.pic),
    copilot: text(v.copilot),
    third_pilot: text(v.third_pilot),
    check_pilot: text(v.check_pilot),
    route: text(v.route.toUpperCase()),
    remarks: text(v.remarks),
    category: v.category,
    role: v.role,
    is_xcountry: v.is_xcountry,
    day_time: hours("day_time"),
    night_time: hours("night_time"),
    actual_inst: hours("actual_inst"),
    hood_inst: hours("hood_inst"),
    sim_inst: hours("sim_inst"),
    cfi_time: hours("cfi_time"),
    duty_time: hours("duty_time"),
    ifr_approaches: count("ifr_approaches"),
    precision_approaches: count("precision_approaches"),
    non_precision_approaches: count("non_precision_approaches"),
    holds: count("holds"),
    takeoffs_day: count("takeoffs_day"),
    takeoffs_night: count("takeoffs_night"),
    landings_day: count("landings_day"),
    landings_night: count("landings_night"),
  };
}

export type ErrorKey =
  | "required" | "invalidDate" | "futureDate" | "enterSomeTime"
  | "invalidNumber" | "maxHours" | "wholeNumber" | "maxCount";

export type FieldErrors = Partial<Record<keyof FlightFormValues, ErrorKey>>;

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Client-side validation. `today` is the client's local "YYYY-MM-DD" ("" on
 * the server, which skips the future-date check). The "some time" rule lands
 * on day_time so it has a home in the UI.
 */
export function validateFlightValues(v: FlightFormValues, today: string): FieldErrors {
  const e: FieldErrors = {};

  if (!v.date) e.date = "required";
  else if (!isValidISODate(v.date)) e.date = "invalidDate";
  else if (today && v.date > today) e.date = "futureDate";

  if (!v.make_model.trim()) e.make_model = "required";
  if (!CATEGORIES.includes(v.category)) e.category = "required";
  if (!ROLES.includes(v.role)) e.role = "required";

  for (const k of HOUR_FIELDS) {
    const n = parseHours(v[k]);
    if (n === null) e[k] = "invalidNumber";
    else if (n > MAX_HOURS) e[k] = "maxHours";
  }
  for (const k of COUNT_FIELDS) {
    const n = parseCount(v[k]);
    if (n === null) e[k] = "wholeNumber";
    else if (n > MAX_COUNT) e[k] = "maxCount";
  }

  if (!e.day_time && !e.night_time && !e.sim_inst) {
    const logged = (parseHours(v.day_time) ?? 0) + (parseHours(v.night_time) ?? 0) + (parseHours(v.sim_inst) ?? 0);
    if (logged <= 0) e.day_time = "enterSomeTime";
  }
  return e;
}

export type FlightSummary = {
  /** day + night, one decimal (SIC half-credit is a totals convention, not applied here). */
  total: number;
  night: number;
  instrument: number;
  approaches: number;
  xc: boolean;
  /** Soft warning: actual + hood instrument exceeds the block time. */
  instrumentExceeds: boolean;
};

export function summariseFlight(v: FlightFormValues): FlightSummary {
  const h = (k: HourField) => parseHours(v[k]) ?? 0;
  const day = h("day_time");
  const night = h("night_time");
  const inAircraftInst = h("actual_inst") + h("hood_inst");
  return {
    total: r1(day + night),
    night: r1(night),
    instrument: r1(inAircraftInst + h("sim_inst")),
    approaches: parseCount(v.ifr_approaches) ?? 0,
    xc: v.is_xcountry,
    instrumentExceeds: r1(inAircraftInst) > r1(day + night),
  };
}
