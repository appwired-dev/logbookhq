import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeTotals } from "@/lib/derive";
import { computeCurrencyForRegime, REGIME_RULES, type Regime } from "@/lib/currency-rules";
import { fetchAllFlights } from "@/lib/fetch-flights";
import AircraftRoleSankey from "@/components/AircraftRoleSankey";
import { getT, getLocale } from "@/lib/i18n-server";
import CalendarHeatmapCard, { type HeatDay } from "@/components/CalendarHeatmapCard";
import type { Locale, TranslationKey } from "@/lib/i18n";
import type { Flight, PilotDocument } from "@/lib/types";
import { daysUntil, expiryStatus, parseLocalDate, today, type ExpiryStatus } from "@/lib/dates";
import {
  Card, CardHeader, Section, PageHeader, StatTile, Pill, rolePill, EmptyState, Icon, buttonClass,
} from "@/components/ui";

/** Regime → translation key for the localised regime display name. */
const REGIME_NAME_KEY: Record<Regime, TranslationKey> = {
  CA: "regime.canada",
  FAA: "regime.usa",
  ICAO: "regime.icao",
  EASA: "regime.europe",
  UKCAA: "regime.uk",
  GCAA: "regime.uae",
  GACA: "regime.saudi",
  QCAA: "regime.qatar",
  HKCAD: "regime.hk",
  CAAC: "regime.china",
};

/** Recency rule key → translation key for the panel label. */
const RECENCY_LABEL_KEY: Record<string, TranslationKey> = {
  "ifr": "recency.ifr",
  "pax-day": "recency.paxDay",
  "pax-night": "recency.paxNight",
};

