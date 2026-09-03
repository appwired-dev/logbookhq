"use client";

import { useMemo, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { makeT, type Locale } from "@/lib/i18n";

export type HeatDay = { date: string; count: number };

/**
 * Year-at-a-glance flying-day heatmap. Takes per-day hour totals (already
 * aggregated server-side, one entry per flying day across the whole career)
 * and lets the reader flip between years.
 */
export default function CalendarHeatmapCard({ days, locale }: { days: HeatDay[]; locale: Locale }) {
  const t = makeT(locale);
  const years = useMemo(() => [...new Set(days.map((d) => d.date.slice(0, 4)))].sort(), [days]);
  const [calYear, setCalYear] = useState(() => years[years.length - 1] ?? "");
  const calData = useMemo(() => days.filter((d) => d.date.startsWith(calYear)), [days, calYear]);
  if (!calYear) return null;

  return (
    <section className="card card-hover p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-800">{t("charts.calendar")}
          <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.calDays", { year: calYear, days: calData.length })}</span>
        </h2>
        <select className="input w-auto" value={calYear} onChange={(e) => setCalYear(e.target.value)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {/* The heatmap SVG scales with its container; cap the width so the day
          squares stay ~14px on wide monitors instead of growing with the page. */}
      <div className="text-xs max-w-4xl">
        <CalendarHeatmap
          startDate={new Date(`${Number(calYear) - 1}-12-31`)}
          endDate={new Date(`${calYear}-12-31`)}
          values={calData}
          classForValue={(v) => {
            if (!v || !v.count) return "color-empty";
            if (v.count < 1) return "color-scale-1";
            if (v.count < 3) return "color-scale-2";
            if (v.count < 6) return "color-scale-3";
            return "color-scale-4";
          }}
          titleForValue={(v: any) => v?.date ? `${v.date}: ${v.count} hrs` : "no flight"}
        />
      </div>
    </section>
  );
}
