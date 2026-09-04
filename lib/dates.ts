/**
 * Local-date helpers. Logbook dates are calendar dates ("2026-09-03"), not
 * instants — parsing them with `new Date("2026-09-03")` yields UTC midnight,
 * which is the previous day in the Americas. Always go through these.
 */

/** "YYYY-MM-DD" → local-midnight Date. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Local-midnight today. */
export function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Whole days from today until `iso` (negative when past). */
export function daysUntil(iso: string): number {
  return Math.round((parseLocalDate(iso).getTime() - today().getTime()) / 86_400_000);
}

export type ExpiryStatus = "bad" | "warn" | "ok";
/** Shared expiry thresholds: already expired → bad, expiring within 30 days (incl. today) → warn, else ok. */
export const EXPIRY_WARN_DAYS = 30;
export function expiryStatus(days: number): ExpiryStatus {
  if (days < 0) return "bad";
  if (days <= EXPIRY_WARN_DAYS) return "warn";
  return "ok";
}
