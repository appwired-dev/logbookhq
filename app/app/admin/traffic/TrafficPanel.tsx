import Link from "next/link";
import LinkPending from "../LinkPending";
import type { Locale } from "@/lib/i18n";
import { DAILY_VIEW_CEILING, SMALL_BASE, ratePctChange, type TrafficReport } from "@/lib/site-stats-core";
import StatsOptOut from "@/components/StatsOptOut";
import { Alert, Card, CardHeader, Icon, PageHeader, StatTile } from "@/components/ui";
import { adminOpsStrings, type AdminOpsT } from "../admin-ops-strings";
import DiagramEmpty from "./DiagramEmpty";
import FlowExplorer from "./FlowExplorer";
import GeoExplorer from "./GeoExplorer";
import ShareList from "./ShareList";
import TrafficChartLazy from "./TrafficChartLazy";
import {
  RANGES, byVisits, campaignText, dayFormatter, deviceText, dimRows, flowRows, intFormatter, share,
  shareFormatter, type DailyPoint, type Range,
} from "./traffic-model";

export type SignupStats = {
  /** Accounts created in the current window. */
  current: number;
  /** Accounts created in the window before it. */
  previous: number;
  /** Of `current`, how many an admin created (from the audit log). */
  adminCreated: number;
  /** Per UTC day of the current window, oldest first. */
  daily: number[];
};

/**
 * Admin · Traffic, rendered on the server from one traffic_report() payload.
 * Static parts (tiles, alerts, devices, campaigns, the sr-only day table) are
 * server-rendered; the diagrams are lazy client islands that work on the same
 * payload — no client fetches of traffic data.
 */
