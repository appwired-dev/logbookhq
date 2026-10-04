import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { parseTrafficReport, utcDays, windowStartUTC, todayElapsedFraction } from "@/lib/site-stats-core";
import { requireAdminPage } from "../admin-gate";
import TrafficPanel, { type SignupStats } from "./TrafficPanel";
import { buildDailySeries, parseRange } from "./traffic-model";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * Admin · Traffic (`/app/admin/traffic?range=7|30|90`, default 30).
 *
 * One traffic_report() RPC (daily totals only — first-party, cookieless; see
 * supabase/migrations/0021) plus the signup counts, all with the service role
 * after the admin gate. Windows are computed from the database's UTC "today"
 * so they line up with the SQL. Every diagram on the page is interactive on
 * this one payload; nothing is fetched from the browser.
 */
export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  await requireAdminPage();
  const range = parseRange((await searchParams).range);

  const admin = createAdminClient();
  // The audit lookback is generous (server clock, +1 day); rows are filtered to the DB window below.
  const auditSince = new Date(Date.now() - (range + 1) * DAY_MS).toISOString();
  const [reportRes, usersRes, auditRes, locale] = await Promise.all([
    admin.rpc("traffic_report", { p_days: range }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("admin_audit_log")
      .select("created_at")
      .eq("action", "user.create")
      .gte("created_at", auditSince)
      .limit(1000),
    getLocale(),
  ]);

  const report = parseTrafficReport(reportRes.error ? null : reportRes.data, range);
  const series = buildDailySeries(report, range);

  // Signups: auth.users.created_at inside [curStart, now) vs [prevStart, curStart).
  const curStart = Date.parse(windowStartUTC(report.today, range));
  const prevStart = Date.parse(windowStartUTC(report.today, 2 * range));
  const dayIndex = new Map(utcDays(report.today, range).map((d, i) => [d, i] as const));
  const signups: SignupStats = { current: 0, previous: 0, adminCreated: 0, daily: new Array<number>(range).fill(0) };
  for (const u of usersRes.data?.users ?? []) {
    const t = Date.parse(u.created_at ?? "");
    if (!Number.isFinite(t)) continue;
    if (t >= curStart) {
      signups.current++;
      const i = dayIndex.get(new Date(t).toISOString().slice(0, 10));
      if (i !== undefined) signups.daily[i]++;
    } else if (t >= prevStart) {
      signups.previous++;
    }
  }
  for (const row of (auditRes.data ?? []) as { created_at: string }[]) {
    if (Date.parse(row.created_at) >= curStart) signups.adminCreated++;
  }

  return (
    <TrafficPanel
      locale={locale}
      range={range}
      report={report}
      series={series}
      signups={signups}
      elapsed={todayElapsedFraction(report.today, Date.now())}
      // The admin-created note is best-effort; only the report and signups count as a failure.
      failed={!!(reportRes.error || usersRes.error)}
      statsEnabled={process.env.NEXT_PUBLIC_STATS_ENABLED === "1"}
    />
  );
}
