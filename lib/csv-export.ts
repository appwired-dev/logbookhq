/**
 * CSV exporter: writes flights in a clean, importable column layout so the
 * file round-trips through the legacy Numbers importer (`importCsvText`).
 *
 * Used by:
 *   - Backup ZIP (Settings → Backup now): full snapshot of every flight.
 *
 * Format choice: human-readable headers + one row per flight, with all
 * facts the schema knows about. Times are written as numbers (decimals,
 * one place) and dates as ISO YYYY-MM-DD.
 */
import type { Flight } from "./types";

// Column order MUST stay stable — the round-trip importer in
// import-formats.ts:parseLogbookHQ() reads by header name (case-insensitive),
// so adding new columns to the end is safe and back-compat.
const HEADERS = [
  "date", "make_model", "registration",
  "pic", "copilot", "third_pilot", "check_pilot",
  "route", "remarks",
  "category", "role",
  "day_time", "night_time", "is_xcountry",
  "actual_inst", "hood_inst", "sim_inst", "ifr_approaches",
  "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
  "duty_time",
  // Migration 0009 — traditional logbook fields.
  "precision_approaches", "non_precision_approaches", "holds",
  "cfi_time",
];

function escape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // RFC 4180: quote if cell contains comma, quote, or newline; double-quote inner quotes.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportFlightsCsv(flights: Flight[]): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const f of flights) {
    lines.push([
      f.date,
      f.make_model,
      f.registration ?? "",
      f.pic ?? "", f.copilot ?? "", f.third_pilot ?? "", f.check_pilot ?? "",
      f.route ?? "", f.remarks ?? "",
      f.category, f.role,
      f.day_time, f.night_time, f.is_xcountry ? "1" : "0",
      f.actual_inst, f.hood_inst, f.sim_inst, f.ifr_approaches,
      f.takeoffs_day, f.takeoffs_night, f.landings_day, f.landings_night,
      f.duty_time ?? 0,
      f.precision_approaches ?? 0, f.non_precision_approaches ?? 0, f.holds ?? 0,
      f.cfi_time ?? 0,
    ].map(escape).join(","));
  }
  return lines.join("\n");
}
