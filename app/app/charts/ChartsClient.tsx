"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { FlightDerived, Role } from "@/lib/types";
import type { Airport } from "@/lib/airports";
import type { Locale } from "@/lib/i18n";
import type { LucideIcon } from "@/components/ui/icons";
import { REGIME_RULES, flightTimeHours, yearlyCeiling, type Regime } from "@/lib/currency-rules";
import { creditedHours } from "@/lib/derive";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import FlowSankey, {
  NODE_MUTED, NODE_NEUTRAL, ROLE_COLORS, type FlowLink, type FlowNode,
} from "@/components/FlowSankey";
import { Card, CardHeader, EmptyState, Icon, PageHeader, buttonClass } from "@/components/ui";
import FlightGlobe from "./Globe";
import TypeHoursChart, { type TypeHoursRow } from "./CustomBars";
import { fmt, getChartsStrings } from "./charts-strings";

const r1 = (n: number) => Math.round(n * 10) / 10;
function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Recharts renders the tooltip into a plain <div>, so the design tokens reach
 * it as inline styles (`var()` resolves there). Everything the library paints
 * as SVG — axis ticks, grid, reference line — is styled from the `.chart-card`
 * rules in app/globals.css instead.
 */
const TOOLTIP_STYLE = {
  borderRadius: "var(--r-control)",
  border: "1px solid rgb(var(--border))",
  boxShadow: "var(--shadow-pop)",
  background: "rgb(var(--surface))",
  padding: "8px 12px",
  fontSize: 12,
} as const;

const MIN_TYPE_SHARE = 0.01;
const MAX_TYPE_ROWS = 12;
const ROLE_ORDER: Role[] = ["PIC", "FO", "DUAL", "SIC", "CHECK"];

/** In-card empty state — the page-level <EmptyState> brings its own card chrome. */
function ChartEmpty({ icon: Glyph, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto w-11 h-11 rounded-control bg-brand/10 text-brand grid place-items-center">
        <Glyph size={20} strokeWidth={1.75} aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-1">{title}</p>
      <p className="mt-1 text-xs text-ink-3 max-w-sm mx-auto">{body}</p>
    </div>
  );
}

