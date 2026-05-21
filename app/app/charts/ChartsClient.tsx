"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import type { FlightDerived } from "@/lib/types";
import type { Airport } from "@/lib/airports";
import FlightGlobe from "./Globe";
import { ArrowBar3D, ArrowBar3DHorizontalColored } from "./CustomBars";
import { makeT, type Locale } from "@/lib/i18n";

const r1 = (n: number) => Math.round(n * 10) / 10;
function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const tooltipStyle = {
  borderRadius: 10, border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
  backgroundColor: "rgba(255,255,255,0.98)", fontSize: 12,
};

export default function ChartsClient({
  flights, globeAirports, globeArcs, globeYear, locale,
}: {
  flights: FlightDerived[];
  globeAirports: Record<string, Airport>;
  globeArcs: Array<{ from: string; to: string; count: number }>;
  globeYear: string;
  locale: Locale;
}) {
  const t = makeT(locale);
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const f of flights) s.add(f.date.slice(0, 4));
    return [...s].sort();
  }, [flights]);

  const [calYear, setCalYear] = useState("");
  useEffect(() => {
    if (calYear === "" && years.length > 0) setCalYear(years[years.length - 1]);
  }, [years, calYear]);

  const perYear = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flights) {
      const y = f.date.slice(0, 4);
      m.set(y, (m.get(y) ?? 0) + f.total_time);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, hours]) => ({ year, hours: r1(hours) }));
  }, [flights]);

  const perType = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flights) m.set(f.make_model, (m.get(f.make_model) ?? 0) + f.total_time);
    return [...m.entries()]
      .map(([type, hours]) => ({ type, hours: r1(hours) }))
      .filter((d) => d.hours > 0)
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [flights]);

  const rolling = useMemo(() => {
    if (flights.length === 0) return [] as { date: string; hours: number }[];
    const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
    const first = new Date(sorted[0].date);
    const last = new Date(sorted[sorted.length - 1].date);
    const points: { date: string; hours: number }[] = [];
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    cursor.setMonth(cursor.getMonth() + 12);
    while (cursor <= last) {
      const end = new Date(cursor);
      const start = new Date(cursor);
      start.setDate(start.getDate() - 365);
      const startIso = iso(start);
      const endIso = iso(end);
      let hours = 0;
      for (const f of sorted) {
        if (f.date >= startIso && f.date < endIso) hours += f.total_time;
        if (f.date >= endIso) break;
      }
      points.push({ date: endIso.slice(0, 7), hours: r1(hours) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }, [flights]);

  const calData = useMemo(() => {
    if (!calYear) return [];
    const m = new Map<string, number>();
    for (const f of flights) {
      if (!f.date.startsWith(calYear)) continue;
      m.set(f.date, (m.get(f.date) ?? 0) + f.total_time);
    }
    return [...m.entries()].map(([date, hours]) => ({ date, count: r1(hours) }));
  }, [flights, calYear]);

  if (flights.length === 0) return <p className="text-slate-500">{t("charts.emptyState")}</p>;

  const peakRolling = rolling.reduce((m, p) => Math.max(m, p.hours), 0);

  return (
    <div className="space-y-6">
      <section className="chart-stage">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{t("charts.flightMap")}</h2>
            <div className="text-xs text-slate-500">{t("charts.flightMapSub", { routes: globeArcs.length.toLocaleString(), airports: Object.keys(globeAirports).length.toLocaleString() })}</div>
          </div>
        </div>
        <FlightGlobe airports={globeAirports} arcs={globeArcs} year={globeYear} />
      </section>

      <section className="chart-stage">
        <h2 className="text-sm font-bold text-slate-800 mb-4">{t("charts.hoursPerYear")}
          <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.years", { years: perYear.length, peak: Math.max(...perYear.map(p => p.hours)).toFixed(1) })}</span>
        </h2>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={perYear} margin={{ top: 30, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#cbd5e1" strokeOpacity={0.45} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(56,189,248,0.10)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="hours" shape={<ArrowBar3D />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-stage">
        <h2 className="text-sm font-bold text-slate-800 mb-4">{t("charts.hoursPerType")}
          <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.types", { n: perType.length })}</span>
        </h2>
        <div style={{ height: Math.max(220, perType.length * 36) }}>
          <ResponsiveContainer>
            <BarChart data={perType} layout="vertical" margin={{ top: 10, right: 40, bottom: 5, left: 80 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#cbd5e1" strokeOpacity={0.45} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={80} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(16,185,129,0.06)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="hours" shape={<ArrowBar3DHorizontalColored />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-stage">
        <h2 className="text-sm font-bold text-slate-800 mb-4">{t("charts.rolling")}
          <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.rollingPeak", { peak: peakRolling.toFixed(0) })}</span>
        </h2>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={rolling} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <defs>
                <linearGradient id="g-rolling" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#cbd5e1" strokeOpacity={0.45} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={40} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, "dataMax"]} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={1200} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "CARs 1200", position: "right", fill: "#ef4444", fontSize: 10 }} />
              <Area type="monotone" dataKey="hours" stroke="#0ea5e9" strokeWidth={3} fill="url(#g-rolling)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-stage">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800">{t("charts.calendar")}
            <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.calDays", { year: calYear, days: calData.length })}</span>
          </h2>
          <select className="input w-auto" value={calYear} onChange={(e) => setCalYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {calYear && (
          <div className="text-xs">
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
        )}
      </section>
    </div>
  );
}
