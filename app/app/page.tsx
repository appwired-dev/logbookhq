import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeTotals } from "@/lib/derive";
import { computeCurrencyForRegime, REGIME_RULES, type Regime } from "@/lib/currency-rules";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { CountUp } from "@/components/CountUp";
import AircraftRoleSankey from "@/components/AircraftRoleSankey";
import { getT } from "@/lib/i18n-server";
import type { TranslationKey } from "@/lib/i18n";
import type { PilotDocument } from "@/lib/types";

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

  if (all.length === 0) return <EmptyState />;

  const augHalf = Boolean(profile?.aug_half_credit);
  const totals = computeTotals(all, { augHalfCredit: augHalf });
  const currency = computeCurrencyForRegime(all, regime);
  const regimeRules = REGIME_RULES[regime];
  const t = await getT();

  return (
    <div className="cascade space-y-7">
      {/* Greeting + meta */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {firstName ? t("dash.welcome", { name: firstName }) : t("dash.title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {t("dash.flightsAndHours", { flights: all.length.toLocaleString(), hours: totals.total_time.toFixed(1) })}
            </span>
            {augHalf && <span className="ml-2 text-xs text-slate-400">· {t("dash.augCreditNote")}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/flights/new" className="btn btn-primary">{t("flights.new")}</Link>
          <Link href="/app/export" className="btn">{t("nav.export")}</Link>
        </div>
      </div>

      {/* Hero stats — 5 tiles on wide screens (Total · PIC · FO · XC · IFR),
          2 cols on phones, 3 cols on small tablets. */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <HeroStat label={t("dash.totalTime")} value={totals.total_time} hrsLabel={t("limits.hrs")}
                  gradient="bg-gradient-aviation"
                  shadow="shadow-[0_8px_32px_rgba(7,89,133,0.35)]"
                  accent="text-sky-200" orbColor="bg-sky-400/30" />
        <HeroStat label={t("dash.pic")} value={totals.total_pic} hrsLabel={t("limits.hrs")}
                  gradient="bg-gradient-to-br from-blue-400 to-blue-800"
                  shadow="shadow-[0_8px_32px_rgba(59,130,246,0.40)]"
                  accent="text-blue-100" orbColor="bg-blue-300/40" />
        <HeroStat label={t("dash.fo")} value={totals.total_fo} hrsLabel={t("limits.hrs")}
                  gradient="bg-gradient-to-br from-violet-400 to-violet-800"
                  shadow="shadow-[0_8px_32px_rgba(139,92,246,0.40)]"
                  accent="text-violet-100" orbColor="bg-violet-300/40" />
        <HeroStat label={t("dash.crossCountry")} value={totals.xc_total} hrsLabel={t("limits.hrs")}
                  gradient="bg-gradient-to-br from-[#c8a882] to-[#6f4e37]"
                  shadow="shadow-[0_8px_32px_rgba(111,78,55,0.42)]"
                  accent="text-amber-50/90" orbColor="bg-amber-200/35" />
        <HeroStat label={t("dash.instrument")} value={totals.inst_total} hrsLabel={t("limits.hrs")}
                  gradient="bg-gradient-to-br from-orange-400 to-orange-700"
                  shadow="shadow-[0_8px_32px_rgba(249,115,22,0.40)]"
                  accent="text-orange-100" orbColor="bg-orange-300/40" />
      </section>

      {/* Secondary stats — always shows the 4 originals + Holds + CFI Time.
          Sea (SES/MES) and Helicopter tiles only render when the pilot
          actually has hours in them, so airline FAA pilots don't see a
          dashboard cluttered with 0.0-hrs categories they never fly. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("dash.singleEngine")} value={totals.se_total} hrsLabel={t("limits.hrs")} />
        <Stat label={t("dash.multiEngine")} value={totals.me_total} hrsLabel={t("limits.hrs")} />
        <Stat label={t("dash.ifrApproaches")} value={totals.ifr_approaches} integer />
        <Stat label={t("dash.sim")} value={totals.sim_inst} hrsLabel={t("limits.hrs")} />
        <Stat label={t("dash.holds")} value={totals.total_holds} integer />
        <Stat label={t("dash.cfiTime")} value={totals.total_cfi} hrsLabel={t("limits.hrs")} />
        {totals.ses_total > 0 && (
          <Stat label={t("dash.ses")} value={totals.ses_total} hrsLabel={t("limits.hrs")} />
        )}
        {totals.mes_total > 0 && (
          <Stat label={t("dash.mes")} value={totals.mes_total} hrsLabel={t("limits.hrs")} />
        )}
        {totals.heli_total > 0 && (
          <Stat label={t("dash.heli")} value={totals.heli_total} hrsLabel={t("limits.hrs")} />
        )}
      </section>

      {/* Document expiry strip (only if any are tracked) */}
      {expiringDocs.length > 0 && (
        <ExpiryStrip docs={expiringDocs}
                     title={t("dash.upcomingExpiries")}
                     manageLabel={t("dash.manage")}
                     daysLabel={(d) => d < 0 ? t("dash.expiredAgo", { days: -d }) : t("dash.daysLeft", { days: d })} />
      )}

      {/* CARs / regime currency */}
      <section className="card card-hover p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-600/90">{regimeRules.reference}</div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t("limits.title", { regime: t(REGIME_NAME_KEY[regime]) })}</h2>
          </div>
          <div className="text-xs text-slate-500 tabular-nums font-mono">{currency.today}</div>
        </div>
        <div className="space-y-5">
          {currency.windows.map((w, i) => {
            const overshoot = w.pct >= 100;
            const warn = w.pct >= 90;
            const fillCls = overshoot ? "bar-fill-bad" : warn ? "bar-fill-warn" : "bar-fill-good";
            return (
              <div key={w.label} style={{ animationDelay: `${0.05 * i}s` }} className="animate-[fadeUp_0.5s_ease-out_both]">
                <div className="flex justify-between items-baseline text-sm mb-1.5">
                  <div>
                    <span className="font-semibold text-slate-800">{t("limits.lastDays", { n: w.days })}</span>
                    <span className="text-slate-400 ml-2 text-xs">{t("limits.since", { date: w.start_date })}</span>
                  </div>
                  <div className="tabular-nums">
                    <span className="font-bold text-slate-900 text-lg">{w.used.toFixed(1)}</span>
                    <span className="text-slate-400 text-sm"> / {w.max} {t("limits.hrs")}</span>
                    <span className={`ml-2 text-xs font-semibold ${overshoot ? "text-rose-600" : warn ? "text-amber-600" : "text-emerald-600"}`}>
                      {w.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="bar-track h-2.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${fillCls} bar-shimmer transition-all duration-1000 ease-out`}
                       style={{ width: `${Math.min(100, w.pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recency (IFR + Day-PAX + Night-PAX) */}
      <section className="card card-hover p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-600/90">{regimeRules.authority}</div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t("recency.title")}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {currency.recency.map((r) => {
            const ringCls = r.current
              ? (r.daysUntilExpiry != null && r.daysUntilExpiry <= 14
                  ? "border-amber-300 bg-amber-50/60"
                  : "border-emerald-300 bg-emerald-50/60")
              : "border-rose-300 bg-rose-50/60";
            const labelCls = r.current
              ? (r.daysUntilExpiry != null && r.daysUntilExpiry <= 14 ? "text-amber-700" : "text-emerald-700")
              : "text-rose-700";
            const pct = Math.min(100, (r.achieved / r.required) * 100);
            const fillCls = r.current ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-rose-400 to-rose-600";
            return (
              <div key={r.key} className={`rounded-xl border p-4 ${ringCls}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-800">{t(RECENCY_LABEL_KEY[r.key] ?? "recency.title")}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>
                    {r.current ? t("recency.current") : t("recency.notCurrent")}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-2 font-mono">{r.citation}</div>
                <div className="text-xs text-slate-700 mb-1.5 tabular-nums">
                  {t("recency.progress", { achieved: r.achieved, required: r.required, days: r.windowDays })}
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden ring-1 ring-slate-200/60">
                  <div className={`h-full rounded-full ${fillCls} transition-all duration-700`}
                       style={{ width: `${pct}%` }} />
                </div>
                {r.current && r.daysUntilExpiry != null && (
                  <div className={`mt-1.5 text-[10px] font-medium ${labelCls}`}>
                    {t("recency.expiresIn", { days: r.daysUntilExpiry })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Breakdowns */}
      <section className="grid md:grid-cols-2 gap-4">
        <Breakdown title={t("dash.singleEngine")} gradient="from-slate-50 to-slate-100" rows={[
          [t("bd.dualDay"), totals.se_dual_day], [t("bd.picDay"), totals.se_pic_day], [t("bd.dayTotal"), totals.se_day, true],
          [t("bd.dualNight"), totals.se_dual_night], [t("bd.picNight"), totals.se_pic_night], [t("bd.nightTotal"), totals.se_night, true],
          [t("bd.seTotal"), totals.se_total, true],
        ]} />
        <Breakdown title={t("dash.multiEngine")} gradient="from-indigo-50 to-violet-50" rows={[
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
        <Breakdown title={t("bd.crossCountry")} gradient="from-[#f4ead9] to-[#e0c9a6]" rows={[
          [t("bd.day"), totals.xc_day], [t("bd.night"), totals.xc_night],
          [t("bd.byRoleDual"), totals.xc_dual], [t("bd.byRolePic"), totals.xc_pic],
          [t("bd.byRoleFo"), totals.xc_fo],
          [t("bd.byRoleSo"), totals.xc_sic], [t("bd.byRoleCheck"), totals.xc_check],
          [t("bd.xcTotal"), totals.xc_total, true],
        ]} />
        <Breakdown title={t("bd.instrument")} gradient="from-orange-50 to-amber-50" rows={[
          [t("bd.actual"), totals.actual_inst], [t("bd.hood"), totals.hood_inst],
          [t("bd.sim"), totals.sim_inst], [t("bd.approaches"), totals.ifr_approaches],
          [t("bd.instTotal"), totals.inst_total, true],
        ]} />
      </section>

      {/* By-aircraft-type */}
      <section className="card card-hover p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">{t("dash.timeByAircraft")}</h2>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-slate-500">
            <LegendDot color="bg-blue-500" label={t("dash.pic")} />
            <LegendDot color="bg-emerald-500" label={t("role.fo")} />
            <LegendDot color="bg-amber-500" label={t("role.dual")} />
            <LegendDot color="bg-violet-500" label={t("role.so")} />
            <LegendDot color="bg-fuchsia-500" label={t("role.check")} />
          </div>
        </div>
        <AircraftRoleSankey
          byTypeRole={totals.by_type_role}
          roleLabels={{ PIC: t("dash.pic"), FO: t("role.fo"), DUAL: t("role.dual"), SIC: t("role.so"), CHECK: t("role.check") }} />
      </section>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${color} shadow-sm`} />
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
  function daysUntil(iso: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const t = new Date(iso); t.setHours(0,0,0,0);
    return Math.round((t.getTime() - today.getTime()) / 86400000);
  }
  return (
    <section className="card card-hover p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        <Link href="/app/documents" className="text-xs font-semibold text-sky-600 hover:text-sky-800">{manageLabel}</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {docs.map((d) => {
          // Page query filters out null expires_on, so non-null assertion is
          // safe here.
          const days = daysUntil(d.expires_on!);
          const color = days < 0 ? "rose" : days <= 30 ? "amber" : "emerald";
          return (
            <div key={d.id} className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between
              ${color === "rose" ? "border-rose-200 bg-rose-50/60" : ""}
              ${color === "amber" ? "border-amber-200 bg-amber-50/60" : ""}
              ${color === "emerald" ? "border-emerald-200 bg-emerald-50/60" : ""}`}>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 truncate">{d.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{d.doc_type.replace("_", " ")}</div>
              </div>
              <div className={`text-xs font-bold whitespace-nowrap
                ${color === "rose" ? "text-rose-700" : ""}
                ${color === "amber" ? "text-amber-700" : ""}
                ${color === "emerald" ? "text-emerald-700" : ""}`}>
                {daysLabel(days)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center space-y-4">
      <div className="text-4xl">✈️</div>
      <h2 className="text-xl font-bold text-slate-800">No flights yet</h2>
      <p className="text-slate-500 max-w-md mx-auto">
        Add your first flight, or import a CSV from your existing logbook to get started.
      </p>
      <div className="flex gap-2 justify-center pt-2">
        <Link href="/app/flights/new" className="btn btn-primary">Add a flight</Link>
        <Link href="/app/import" className="btn">Import CSV</Link>
      </div>
    </div>
  );
}

function HeroStat({ label, value, gradient, shadow, accent, orbColor, hrsLabel = "hrs" }: {
  label: string; value: number; gradient: string; shadow: string; accent: string; orbColor: string; hrsLabel?: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl ${gradient} ${shadow} p-5 text-white card-hover transition-all duration-300`}>
      {/* Soft inner highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none" />
      {/* Floating orb that drifts slightly on hover */}
      <div className={`orb ${orbColor} w-40 h-40 -top-12 -right-12 group-hover:scale-110 transition-transform duration-700`} />
      {/* Top edge bevel */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/30 pointer-events-none" />
      <div className="relative">
        <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${accent} mb-2`}>{label}</div>
        <div className="text-4xl font-bold tracking-tight drop-shadow-sm">
          <CountUp value={value} decimals={1} />
          <span className="text-base font-normal opacity-70 ml-1.5">{hrsLabel}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, integer = false, hrsLabel = "hrs" }: { label: string; value: number; integer?: boolean; hrsLabel?: string }) {
  return (
    <div className="card card-hover p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1 text-slate-900 tracking-tight">
        <CountUp value={value} decimals={integer ? 0 : 1} />
        {!integer && <span className="text-xs font-normal text-slate-400 ml-1">{hrsLabel}</span>}
      </div>
    </div>
  );
}


function Breakdown({ title, rows, gradient }: {
  title: string;
  rows: ([string, number] | [string, number, boolean])[];
  gradient: string;
}) {
  return (
    <div className="card card-hover overflow-hidden">
      <div className={`bg-gradient-to-br ${gradient} px-5 py-3 border-b border-slate-200/60`}>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => {
            const [k, v, emph] = row as [string, number, boolean | undefined];
            return (
              <tr key={k} className={`border-b border-slate-100 last:border-0 ${emph ? "bg-slate-50/60" : ""}`}>
                <td className={`px-5 py-2 ${emph ? "font-semibold text-slate-800" : "text-slate-600"}`}>{k}</td>
                <td className={`px-5 py-2 text-right tabular-nums ${emph ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{v.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
