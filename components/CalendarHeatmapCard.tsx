"use client";

import { useMemo, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { makeT, type Locale } from "@/lib/i18n";
import { parseLocalDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui";

export type HeatDay = { date: string; count: number };

/** Strings introduced by the console redesign — to be folded into lib/i18n.ts. */
const LOCAL: Record<string, Record<Locale, string>> = {
  less: { en: "Less", ko: "적음", zh: "少", es: "Menos" },
  more: { en: "More", ko: "많음", zh: "多", es: "Más" },
  year: { en: "Year", ko: "연도", zh: "年份", es: "Año" },
};

/** Legend swatches mirror the .color-empty / .color-scale-N fills in globals.css. */
const LEGEND_SWATCHES = ["bg-surface-2", "bg-chart-1/30", "bg-chart-1/55", "bg-chart-1/80", "bg-brand-deep"];

/**
 * Year-at-a-glance flying-day heatmap. Takes per-day hour totals (already
 * aggregated server-side, one entry per flying day across the whole career)
 * and lets the reader flip between years.
 */
export default function CalendarHeatmapCard({ days, locale }: { days: HeatDay[]; locale: Locale }) {
  const t = makeT(locale);
  const l = (k: keyof typeof LOCAL) => LOCAL[k][locale] ?? LOCAL[k].en;
  const years = useMemo(() => [...new Set(days.map((d) => d.date.slice(0, 4)))].sort(), [days]);
  const [calYear, setCalYear] = useState(() => years[years.length - 1] ?? "");
  const calData = useMemo(() => days.filter((d) => d.date.startsWith(calYear)), [days, calYear]);
  if (!calYear) return null;

  // Local-midnight bounds: `new Date("YYYY-12-31")` parses as UTC and lands
  // on Dec 30 in the Americas, shifting every square by a day.
  const startDate = new Date(Number(calYear) - 1, 11, 31);
  const endDate = new Date(Number(calYear), 11, 31);

  return (
    <Card padding="md" className="min-w-0 overflow-hidden">
      <CardHeader
        title={t("charts.calendar")}
        meta={t("charts.calDays", { year: calYear, days: calData.length })}
        actions={
          <select
            className="input input-sm w-auto"
            aria-label={l("year")}
            value={calYear}
            onChange={(e) => setCalYear(e.target.value)}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        }
      />
      {/* The heatmap SVG scales with its container; cap the width so the day
          squares stay ~14px on wide monitors, and let it scroll on phones
          instead of shrinking the squares to nothing. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px] max-w-4xl text-xs">
          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={calData.map((d) => ({ date: parseLocalDate(d.date), iso: d.date, count: d.count }))}
            classForValue={(v) => {
              if (!v || !v.count) return "color-empty";
              if (v.count < 1) return "color-scale-1";
              if (v.count < 3) return "color-scale-2";
              if (v.count < 6) return "color-scale-3";
              return "color-scale-4";
            }}
            titleForValue={(v: any) => (v?.iso ? `${v.iso}: ${v.count} ${t("limits.hrs")}` : "")}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-2xs text-ink-3" aria-hidden>
        <span>{l("less")}</span>
        {LEGEND_SWATCHES.map((cls) => (
          <span key={cls} className={`inline-block w-2.5 h-2.5 rounded-[2px] ${cls}`} />
        ))}
        <span>{l("more")}</span>
      </div>
    </Card>
  );
}