export default function TrafficPanel({ locale, range, report, series, signups, failed, statsEnabled, elapsed }: {
  locale: Locale;
  range: Range;
  report: TrafficReport;
  series: DailyPoint[];
  signups: SignupStats;
  /** Fraction of today (UTC) elapsed when the report was read — for rate-based deltas. */
  elapsed: number;
  failed: boolean;
  statsEnabled: boolean;
}) {
  const o = adminOpsStrings(locale);
  const nf = intFormatter(locale);
  const pct = shareFormatter(locale);
  const longDay = dayFormatter(locale, { weekday: "short", month: "short", day: "numeric" });

  const { totals, previous } = report;
  const visits = totals.landings;
  const views = totals.views;
  const vsPrev = o("vsPrev", { days: range });
  // Rate-based: the current window is still filling today, the previous one is complete.
  const delta = (cur: number, prev: number) => {
    const p = ratePctChange(cur, prev, range, elapsed);
    return p === null ? undefined : { value: p, unit: "%", label: vsPrev };
  };
  const rate = visits >= SMALL_BASE ? (signups.current / visits) * 100 : null;
  const dailyRate = series.map((d, i) => (d.visits > 0 ? ((signups.daily[i] ?? 0) / d.visits) * 100 : 0));

  const empty = series.every((d) => d.visits === 0 && d.views === 0 && d.prevVisits === 0);
  const capped = report.capped_days.map((d) => dayFormatter(locale, { month: "short", day: "numeric", year: "numeric" })(d));

  const devices = dimRows(report, "device").sort(byVisits);
  const campaigns = dimRows(report, "campaign").sort(byVisits);

  return (
    <div className="space-y-4">
      <PageHeader title={o("trafficTitle")} subtitle={o("trafficSubtitle")} />

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <RangeNav range={range} o={o} />
        <StatsOptOut label={o("optOut")} onText={o("optOutOn")} offText={o("optOutOff")} signalText={o("optOutSignal")} className="min-w-0" />
      </div>

      {failed && <Alert variant="bad">{o("errGeneric")}</Alert>}
      {!statsEnabled && <Alert variant="info">{o("trackingOff")}</Alert>}
      {capped.length > 0 && (
        <Alert variant="warn">{o("ceilingHit", { days: listFormat(locale, capped), max: nf(DAILY_VIEW_CEILING) })}</Alert>
      )}

      <div>
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            variant="compact" accent="brand" label={o("statVisits")} value={visits} decimals={0}
            delta={delta(visits, previous.landings)} sparkline={series.map((d) => d.visits)}
          />
          <StatTile
            variant="compact" accent="neutral" label={o("statViews")} value={views} decimals={0}
            delta={delta(views, previous.views)} sparkline={series.map((d) => d.views)}
          />
          <StatTile
            variant="compact" accent="good" label={o("statSignups")} value={signups.current} decimals={0}
            delta={delta(signups.current, signups.previous)} sparkline={signups.daily}
          />
          {rate !== null ? (
            <StatTile
              variant="compact" accent="pic" label={o("statSignupRate")} value={rate} decimals={1} unit="%"
              sparkline={dailyRate}
            />
          ) : (
            <SmallBaseTile label={o("statSignupRate")} note={o("rateSmallBase")} />
          )}
        </section>
        {signups.adminCreated > 0 && (
          <p className="mt-2 text-2xs text-ink-3">{o("adminCreatedNote", { n: nf(signups.adminCreated) })}</p>
        )}
      </div>

      <Card padding="md" className="chart-card min-w-0 overflow-hidden">
        <CardHeader title={o("chartTitle")} meta={o("rangeDays", { days: range })} />
        {empty ? (
          <DiagramEmpty icon={Icon.Activity} text={o("trafficEmpty")} className="h-56" />
        ) : (
          <>
            {/* Legend (44 px targets, may wrap on phones) + the h-56 plot: reserved so the lazy chart lands without a shift. */}
            <div className="min-h-[20.5rem] sm:min-h-[16.5rem]">
              <TrafficChartLazy data={series} days={range} locale={locale} />
            </div>
            {/* sr-only on a wrapper: a <table> ignores width:1px and would widen the page. */}
            <div className="sr-only">
              <table>
                <caption>{o("chartAria", { days: range })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{o("colDay")}</th>
                    <th scope="col">{o("statVisits")}</th>
                    <th scope="col">{o("statViews")}</th>
                    <th scope="col">{o("chartPrevVisits")}</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((d) => (
                    <tr key={d.day}>
                      <th scope="row">{longDay(d.day)}</th>
                      <td>{nf(d.visits)}</td>
                      <td>{nf(d.views)}</td>
                      <td>{nf(d.prevVisits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <FlowExplorer
        flows={flowRows(report)}
        sources={dimRows(report, "source")}
        pages={dimRows(report, "page")}
        totalVisits={visits}
        totalViews={views}
        locale={locale}
      />

      <GeoExplorer countries={dimRows(report, "country")} totalVisits={visits} locale={locale} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ShareList
          title={o("topDevices")}
          rows={devices.map((d) => ({
            key: d.value, label: deviceText(d.value, o), visits: d.visits, share: share(d.visits, visits),
          }))}
          labelHeader={o("colDevice")}
          visitsHeader={o("statVisits")}
          shareHeader={o("colShare")}
          emptyText={o("trafficEmpty")}
          fmtInt={nf}
          fmtShare={pct}
          barColor="rgb(var(--chart-4))"
        />
        {campaigns.length > 0 && (
          <ShareList
            title={o("topCampaigns")}
            rows={campaigns.map((c) => ({
              key: c.value, label: campaignText(c.value, o), visits: c.visits, share: share(c.visits, visits),
            }))}
            labelHeader={o("colCampaign")}
            visitsHeader={o("statVisits")}
            shareHeader={o("colShare")}
            emptyText={o("trafficEmpty")}
            fmtInt={nf}
            fmtShare={pct}
            barColor="rgb(var(--chart-3))"
          />
        )}
      </div>

      <footer className="space-y-1 text-2xs text-ink-3 max-w-3xl">
        <p>{o("trafficNote")}</p>
        <p>{o("signupsNote")}</p>
      </footer>
    </div>
  );
}

/** ?range=7|30|90 as server links, styled like FlightsToolbar's segmented control. */
function RangeNav({ range, o }: { range: Range; o: AdminOpsT }) {
  return (
    <nav aria-label={o("rangeLabel")}>
      <ul className="inline-flex h-11 md:h-9 items-stretch rounded-control border border-border bg-surface p-0.5 shadow-sm">
        {RANGES.map((r) => {
          const active = r === range;
          return (
            <li key={r} className="flex">
              <Link
                href={`/app/admin/traffic?range=${r}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-w-[2.75rem] items-center justify-center px-3 rounded-[calc(var(--r-control)_-_3px)] text-xs font-medium whitespace-nowrap select-none
                  transition-colors duration-fast motion-reduce:transition-none
                  focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand/60
                  ${active ? "bg-surface-inverse text-ink-inverse shadow-sm" : "text-ink-2 hover:text-ink-1 hover:bg-surface-2"}`}
              >
                <LinkPending>{o("rangeDays", { days: r })}</LinkPending>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Signup rate below SMALL_BASE visits: same chrome as a compact StatTile, no number. */
function SmallBaseTile({ label, note }: { label: string; note: string }) {
  return (
    <div className="card relative overflow-hidden p-3.5" style={{ ["--accent" as string]: "rgb(var(--role-pic))" }}>
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: "var(--accent)" }} />
      <div className="pl-2">
        <div className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-2">{label}</div>
        <div className="mt-1 text-xl font-semibold text-ink-3" aria-hidden>—</div>
        <div className="mt-1 text-2xs text-ink-3">{note}</div>
      </div>
    </div>
  );
}

function listFormat(locale: string, items: string[]): string {
  try {
    return new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}
