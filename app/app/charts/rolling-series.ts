import { flightTimeInWindow } from "@/lib/currency-rules";
import { parseLocalDate } from "@/lib/dates";
import type { Flight } from "@/lib/types";

const r1 = (n: number) => Math.round(n * 10) / 10;
function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The dashboard limits card's 365-day window (basis defaults to rolling days). */
const ROLLING_YEAR = { days: 365 };

/**
 * Points for the charts page's rolling 365-day line: one per month, starting a
 * year after the first flight, each the flight time in the 365 days ending on
 * the 1st of that month.
 *
 * The window and the sum are the dashboard's own (lib/currency-rules
 * `flightTimeInWindow`): 365 calendar dates inclusive at both ends, simulator
 * sessions never counted. A line drawn on any other window would contradict
 * the limits card, and the ceiling it is read against, by up to a day's flying.
 */
export function rollingFlightTimeSeries(flights: Flight[]): { date: string; hours: number }[] {
  if (flights.length === 0) return [];
  const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
  // Local calendar dates, not `new Date(iso)` (UTC midnight — the previous
  // day in the Americas, which shifted the series a month at either edge).
  const first = parseLocalDate(sorted[0].date);
  const last = parseLocalDate(sorted[sorted.length - 1].date);
  const points: { date: string; hours: number }[] = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  cursor.setMonth(cursor.getMonth() + 12);
  while (cursor <= last) {
    const hours = flightTimeInWindow(sorted, ROLLING_YEAR, cursor);
    points.push({ date: iso(cursor).slice(0, 7), hours: r1(hours) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}
