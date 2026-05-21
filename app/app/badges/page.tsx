import { createClient } from "@/lib/supabase/server";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { computeBadges } from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";
import { getT, getLocale } from "@/lib/i18n-server";
import type { PilotDocument } from "@/lib/types";

export default async function BadgesPage() {
  const supabase = await createClient();
  const flights = await fetchAllFlights(supabase);
  const { data: docsRaw } = await supabase.from("documents").select("*");
  const documents = (docsRaw ?? []) as PilotDocument[];
  const t = await getT();
  const locale = await getLocale();
  const badges = computeBadges(flights, documents, locale);

  const earned = badges.filter((b) => b.earned);

  const groups = ["firsts", "milestones", "regime", "endurance"] as const;
  const labels: Record<typeof groups[number], string> = {
    firsts: t("badges.cat.firsts"),
    milestones: t("badges.cat.milestones"),
    regime: t("badges.cat.regime"),
    endurance: t("badges.cat.endurance"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("badges.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("badges.summary", { earned: earned.length, total: badges.length, flights: flights.length.toLocaleString() })}
        </p>
      </div>

      {groups.map((g) => {
        const inGroup = badges.filter((b) => b.category === g);
        if (inGroup.length === 0) return null;
        return (
          <section key={g} className="card overflow-hidden">
            <div className="bg-gradient-to-br from-slate-50 to-amber-50/40 px-5 py-3 border-b border-slate-200/60">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">{labels[g]}</h2>
            </div>
            <div className="p-3 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              {inGroup.map((b) => (
                <div
                  key={b.id}
                  className={`relative rounded-lg border-double border-4 p-1 transition-all overflow-visible ${
                    b.earned
                      ? "border-amber-500/70 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-[0_4px_14px_rgba(245,158,11,0.18),inset_0_0_0_1px_rgba(217,119,6,0.25)]"
                      : "border-slate-300 bg-slate-50/40 opacity-70 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.3)]"
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-1">
                    <BadgeMedallion id={b.id} kind={b.kind} tier={b.tier} earned={b.earned} />
                    <div className="w-full min-w-0">
                      <div className="font-bold text-slate-900 text-xs leading-tight">{b.name}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">{b.description}</div>
                      {b.earned && b.earnedOn && (
                        <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mt-1">
                          {t("badges.earned", { date: b.earnedOn })}
                        </div>
                      )}
                      {b.progress && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                            <span>{t("badges.progress")}</span>
                            <span className="tabular-nums">
                              {b.progress.current.toLocaleString()} / {b.progress.target.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                              style={{ width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
