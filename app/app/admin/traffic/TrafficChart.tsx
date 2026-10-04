"use client";

import { useId, useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { adminOpsStrings, type AdminOpsT } from "../admin-ops-strings";
import { dayFormatter, intFormatter, type DailyPoint } from "./traffic-model";

/**
 * Daily visits chart for the Traffic tab.
 *
 *  - Area = visits (arrivals) this period; Line = page views; dashed Line =
 *    visits in the previous period, aligned by day offset (previous day i
 *    sits under current day i, and the tooltip names both dates).
 *  - The legend is a row of toggle buttons (aria-pressed); the last visible
 *    series cannot be switched off.
 *  - Every day of the window is present (zero-filled by the server page). The
 *    always-present sr-only table in TrafficPanel is the accessible
 *    alternative; this plot is `role="img"` with a summary label.
 *
 * Recharts renders the tooltip into a plain <div>, so the design tokens reach
 * it as inline styles (copied from app/app/charts/ChartsClient.tsx, where the
 * constant is module-private). SVG internals (ticks, grid) are styled by the
 * `.chart-card` rules in app/globals.css.
 */
const TOOLTIP_STYLE = {
  borderRadius: "var(--r-control)",
  border: "1px solid rgb(var(--border))",
  boxShadow: "var(--shadow-pop)",
  background: "rgb(var(--surface))",
  padding: "8px 12px",
  fontSize: 12,
} as const;

const C_VISITS = "rgb(var(--chart-1))";
const C_VIEWS = "rgb(var(--chart-2))";
const C_PREV = "rgb(var(--chart-8))";

type SeriesKey = "visits" | "views" | "prevVisits";
type Visible = Record<SeriesKey, boolean>;

export default function TrafficChart({ data, days, locale }: { data: DailyPoint[]; days: number; locale: Locale }) {
  const o = useMemo(() => adminOpsStrings(locale), [locale]);
  const reduceMotion = useReducedMotion();
  const gradientId = `traffic-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [visible, setVisible] = useState<Visible>({ visits: true, views: true, prevVisits: true });

  const nf = useMemo(() => intFormatter(locale), [locale]);
  const tick = useMemo(() => dayFormatter(locale), [locale]);
  const longDay = useMemo(() => dayFormatter(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);

  const series: { key: SeriesKey; label: string; swatch: "area" | "line" | "dashed"; color: string }[] = [
    { key: "visits", label: o("statVisits"), swatch: "area", color: C_VISITS },
    { key: "views", label: o("statViews"), swatch: "line", color: C_VIEWS },
    { key: "prevVisits", label: o("chartPrevVisits"), swatch: "dashed", color: C_PREV },
  ];
  const visibleCount = Object.values(visible).filter(Boolean).length;

  function toggle(key: SeriesKey) {
    setVisible((v) => {
      const on = Object.values(v).filter(Boolean).length;
      if (v[key] && on <= 1) return v; // at least one series stays on
      return { ...v, [key]: !v[key] };
    });
  }

  return (
    <div className="min-w-0">
      <ul className="mb-2 flex flex-wrap items-center gap-1.5" aria-label={o("chartSeries")}>
        {series.map((s) => {
          const on = visible[s.key];
          const locked = on && visibleCount <= 1;
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={on}
                aria-disabled={locked || undefined}
                onClick={() => toggle(s.key)}
                className={`inline-flex min-h-11 sm:min-h-8 items-center gap-2 rounded-pill border px-2.5 text-xs font-medium
                            transition-colors duration-fast motion-reduce:transition-none
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60
                            ${on ? "border-border-strong bg-surface text-ink-1" : "border-border bg-surface-2/60 text-ink-3 line-through decoration-ink-3/60"}
                            ${locked ? "cursor-default" : "cursor-pointer hover:border-border-strong"}`}
              >
                <Swatch kind={s.swatch} color={s.color} muted={!on} />
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="h-56 min-w-0" role="img" aria-label={o("chartAria", { days })}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: C_VISITS, stopOpacity: 0.65 }} />
                <stop offset="100%" style={{ stopColor: C_VISITS, stopOpacity: 0.04 }} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="day" tickFormatter={(d: string) => tick(d)} minTickGap={28} axisLine={false} tickLine={false} />
            <YAxis width={44} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(v: number) => nf(v)} />
            <Tooltip
              cursor={{ stroke: "rgb(var(--chart-grid))", strokeWidth: 1 }}
              content={(p) => (
                <DailyTooltip
                  active={p.active}
                  point={(p.payload?.[0]?.payload as DailyPoint | undefined) ?? null}
                  visible={visible}
                  o={o}
                  nf={nf}
                  longDay={longDay}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="visits"
              name={o("statVisits")}
              stroke={C_VISITS}
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
              hide={!visible.visits}
              activeDot={{ r: 4, fill: C_VISITS, stroke: "rgb(var(--surface))", strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
            <Line
              type="monotone"
              dataKey="views"
              name={o("statViews")}
              stroke={C_VIEWS}
              strokeWidth={2}
              dot={false}
              hide={!visible.views}
              activeDot={{ r: 3.5, fill: C_VIEWS, stroke: "rgb(var(--surface))", strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
            <Line
              type="monotone"
              dataKey="prevVisits"
              name={o("chartPrevVisits")}
              stroke={C_PREV}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              hide={!visible.prevVisits}
              activeDot={{ r: 3, fill: C_PREV, stroke: "rgb(var(--surface))", strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Swatch({ kind, color, muted }: { kind: "area" | "line" | "dashed"; color: string; muted: boolean }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden className={`shrink-0 ${muted ? "opacity-40" : ""}`}>
      {kind === "area" && <rect x="0" y="1" width="16" height="8" rx="2" style={{ fill: color, fillOpacity: 0.45, stroke: color, strokeWidth: 1.5 }} />}
      {kind === "line" && <line x1="0" y1="5" x2="16" y2="5" style={{ stroke: color, strokeWidth: 2.5, strokeLinecap: "round" }} />}
      {kind === "dashed" && <line x1="0" y1="5" x2="16" y2="5" style={{ stroke: color, strokeWidth: 2, strokeDasharray: "3 3" }} />}
    </svg>
  );
}

function DailyTooltip({ active, point, visible, o, nf, longDay }: {
  active?: boolean;
  point: DailyPoint | null;
  visible: Visible;
  o: AdminOpsT;
  nf: (n: number) => string;
  longDay: (d: string) => string;
}) {
  if (!active || !point) return null;
  const showCurrent = visible.visits || visible.views;
  return (
    <div style={TOOLTIP_STYLE} className="min-w-[11rem]">
      {showCurrent && (
        <>
          <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">{o("legendCurrent")}</div>
          <div className="text-xs text-ink-2">{longDay(point.day)}</div>
          <dl className="mt-1 space-y-0.5">
            {visible.visits && <Row color={C_VISITS} label={o("statVisits")} value={nf(point.visits)} />}
            {visible.views && <Row color={C_VIEWS} label={o("statViews")} value={nf(point.views)} />}
          </dl>
        </>
      )}
      {visible.prevVisits && (
        <div className={showCurrent ? "mt-2 border-t border-border pt-2" : ""}>
          <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">{o("legendPrevious")}</div>
          <div className="text-xs text-ink-2">{longDay(point.prevDay)}</div>
          <dl className="mt-1">
            <Row color={C_PREV} label={o("statVisits")} value={nf(point.prevVisits)} dashed />
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value, dashed = false }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="inline-flex items-center gap-1.5 text-ink-2">
        <span
          aria-hidden
          className="inline-block h-0.5 w-3 rounded-pill"
          style={dashed ? { backgroundImage: `linear-gradient(90deg, ${color} 50%, transparent 50%)`, backgroundSize: "4px 2px" } : { background: color }}
        />
        {label}
      </dt>
      <dd className="num font-semibold text-ink-1">{value}</dd>
    </div>
  );
}