/** Strings introduced by the console redesign — to be folded into lib/i18n.ts. */
const LOCAL: Record<string, Record<Locale, string>> = {
  recentFlights: { en: "Recent flights", ko: "최근 비행", zh: "最近飞行", es: "Vuelos recientes" },
  viewAll:       { en: "View all", ko: "전체 보기", zh: "查看全部", es: "Ver todos" },
  last30:        { en: "30 d", ko: "30일", zh: "30 天", es: "30 d" },
  over:          { en: "Over", ko: "초과", zh: "超限", es: "Excedido" },
  nearLimit:     { en: "90%+", ko: "90%+", zh: "90%+", es: "90%+" },
  ok:            { en: "OK", ko: "정상", zh: "正常", es: "OK" },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Legacy AUG rows count as SIC (mirrors lib/derive deriveFlight). */
const roleOf = (f: Flight): string => ((f.role as string) === "AUG" ? "SIC" : f.role);

/** Block hours as logged (day + night). */
const blockHours = (f: Flight) => Number(f.day_time) + Number(f.night_time);

/** Block hours under the user's experience convention (SIC at 50% when augHalf). */
const creditedBlockHours = (f: Flight, augHalf: boolean) =>
  augHalf && roleOf(f) === "SIC" ? r1(blockHours(f) * 0.5) : blockHours(f);

/** Instrument hours: actual + hood + sim, always as logged. */
const instrumentHours = (f: Flight) => Number(f.actual_inst) + Number(f.hood_inst) + Number(f.sim_inst);

/**
 * Twelve-month sparkline (oldest → newest, hours per calendar month) plus the
 * hours flown in the last 30 days, for the flights matching `pred`.
 */
function trend(flights: Flight[], pred: (f: Flight) => boolean, hoursOf: (f: Flight) => number) {
  const now = today();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const firstMonth = thisMonth - 11;
  const sparkline = new Array<number>(12).fill(0);
  let delta30 = 0;
  for (const f of flights) {
    if (!pred(f)) continue;
    const h = hoursOf(f);
    const d = parseLocalDate(f.date);
    const idx = d.getFullYear() * 12 + d.getMonth() - firstMonth;
    if (idx >= 0 && idx < 12) sparkline[idx] += h;
    const ago = daysUntil(f.date);
    if (ago <= 0 && ago > -30) delta30 += h;
  }
  return { sparkline: sparkline.map(r1), delta30: r1(delta30) };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_regime, full_name, aug_half_credit")
    .eq("id", user!.id)
    .single();
  const regime = (profile?.primary_regime ?? "CA") as Regime;
  const firstName = (profile?.full_name ?? "").split(" ")[0] || null;

  const all = await fetchAllFlights(supabase);
  const { data: docsRaw } = await supabase
    .from("documents")
    .select("*")
    .not("expires_on", "is", null)
    .order("expires_on", { ascending: true })
    .limit(5);
  const expiringDocs = (docsRaw ?? []) as PilotDocument[];

  const t = await getT();
  const locale = await getLocale();
  const l = (k: keyof typeof LOCAL) => LOCAL[k][locale] ?? LOCAL[k].en;

  if (all.length === 0) {
    return (
      <EmptyState
        icon={Icon.Plane}
        title={t("dash.empty.title")}
        body={t("dash.empty.body")}
        primary={<Link className={buttonClass("primary")} href="/app/flights/new">{t("dash.empty.addFlight")}</Link>}
        secondary={<Link className={buttonClass()} href="/app/import">{t("dash.empty.importCsv")}</Link>}
      />
    );
  }

  const augHalf = Boolean(profile?.aug_half_credit);
  const totals = computeTotals(all, { augHalfCredit: augHalf });
  const currency = computeCurrencyForRegime(all, regime);
  const regimeRules = REGIME_RULES[regime];
  const hrs = t("limits.hrs");

  // Per-day hours for the calendar heatmap — one entry per flying day, so the
  // client gets ~1.5k tiny rows instead of every flight.
  const heatDays: HeatDay[] = (() => {
    const m = new Map<string, number>();
    for (const f of all) m.set(f.date, (m.get(f.date) ?? 0) + Number(f.day_time) + Number(f.night_time));
    return [...m.entries()].map(([date, h]) => ({ date, count: Math.round(h * 10) / 10 }));
  })();

  // Hero trends. Total honours the aug-half convention (like computeTotals);
  // PIC/FO never contain SIC rows; XC and instrument stay as logged.
  const credited = (f: Flight) => creditedBlockHours(f, augHalf);
  const trendTotal = trend(all, () => true, credited);
  const trendPic = trend(all, (f) => roleOf(f) === "PIC", blockHours);
  const trendFo = trend(all, (f) => roleOf(f) === "FO", credited);
  const trendXc = trend(all, (f) => Boolean(f.is_xcountry), blockHours);
  const trendInst = trend(all, (f) => instrumentHours(f) > 0, instrumentHours);
  const delta = (v: number) => ({ value: v, label: l("last30"), unit: hrs });

  // fetchAllFlights returns newest first; sort defensively anyway.
  const recent = [...all]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .slice(0, 5);

  const newFlightLabel = t("flights.new").replace(/^\+\s*/, "");

  return (
    <div className="cascade space-y-6">
      <PageHeader
        title={firstName ? t("dash.welcome", { name: firstName }) : t("dash.title")}
        subtitle={<>
          <span>{t("dash.flightsAndHours", { flights: all.length.toLocaleString(), hours: totals.total_time.toFixed(1) })}</span>
          {augHalf && <span className="text-xs text-ink-3">· {t("dash.augCreditNote")}</span>}
        </>}
        actions={<>
          <Link href="/app/flights/new" className={buttonClass("primary")}>
            <Icon.Plus size={16} strokeWidth={2} aria-hidden />{newFlightLabel}
          </Link>
          <Link href="/app/export" className={buttonClass()}>{t("nav.export")}</Link>
        </>}
      />

      {/* Hero stats — 5 tiles on wide screens (Total · PIC · FO · XC · IFR),
          2 cols on phones, 3 cols on small tablets. */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile variant="hero" accent="brand" label={t("dash.totalTime")} value={totals.total_time} unit={hrs}
                  sparkline={trendTotal.sparkline} delta={delta(trendTotal.delta30)} />
        <StatTile variant="hero" accent="pic" label={t("dash.pic")} value={totals.total_pic} unit={hrs}
                  sparkline={trendPic.sparkline} delta={delta(trendPic.delta30)} />
        <StatTile variant="hero" accent="fo" label={t("dash.fo")} value={totals.total_fo} unit={hrs}
                  sparkline={trendFo.sparkline} delta={delta(trendFo.delta30)} />
        <StatTile variant="hero" accent="good" label={t("dash.crossCountry")} value={totals.xc_total} unit={hrs}
                  sparkline={trendXc.sparkline} delta={delta(trendXc.delta30)} />
        <StatTile variant="hero" accent="warn" label={t("dash.instrument")} value={totals.inst_total} unit={hrs}
                  sparkline={trendInst.sparkline} delta={delta(trendInst.delta30)} />
      </section>

      {/* Secondary stats — always shows the 4 originals + Holds + CFI Time.
          Sea (SES/MES) and Helicopter tiles only render when the pilot
          actually has hours in them, so airline FAA pilots don't see a
          dashboard cluttered with 0.0-hrs categories they never fly. */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile variant="compact" accent="se" label={t("dash.singleEngine")} value={totals.se_total} unit={hrs} />
        <StatTile variant="compact" accent="me" label={t("dash.multiEngine")} value={totals.me_total} unit={hrs} />
        <StatTile variant="compact" accent="neutral" label={t("dash.ifrApproaches")} value={totals.ifr_approaches} decimals={0} />
        <StatTile variant="compact" accent="neutral" label={t("dash.sim")} value={totals.sim_inst} unit={hrs} />
        <StatTile variant="compact" accent="neutral" label={t("dash.holds")} value={totals.total_holds} decimals={0} />
        <StatTile variant="compact" accent="neutral" label={t("dash.cfiTime")} value={totals.total_cfi} unit={hrs} />
        {totals.ses_total > 0 && (
          <StatTile variant="compact" accent="neutral" label={t("dash.ses")} value={totals.ses_total} unit={hrs} />
        )}
        {totals.mes_total > 0 && (
          <StatTile variant="compact" accent="neutral" label={t("dash.mes")} value={totals.mes_total} unit={hrs} />
        )}
        {totals.heli_total > 0 && (
          <StatTile variant="compact" accent="neutral" label={t("dash.heli")} value={totals.heli_total} unit={hrs} />
        )}
      </section>

      {/* Recent flights */}
      {recent.length > 0 && (
        <Card padding="md">
          <CardHeader
            title={l("recentFlights")}
            actions={
              <Link href="/app/flights" className={buttonClass("ghost", "sm")}>
                {l("viewAll")}<Icon.ArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
            }
          />
          <ul className="-mx-2 space-y-0.5">
            {recent.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/app/flights/${f.id}`}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto_3.5rem] sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_auto_3.5rem] items-center gap-3 px-2 py-1.5 rounded-control text-sm text-ink-1 cursor-pointer hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors duration-fast ease-out"
                >
                  <span className="mono text-xs text-ink-2">{f.date}</span>
                  <span className="font-medium truncate">{f.make_model}</span>
                  <span className="mono text-xs text-ink-2 truncate hidden sm:block">{f.route || "—"}</span>
                  <Pill variant={rolePill(f.role)}>{f.role}</Pill>
                  <span className="num text-right">{blockHours(f).toFixed(1)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Document expiry strip (only if any are tracked) */}
      {expiringDocs.length > 0 && (
        <ExpiryStrip docs={expiringDocs}
                     title={t("dash.upcomingExpiries")}
                     manageLabel={t("dash.manage")}
                     daysLabel={(d) => d < 0 ? t("dash.expiredAgo", { days: -d }) : t("dash.daysLeft", { days: d })} />
      )}

      {/* CARs / regime currency + calendar heatmap, side by side near the top */}
      <section className="grid lg:grid-cols-2 gap-3 items-start [&>*]:min-w-0">
        <Card padding="md">
          <CardHeader
            eyebrow={regimeRules.reference}
            title={t("limits.title", { regime: t(REGIME_NAME_KEY[regime]) })}
            meta={<span className="mono">{currency.today}</span>}
          />
          <div className="space-y-3">
            {currency.windows.map((w) => {
              const overshoot = w.pct >= 100;
              const warn = w.pct >= 90;
              const fillCls = overshoot ? "bar-fill-bad" : warn ? "bar-fill-warn" : "bar-fill-good";
              const label = t("limits.lastDays", { n: w.days });
              return (
                <div key={w.label}>
                  <div className="flex justify-between items-baseline gap-3 text-sm mb-1">
                    <div className="min-w-0">
                      <span className="font-medium text-ink-1">{label}</span>
                      <span className="text-ink-3 ml-2 text-xs">{t("limits.since", { date: w.start_date })}</span>
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="num">
                        <span className="font-semibold text-ink-1">{w.used.toFixed(1)}</span>
                        <span className="text-ink-3"> / {w.max} {hrs}</span>
                      </span>
                      <Pill variant={overshoot ? "bad" : warn ? "warn" : "good"}>
                        {overshoot ? l("over") : warn ? l("nearLimit") : l("ok")}
                      </Pill>
                    </div>
                  </div>
                  <div
                    className="bar-track h-1.5 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={w.max}
                    aria-valuenow={w.used}
                    aria-label={label}
                  >
                    <div className={`h-full rounded-full bar-fill ${fillCls}`} style={{ width: `${Math.min(100, w.pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <CalendarHeatmapCard days={heatDays} locale={locale} />
      </section>

      {/* Recency (IFR + Day-PAX + Night-PAX) */}
      <Card padding="lg">
        <CardHeader eyebrow={regimeRules.authority} title={t("recency.title")} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {currency.recency.map((r) => {
            // Recency semantics (unchanged from main): red only when NOT current;
            // amber when current but expiring within 14 days; green otherwise.
            const status: ExpiryStatus = !r.current
              ? "bad"
              : (r.daysUntilExpiry != null && r.daysUntilExpiry <= 14 ? "warn" : "ok");
            const tone = STATUS_TONE[status];
            const pct = Math.min(100, (r.achieved / r.required) * 100);
            return (
              <div key={r.key} className={`rounded-control border p-3 ${tone.box}`}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-ink-1">{t(RECENCY_LABEL_KEY[r.key] ?? "recency.title")}</h3>
                  <Pill variant={tone.pill}>{r.current ? t("recency.current") : t("recency.notCurrent")}</Pill>
                </div>
                <div className="text-xs text-ink-3 mb-2 mono">{r.citation}</div>
                <div className="text-xs text-ink-2 mb-1.5 num">
                  {t("recency.progress", { achieved: r.achieved, required: r.required, days: r.windowDays })}
                </div>
                <div
                  className="bar-track h-1.5 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={r.required}
                  aria-valuenow={r.achieved}
                  aria-label={t(RECENCY_LABEL_KEY[r.key] ?? "recency.title")}
                >
                  <div className={`h-full rounded-full bar-fill ${tone.fill}`} style={{ width: `${pct}%` }} />
                </div>
                {r.current && r.daysUntilExpiry != null && (
                  <div className={`mt-1.5 text-2xs font-medium ${tone.text}`}>
                    {t("recency.expiresIn", { days: r.daysUntilExpiry })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Breakdowns */}
      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Breakdown title={t("dash.singleEngine")} rows={[
          [t("bd.dualDay"), totals.se_dual_day], [t("bd.picDay"), totals.se_pic_day], [t("bd.dayTotal"), totals.se_day, true],
          [t("bd.dualNight"), totals.se_dual_night], [t("bd.picNight"), totals.se_pic_night], [t("bd.nightTotal"), totals.se_night, true],
          [t("bd.seTotal"), totals.se_total, true],
        ]} />
        <Breakdown title={t("dash.multiEngine")} rows={[
          [t("bd.dualDay"), totals.me_dual_day], [t("bd.picDay"), totals.me_pic_day],
          [t("bd.foDay"), totals.me_fo_day],
          [t("bd.soDay"), totals.me_sic_day], [t("bd.checkDay"), totals.me_check_day],
          [t("bd.dayTotal"), totals.me_day, true],
          [t("bd.dualNight"), totals.me_dual_night], [t("bd.picNight"), totals.me_pic_night],
          [t("bd.foNight"), totals.me_fo_night],
          [t("bd.soNight"), totals.me_sic_night], [t("bd.checkNight"), totals.me_check_night],
          [t("bd.nightTotal"), totals.me_night, true],
          [t("bd.meTotal"), totals.me_total, true],
        ]} />
        <Breakdown title={t("bd.crossCountry")} rows={[
          [t("bd.day"), totals.xc_day], [t("bd.night"), totals.xc_night],
          [t("bd.byRoleDual"), totals.xc_dual], [t("bd.byRolePic"), totals.xc_pic],
          [t("bd.byRoleFo"), totals.xc_fo],
          [t("bd.byRoleSo"), totals.xc_sic], [t("bd.byRoleCheck"), totals.xc_check],
          [t("bd.xcTotal"), totals.xc_total, true],
        ]} />
        <Breakdown title={t("bd.instrument")} rows={[
          [t("bd.actual"), totals.actual_inst], [t("bd.hood"), totals.hood_inst],
          [t("bd.sim"), totals.sim_inst], [t("bd.approaches"), totals.ifr_approaches],
          [t("bd.instTotal"), totals.inst_total, true],
        ]} />
      </section>

      {/* By-aircraft-type */}
      <Section
        title={t("dash.timeByAircraft")}
        actions={
          <div className="flex items-center gap-3 text-2xs uppercase tracking-[0.08em] text-ink-2 flex-wrap">
            <LegendDot color="bg-role-pic" label={t("dash.pic")} />
            <LegendDot color="bg-role-fo" label={t("role.fo")} />
            <LegendDot color="bg-role-dual" label={t("role.dual")} />
            <LegendDot color="bg-role-sic" label={t("role.so")} />
            <LegendDot color="bg-role-check" label={t("role.check")} />
          </div>
        }
      >
        <Card padding="lg">
          <AircraftRoleSankey
            byTypeRole={totals.by_type_role}
            roleLabels={{ PIC: t("dash.pic"), FO: t("role.fo"), DUAL: t("role.dual"), SIC: t("role.so"), CHECK: t("role.check") }} />
        </Card>
      </Section>
    </div>
  );
}

/** Full class strings per status so Tailwind's purge keeps every variant. */
const STATUS_TONE: Record<ExpiryStatus, { box: string; text: string; fill: string; pill: "good" | "warn" | "bad" }> = {
  ok:   { box: "bg-good/10 border-good/30", text: "text-good-ink", fill: "bar-fill-good", pill: "good" },
  warn: { box: "bg-warn/10 border-warn/30", text: "text-warn-ink", fill: "bar-fill-warn", pill: "warn" },
  bad:  { box: "bg-bad/10 border-bad/30",   text: "text-bad-ink",  fill: "bar-fill-bad",  pill: "bad" },
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function ExpiryStrip({ docs, title, manageLabel, daysLabel }: {
  docs: PilotDocument[];
  title: string;
  manageLabel: string;
  daysLabel: (days: number) => string;
}) {
  return (
    <Card padding="md">
      <CardHeader
        title={title}
        actions={<Link href="/app/documents" className={buttonClass("ghost", "sm")}>{manageLabel}</Link>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {docs.map((d) => {
          // Page query filters out null expires_on, so non-null assertion is
          // safe here.
          const days = daysUntil(d.expires_on!);
          const tone = STATUS_TONE[expiryStatus(days)];
          return (
            <div key={d.id} className={`rounded-control border px-3 py-2 text-sm flex items-center justify-between gap-3 ${tone.box}`}>
              <div className="min-w-0">
                <div className="font-semibold text-ink-1 truncate">{d.name}</div>
                <div className="text-2xs uppercase tracking-wider text-ink-3">{d.doc_type.replace("_", " ")}</div>
              </div>
              <div className={`text-xs font-semibold whitespace-nowrap num ${tone.text}`}>
                {daysLabel(days)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Breakdown({ title, rows }: {
  title: string;
  rows: ([string, number] | [string, number, boolean])[];
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-4 pt-3 border-b border-border">
        <CardHeader title={title} />
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => {
            const [k, v, emph] = row as [string, number, boolean | undefined];
            return (
              <tr key={k} className={`border-b border-border/60 last:border-0 ${emph ? "bg-surface-2/60" : ""}`}>
                <td className={`px-4 py-1.5 ${emph ? "font-semibold text-ink-1" : "text-ink-2"}`}>{k}</td>
                <td className={`px-4 py-1.5 text-right num ${emph ? "font-semibold text-ink-1" : "font-medium text-ink-1"}`}>{v.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
