"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ReferenceLine, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { FlightDerived, Role } from "@/lib/types";
import type { Airport } from "@/lib/airports";
import FlightGlobe from "./Globe";
import FlowSankey, { ROLE_COLORS, type FlowLink, type FlowNode } from "@/components/FlowSankey";
import { creditedHours } from "@/lib/derive";
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

const YEAR_COLOR = "#94a3b8";
const AIRCRAFT_COLOR = "#64748b";
const OTHER_TYPES = "Other types";
const MIN_TYPE_SHARE = 0.01;
const ROLE_ORDER: Role[] = ["PIC", "FO", "DUAL", "SIC", "CHECK"];

export default function ChartsClient({
  flights, globeAirports, globeArcs, globeYear, locale, augHalfCredit = false,
}: {
  flights: FlightDerived[];
  augHalfCredit?: boolean;
  globeAirports: Record<string, Airport>;
  globeArcs: Array<{ from: string; to: string; count: number }>;
  globeYear: string;
  locale: Locale;
}) {
  const t = makeT(locale);
  // Career flow: Year → Aircraft type → Role.
  // Years stay chronological, each aircraft is placed at the year it first
  // appears (so ribbons drift diagonally instead of crossing), and types under
  // MIN_TYPE_SHARE of career time roll into one "Other types" row.
  const sankey = useMemo(() => {
    const yearAc = new Map<string, Map<string, number>>();
    const acRole = new Map<string, Map<Role, number>>();
    const acHours = new Map<string, number>();
    const acFirstYear = new Map<string, string>();
    let grand = 0;

    for (const f of flights) {
      const hrs = creditedHours(f, augHalfCredit);
      if (!f.role || !f.make_model || !f.date || hrs <= 0) continue;
      const year = f.date.slice(0, 4);
      const ac = f.make_model;
      const role = f.role as Role;
      grand += hrs;
      acHours.set(ac, (acHours.get(ac) ?? 0) + hrs);
      const first = acFirstYear.get(ac);
      if (first === undefined || year < first) acFirstYear.set(ac, year);
      let ya = yearAc.get(year);
      if (!ya) { ya = new Map(); yearAc.set(year, ya); }
      ya.set(ac, (ya.get(ac) ?? 0) + hrs);
      let ar = acRole.get(ac);
      if (!ar) { ar = new Map(); acRole.set(ac, ar); }
      ar.set(role, (ar.get(role) ?? 0) + hrs);
    }

    const canon = (ac: string) => ((acHours.get(ac) ?? 0) < grand * MIN_TYPE_SHARE ? OTHER_TYPES : ac);
    const merged = [...acHours.keys()].filter((ac) => canon(ac) === OTHER_TYPES).length;

    const yearsAsc = [...yearAc.keys()].sort();
    const acAgg = new Map<string, { hours: number; first: string }>();
    for (const [ac, hrs] of acHours) {
      const c = canon(ac);
      const cur = acAgg.get(c) ?? { hours: 0, first: "9999" };
      cur.hours += hrs;
      const fy = acFirstYear.get(ac) ?? "9999";
      if (c !== OTHER_TYPES && fy < cur.first) cur.first = fy;
      acAgg.set(c, cur);
    }
    const aircraft = [...acAgg.entries()]
      .sort((a, b) => {
        if (a[0] === OTHER_TYPES) return 1;
        if (b[0] === OTHER_TYPES) return -1;
        return a[1].first.localeCompare(b[1].first) || b[1].hours - a[1].hours;
      })
      .map(([name]) => name);
    const roles = ROLE_ORDER.filter((r) => [...acRole.values()].some((m) => (m.get(r) ?? 0) > 0));

    const nodes: FlowNode[] = [
      ...yearsAsc.map((y) => ({ name: y, color: YEAR_COLOR, kind: "year" })),
      ...aircraft.map((a) => ({ name: a, color: AIRCRAFT_COLOR, kind: "aircraft" })),
      ...roles.map((r) => ({ name: r, color: ROLE_COLORS[r], kind: "role" })),
    ];
    const yIdx = new Map(yearsAsc.map((y, i) => [y, i] as const));
    const aIdx = new Map(aircraft.map((a, i) => [a, yearsAsc.length + i] as const));
    const rIdx = new Map(roles.map((r, i) => [r, yearsAsc.length + aircraft.length + i] as const));

    // Aggregate by (source, target) index pair — merging into "Other types"
    // can fold several raw edges into one ribbon.
    const STRIDE = 100000;
    const agg = new Map<number, number>();
    const add = (s: number, tgt: number, v: number) => agg.set(s * STRIDE + tgt, (agg.get(s * STRIDE + tgt) ?? 0) + v);
    for (const [y, m] of yearAc) for (const [ac, v] of m) add(yIdx.get(y)!, aIdx.get(canon(ac))!, v);
    for (const [ac, m] of acRole) for (const [r, v] of m) add(aIdx.get(canon(ac))!, rIdx.get(r)!, v);
    const links: FlowLink[] = [];
    for (const [k, v] of agg) {
      if (v < 0.1) continue;
      links.push({ source: Math.floor(k / STRIDE), target: k % STRIDE, value: r1(v) });
    }

    const tallest = Math.max(yearsAsc.length, aircraft.length, roles.length);
    return { nodes, links, years: yearsAsc, aircraft, roles, merged, tallest };
  }, [flights, augHalfCredit]);

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
        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Career flow</h2>
            <div className="text-xs text-slate-500">
              Year → Aircraft → Role · {sankey.years.length} years · {sankey.aircraft.length} aircraft
              {sankey.merged > 0 ? ` (${sankey.merged} minor types grouped as "${OTHER_TYPES}")` : ""} · {sankey.roles.length} roles{augHalfCredit ? ` · ${t("charts.augCreditNote")}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            {sankey.roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ROLE_COLORS[r] }} />
                {r}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Ribbon width is hours. Years run top to bottom in order; each aircraft sits beside the year it first appears. Hover a ribbon for the exact figure.
        </p>
        <FlowSankey nodes={sankey.nodes} links={sankey.links} height={Math.max(640, sankey.tallest * 32)} columns={3} />
      </section>

      <section className="chart-stage">
        <h2 className="text-sm font-bold text-slate-800 mb-4">{t("charts.rolling")}
          <span className="text-xs text-slate-500 font-normal ml-2">{t("charts.rollingPeak", { peak: peakRolling.toFixed(0) })}</span>
        </h2>
        <div className="h-52">
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
    </div>
  );
}
