"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ReferenceLine, Area, AreaChart, Sankey,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import type { FlightDerived, Role } from "@/lib/types";
import type { Airport } from "@/lib/airports";
import FlightGlobe from "./Globe";
import { makeT, type Locale } from "@/lib/i18n";

// Role → colour, kept in sync with the dashboard's stacked "Time by Aircraft
// Type" chart so the same role always reads as the same colour across the app.
const ROLE_COLORS: Record<Role, string> = {
  PIC: "#3b82f6",   // blue
  FO: "#10b981",    // emerald
  DUAL: "#f59e0b",  // amber
  SIC: "#a855f7",   // violet (SIC = old "SO / AUG")
  CHECK: "#ec4899", // pink
};
const YEAR_COLOR = "#64748b";     // slate
const AIRCRAFT_COLOR = "#0ea5e9"; // sky

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


// Custom Sankey node renderer. Colours by column ("kind"): year → slate,
// aircraft → sky, role → per-role palette that matches the dashboard's
// stacked "Time by Aircraft Type" chart. Labels for the leftmost column
// (years) render to the left of the node; every other column labels right.
function SankeyNodeShape(props: {
  x?: number; y?: number; width?: number; height?: number;
  index?: number; payload?: { name?: string; kind?: "year" | "aircraft" | "role"; depth?: number };
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const kind = payload?.kind;
  const name = payload?.name ?? "";
  const fill =
    kind === "role" ? (ROLE_COLORS[name as Role] ?? "#64748b") :
    kind === "aircraft" ? AIRCRAFT_COLOR :
    YEAR_COLOR;
  const isFirstCol = (payload?.depth ?? 0) === 0;
  const labelX = isFirstCol ? x - 6 : x + width + 6;
  const anchor = isFirstCol ? "end" : "start";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} rx={2} />
      {height >= 8 && (
        <text
          x={labelX}
          y={y + height / 2}
          textAnchor={anchor}
          dominantBaseline="middle"
          fontSize={11}
          fill="#334155"
        >
          {name}
        </text>
      )}
    </g>
  );
}

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

  // Career Sankey — Year → Aircraft Type → Role.
  //
  // Replaces the previous "Hours per Year" and "Hours per Type" bar charts.
  // One diagram captures both dimensions PLUS the role split, so a reader can
  // trace a specific year to which airframes flew that year, and each airframe
  // to how it was flown (PIC/FO/DUAL/SIC/CHECK).
  //
  // Recharts' <Sankey> takes {nodes: [{name}], links: [{source, target, value}]}
  // where source/target are indices into `nodes`. We concatenate the three
  // columns (years → aircraft → roles) and precompute the index maps so link
  // construction is O(1) per edge.
  const sankeyData = useMemo(() => {
    const yearSet = new Set<string>();
    const acSet = new Set<string>();
    const roleSet = new Set<Role>();
    const yearAc = new Map<string, number>(); // "year|aircraft" -> hours
    const acRole = new Map<string, number>(); // "aircraft|role" -> hours

    for (const f of flights) {
      if (!f.role || !f.make_model || !f.date || f.total_time <= 0) continue;
      const year = f.date.slice(0, 4);
      const ac = f.make_model;
      const role = f.role as Role;
      yearSet.add(year);
      acSet.add(ac);
      roleSet.add(role);
      const yaKey = `${year}${ac}`;
      yearAc.set(yaKey, (yearAc.get(yaKey) ?? 0) + f.total_time);
      const arKey = `${ac}${role}`;
      acRole.set(arKey, (acRole.get(arKey) ?? 0) + f.total_time);
    }

    const years = [...yearSet].sort();
    const aircraft = [...acSet].sort();
    // Fixed role order matches the dashboard legend (PIC, FO, DUAL, SIC, CHECK).
    const roleOrder: Role[] = ["PIC", "FO", "DUAL", "SIC", "CHECK"];
    const roles = roleOrder.filter((r) => roleSet.has(r));

    type SankeyNode = { name: string; kind: "year" | "aircraft" | "role"; hours: number };
    const nodes: SankeyNode[] = [];
    const yearHours = new Map<string, number>();
    const acHours = new Map<string, number>();
    const roleHours = new Map<Role, number>();
    for (const [k, v] of yearAc) {
      const [y, a] = k.split("");
      yearHours.set(y, (yearHours.get(y) ?? 0) + v);
      acHours.set(a, (acHours.get(a) ?? 0) + v);
    }
    for (const [k, v] of acRole) {
      const [, r] = k.split("") as [string, Role];
      roleHours.set(r, (roleHours.get(r) ?? 0) + v);
    }
    for (const y of years) nodes.push({ name: y, kind: "year", hours: r1(yearHours.get(y) ?? 0) });
    const acStart = nodes.length;
    for (const a of aircraft) nodes.push({ name: a, kind: "aircraft", hours: r1(acHours.get(a) ?? 0) });
    const roleStart = nodes.length;
    for (const r of roles) nodes.push({ name: r, kind: "role", hours: r1(roleHours.get(r) ?? 0) });

    const yearIdx = new Map(years.map((y, i) => [y, i] as const));
    const acIdx = new Map(aircraft.map((a, i) => [a, acStart + i] as const));
    const roleIdx = new Map(roles.map((r, i) => [r, roleStart + i] as const));

    const links: Array<{ source: number; target: number; value: number }> = [];
    for (const [k, v] of yearAc) {
      if (v < 0.1) continue; // sub-6-minute edges disappear at any reasonable resolution
      const [y, a] = k.split("");
      links.push({ source: yearIdx.get(y)!, target: acIdx.get(a)!, value: r1(v) });
    }
    for (const [k, v] of acRole) {
      if (v < 0.1) continue;
      const [a, r] = k.split("") as [string, Role];
      links.push({ source: acIdx.get(a)!, target: roleIdx.get(r)!, value: r1(v) });
    }

    return { nodes, links, years, aircraft, roles };
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
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Career flow</h2>
            <div className="text-xs text-slate-500">
              Year → Aircraft → Role · {sankeyData.years.length} years · {sankeyData.aircraft.length} aircraft · {sankeyData.roles.length} roles
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            {sankeyData.roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ROLE_COLORS[r] }} />
                {r}
              </span>
            ))}
          </div>
        </div>
        <div style={{ height: Math.max(560, sankeyData.nodes.length * 18) }}>
          <ResponsiveContainer>
            <Sankey
              data={sankeyData}
              nodePadding={10}
              nodeWidth={12}
              linkCurvature={0.5}
              iterations={64}
              node={<SankeyNodeShape />}
              link={{ stroke: "#94a3b8", strokeOpacity: 0, fill: "#94a3b8", fillOpacity: 0.28 }}
              margin={{ top: 8, right: 90, bottom: 8, left: 60 }}
            >
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={((value: unknown, _name: unknown, entry: unknown) => {
                  const v = typeof value === "number" ? value : 0;
                  const p = (entry as { payload?: { source?: unknown; target?: unknown; name?: string } }).payload;
                  if (p && typeof p.source === "object" && typeof p.target === "object") {
                    const src = (p.source as { name?: string }).name ?? "";
                    const tgt = (p.target as { name?: string }).name ?? "";
                    return [`${v.toFixed(1)} hrs`, `${src} → ${tgt}`];
                  }
                  return [`${v.toFixed(1)} hrs`, p?.name ?? ""];
                }) as never}
              />
            </Sankey>
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
