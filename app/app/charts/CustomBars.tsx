"use client";

/**
 * "Hours per aircraft type" — horizontal bars in the instrument style of the
 * route globe: each bar fills from a faint full-width track, brightens toward
 * its end and finishes in a lit cap; in the dark theme it carries a soft glow.
 * Colours come from the --chart-1 token, so the theme swap re-colours it.
 */

import { useId, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
// TODO(icons): fold ChartBar / Table2 into components/ui/icons.ts (owned by
// another phase); imported directly until then.
import { ChartBar, Table2 } from "lucide-react";
import { Card, CardHeader, buttonClass } from "@/components/ui";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  /** Set by Recharts while the pointer is over this row. */
  isActive?: boolean;
  gradientId?: string;
}

/** A slim rounded bar with a gradient body and a lit end cap. */
function GlowBar({ x = 0, y = 0, width = 0, height = 0, gradientId }: ShapeProps) {
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(height / 2, 6);
  const capX = x + width;
  return (
    <g className="glow-bar">
      <rect x={x} y={y} width={width} height={height} rx={r} fill={`url(#${gradientId})`} />
      {/* top sheen: a hairline of light along the upper edge */}
      <rect x={x + r} y={y + 0.5} width={Math.max(0, width - 2 * r)} height={1} rx={0.5} style={{ fill: "rgb(255 255 255 / 0.28)" }} />
      {width > 10 && <circle cx={capX - r} cy={y + height / 2} r={Math.max(1.6, height * 0.22)} className="glow-bar-cap" style={{ fill: "rgb(var(--chart-1))" }} />}
    </g>
  );
}

// ---------------------------------------------------------------------------

export type TypeHoursRow = { name: string; hours: number };

export type TypeHoursStrings = {
  viewAsTable: string;
  viewAsChart: string;
  colType: string;
  colHours: string;
  colShare: string;
};

const TOOLTIP_STYLE = {
  borderRadius: "var(--r-control)",
  border: "1px solid rgb(var(--glass-line) / calc(var(--glass-line-a) * 2))",
  boxShadow: "var(--shadow-pop)",
  background: "rgb(var(--surface) / 0.86)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  padding: "8px 12px",
  fontSize: 12,
} as const;

const ellipsis = (v: unknown) => {
  const s = String(v ?? "");
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
};

/**
 * "Hours per aircraft type" card. The chart is decorative for assistive tech:
 * the same numbers are always rendered as a table — visually hidden while the
 * chart is shown, and swapped in for everyone via the "View as table" toggle.
 */
export default function TypeHoursChart({
  rows, title, eyebrow, meta, strings, hoursUnit, locale,
}: {
  rows: TypeHoursRow[];
  title: string;
  eyebrow?: string;
  meta?: string;
  strings: TypeHoursStrings;
  hoursUnit: string;
  locale: string;
}) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const reduceMotion = useReducedMotion();
  const tableId = useId();
  const gradientId = `tb-${useId().replace(/:/g, "")}`;
  const total = rows.reduce((s, r) => s + r.hours, 0) || 1;
  const height = Math.max(200, rows.length * 36 + 30);
  const nf = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const showTable = mode === "table";

  return (
    <Card padding="md" className="chart-card chart-bars min-w-0 overflow-hidden">
      <CardHeader
        eyebrow={eyebrow}
        title={title}
        meta={meta}
        actions={
          <button
            type="button"
            className={buttonClass("ghost", "sm", "min-h-11 sm:min-h-0")}
            aria-pressed={showTable}
            aria-controls={tableId}
            onClick={() => setMode((m) => (m === "chart" ? "table" : "chart"))}
          >
            {showTable
              ? <><ChartBar size={14} strokeWidth={2} aria-hidden />{strings.viewAsChart}</>
              : <><Table2 size={14} strokeWidth={2} aria-hidden />{strings.viewAsTable}</>}
          </button>
        }
      />

      {!showTable && (
        <div className="min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 64, bottom: 4, left: 0 }} barCategoryGap="38%">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" style={{ stopColor: "rgb(var(--chart-1))", stopOpacity: 0.18 }} />
                  <stop offset="70%" style={{ stopColor: "rgb(var(--chart-1))", stopOpacity: 0.7 }} />
                  <stop offset="100%" style={{ stopColor: "rgb(var(--chart-1))", stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} strokeDasharray="2 6" />
              <XAxis type="number" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={132} interval={0} axisLine={false} tickLine={false} tickFormatter={ellipsis} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "rgb(var(--ink-3))" }}
                itemStyle={{ color: "rgb(var(--ink-1))", fontWeight: 600 }}
                formatter={(v: unknown) => [`${nf(Number(v))} ${hoursUnit}`, strings.colHours]}
              />
              <Bar
                dataKey="hours"
                shape={<GlowBar gradientId={gradientId} />}
                background={{ fill: "rgb(var(--ink-1) / 0.05)", radius: 6 }}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
              >
                <LabelList dataKey="hours" position="right" offset={12} className="mono" fill="rgb(var(--ink-2))" fontSize={12} formatter={(v: unknown) => nf(Number(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={showTable ? "relative overflow-x-auto -mx-1" : "sr-only"}>
        <table id={tableId} className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-1 py-1.5 text-left text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2">{strings.colType}</th>
              <th scope="col" className="px-1 py-1.5 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2">{strings.colHours}</th>
              <th scope="col" className="px-1 py-1.5 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2">{strings.colShare}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-1 py-1.5 text-left font-medium text-ink-1">{r.name}</th>
                <td className="px-1 py-1.5 text-right num text-ink-1">{nf(r.hours)}</td>
                <td className="px-1 py-1.5 text-right num text-ink-2">{Math.round((r.hours / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