export default function ChartsClient({
  flights, globeAirports, globeArcs, locale, regime, augHalfCredit = false,
}: {
  flights: FlightDerived[];
  augHalfCredit?: boolean;
  globeAirports: Record<string, Airport>;
  globeArcs: Array<{ from: string; to: string; count: number }>;
  locale: Locale;
  regime: Regime;
}) {
  const s = getChartsStrings(locale);
  const rules = REGIME_RULES[regime];
  const reduceMotion = useReducedMotion();
  const gradientId = `rolling-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const nf0 = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 });
  const nf1 = (n: number) =>
    n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Career flow: Year → Aircraft type → Role.
  // Years stay chronological, each aircraft is placed at the year it first
  // appears (so ribbons drift diagonally instead of crossing), and types under
  // MIN_TYPE_SHARE of career time roll into one "Other types" row.
  const sankey = useMemo(() => {
    const other = s.otherTypes;
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

    const canon = (ac: string) => ((acHours.get(ac) ?? 0) < grand * MIN_TYPE_SHARE ? other : ac);
    const merged = [...acHours.keys()].filter((ac) => canon(ac) === other).length;

    const yearsAsc = [...yearAc.keys()].sort();
    const acAgg = new Map<string, { hours: number; first: string }>();
    for (const [ac, hrs] of acHours) {
      const c = canon(ac);
      const cur = acAgg.get(c) ?? { hours: 0, first: "9999" };
      cur.hours += hrs;
      const fy = acFirstYear.get(ac) ?? "9999";
      if (c !== other && fy < cur.first) cur.first = fy;
      acAgg.set(c, cur);
    }
    const aircraft = [...acAgg.entries()]
      .sort((a, b) => {
        if (a[0] === other) return 1;
        if (b[0] === other) return -1;
        return a[1].first.localeCompare(b[1].first) || b[1].hours - a[1].hours;
      })
      .map(([name]) => name);
    const roles = ROLE_ORDER.filter((r) => [...acRole.values()].some((m) => (m.get(r) ?? 0) > 0));

    const nodes: FlowNode[] = [
      ...yearsAsc.map((y) => ({ name: y, color: NODE_MUTED, kind: "year" })),
      ...aircraft.map((a) => ({ name: a, color: NODE_NEUTRAL, kind: "aircraft" })),
      ...roles.map((r) => ({ name: r, color: ROLE_COLORS[r], kind: "role" })),
    ];
    const yIdx = new Map(yearsAsc.map((y, i) => [y, i] as const));
    const aIdx = new Map(aircraft.map((a, i) => [a, yearsAsc.length + i] as const));
    const rIdx = new Map(roles.map((r, i) => [r, yearsAsc.length + aircraft.length + i] as const));

    // Aggregate by (source, target) index pair — merging into "Other types"
    // can fold several raw edges into one ribbon.
    const STRIDE = 100000;
    const agg = new Map<number, number>();
    const add = (src: number, tgt: number, v: number) =>
      agg.set(src * STRIDE + tgt, (agg.get(src * STRIDE + tgt) ?? 0) + v);
    for (const [y, m] of yearAc) for (const [ac, v] of m) add(yIdx.get(y)!, aIdx.get(canon(ac))!, v);
    for (const [ac, m] of acRole) for (const [r, v] of m) add(aIdx.get(canon(ac))!, rIdx.get(r)!, v);
    const links: FlowLink[] = [];
    for (const [k, v] of agg) {
      if (v < 0.1) continue;
      links.push({ source: Math.floor(k / STRIDE), target: k % STRIDE, value: r1(v) });
    }

    const tallest = Math.max(yearsAsc.length, aircraft.length, roles.length);
    return { nodes, links, years: yearsAsc, aircraft, roles, merged, tallest };
  }, [flights, augHalfCredit, s.otherTypes]);

  // Credited hours per aircraft type, biggest first.
  const typeRows = useMemo<TypeHoursRow[]>(() => {
    const m = new Map<string, number>();
    for (const f of flights) {
      const hrs = creditedHours(f, augHalfCredit);
      if (!f.make_model || hrs <= 0) continue;
      m.set(f.make_model, (m.get(f.make_model) ?? 0) + hrs);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TYPE_ROWS)
      .map(([name, hours]) => ({ name, hours: r1(hours) }));
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
      // Same rule as the dashboard limits card: simulator sessions never count
      // toward flight time, and the window is inclusive at both ends
      // (lib/currency-rules `flightTimeHours` / `computeCurrencyForRegime`).
      // Counting sim here would draw a line the limits card contradicts.
      for (const f of sorted) {
        if (f.date > endIso) break;
        if (f.date >= startIso) hours += flightTimeHours(f);
      }
      points.push({ date: endIso.slice(0, 7), hours: r1(hours) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }, [flights]);

  // Regime-aware ceiling for the rolling 365-day total, from the same helper the
  // limits card uses, so the two surfaces can never drift apart.
  const annual = useMemo(() => yearlyCeiling(regime), [regime]);
  const ceiling = annual.max;

  if (flights.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} subtitle={s.subtitle} />
        <EmptyState
          icon={Icon.ChartSpline}
          title={s.emptyTitle}
          body={s.emptyBody}
          primary={<Link className={buttonClass("primary")} href="/app/flights/new">{s.addFlight}</Link>}
          secondary={<Link className={buttonClass()} href="/app/import">{s.importCsv}</Link>}
        />
      </div>
    );
  }

  const peakRolling = rolling.reduce((m, p) => Math.max(m, p.hours), 0);
  const yMax = Math.max(peakRolling, ceiling) * 1.1;
  const ceilingLabel = fmt(s.ceilingLabel, { reference: annual.reference, ceiling: nf0(ceiling) });
  const typeTotal = typeRows.reduce((sum, t) => sum + t.hours, 0);

  return (
    <div className="cascade space-y-6">
      <PageHeader
        title={s.title}
        subtitle={<>
          <span>{s.subtitle}</span>
          {augHalfCredit && <span className="text-xs text-ink-3">· {s.augNote}</span>}
        </>}
      />

      {/* Flight map */}
      <Card padding="md" className="min-w-0 overflow-hidden">
        <CardHeader
          eyebrow={s.mapEyebrow}
          title={s.mapTitle}
          meta={fmt(s.globe.routesAirports, {
            routes: globeArcs.length.toLocaleString(locale),
            airports: Object.keys(globeAirports).length.toLocaleString(locale),
          })}
        />
        {globeArcs.length === 0 ? (
          <ChartEmpty icon={Icon.Map} title={s.mapEmptyTitle} body={s.mapEmptyBody} />
        ) : (
          <FlightGlobe airports={globeAirports} arcs={globeArcs} strings={s.globe} locale={locale} />
        )}
      </Card>

      {/* Career flow */}
      <Card padding="md" className="min-w-0 overflow-hidden">
        <CardHeader
          eyebrow={s.flowEyebrow}
          title={s.flowTitle}
          meta={<>
            {fmt(s.flowMeta, {
              years: sankey.years.length,
              aircraft: sankey.aircraft.length,
              roles: sankey.roles.length,
            })}
            {sankey.merged > 0 && ` · ${fmt(s.flowMerged, { n: sankey.merged, other: s.otherTypes })}`}
          </>}
          actions={
            <ul className="flex items-center gap-3 flex-wrap text-2xs text-ink-2">
              {sankey.roles.map((r) => (
                <li key={r} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-pill shrink-0"
                    style={{ backgroundColor: ROLE_COLORS[r] }}
                    aria-hidden
                  />
                  {r}
                </li>
              ))}
            </ul>
          }
        />
        {sankey.links.length === 0 ? (
          <ChartEmpty icon={Icon.ChartSpline} title={s.flowEmptyTitle} body={s.flowEmptyBody} />
        ) : (
          <>
            <p className="text-2xs text-ink-3 mb-3">{s.flowHint}</p>
            <FlowSankey
              nodes={sankey.nodes}
              links={sankey.links}
              height={Math.max(640, sankey.tallest * 32)}
              columns={3}
              fmt={(n) => `${nf1(n)} ${s.hoursUnit}`}
            />
          </>
        )}
      </Card>

      {/* Hours per aircraft type */}
      {typeRows.length === 0 ? (
        <Card padding="md" className="min-w-0 overflow-hidden">
          <CardHeader eyebrow={s.typesEyebrow} title={s.typesTitle} />
          <ChartEmpty icon={Icon.Plane} title={s.typesEmptyTitle} body={s.typesEmptyBody} />
        </Card>
      ) : (
        <TypeHoursChart
          rows={typeRows}
          title={s.typesTitle}
          eyebrow={s.typesEyebrow}
          meta={fmt(s.typesMeta, { n: typeRows.length, hours: nf1(typeTotal) })}
          strings={s}
          hoursUnit={s.hoursUnit}
          locale={locale}
        />
      )}

      {/* Rolling 365-day total vs. the regime ceiling */}
      <Card padding="md" className="chart-card chart-area min-w-0 overflow-hidden">
        <CardHeader
          eyebrow={s.rollingEyebrow}
          title={s.rollingTitle}
          meta={fmt(s.rollingCaption, {
            peak: nf0(peakRolling),
            ceiling: nf0(ceiling),
            reference: annual.reference,
          })}
        />
        {rolling.length === 0 ? (
          <ChartEmpty icon={Icon.Clock} title={s.rollingEmptyTitle} body={s.rollingEmptyBody} />
        ) : (
          <div className="h-56 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rolling} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: "rgb(var(--role-fo))", stopOpacity: 0.65 }} />
                    <stop offset="100%" style={{ stopColor: "rgb(var(--role-fo))", stopOpacity: 0.04 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" minTickGap={40} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, yMax]}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => nf0(v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "rgb(var(--ink-3))" }}
                  itemStyle={{ color: "rgb(var(--ink-1))", fontWeight: 600 }}
                  formatter={(v: unknown) => [`${nf1(Number(v))} ${s.hoursUnit}`, s.rollingTitle]}
                />
                <ReferenceLine
                  y={ceiling}
                  stroke="rgb(var(--bad))"
                  strokeDasharray="4 4"
                  label={{ value: ceilingLabel, position: "insideTopRight", className: "text-2xs" }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="rgb(var(--role-fo))"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={!reduceMotion}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
