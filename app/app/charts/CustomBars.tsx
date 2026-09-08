"use client";

/**
 * Infographic-style 3D bars for Recharts, plus the "Hours per aircraft type"
 * card that uses them.
 *
 *   ArrowBar3D            — vertical bar (flat top) for per-year charts.
 *   ArrowBar3DHorizontal  — horizontal bar (flat right edge) for per-type charts.
 *   TypeHoursChart        — card: horizontal bars + a table alternative.
 *
 * Colours come from the `--chart-n` tokens. The light and dark faces of each
 * bar are mixed from the base token and the surface / ink tokens with
 * `color-mix()`, so a theme swap re-shades every bar without a palette table.
 * The drop shadow is the bar silhouette, offset so bar N's shadow lands in
 * the band of bar N+1, blurred with a CSS filter.
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

const CHART_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "chart-7", "chart-8"] as const;

/** Light / mid / dark faces for chart series `i` (cycles through --chart-1..8). */
export function paletteForIndex(i: number) {
  const base = `rgb(var(--${CHART_TOKENS[((i % CHART_TOKENS.length) + CHART_TOKENS.length) % CHART_TOKENS.length]}))`;
  return {
    lite: `color-mix(in srgb, ${base} 55%, rgb(var(--surface)))`,
    mid: base,
    dark: `color-mix(in srgb, ${base} 72%, rgb(var(--ink-1)))`,
  };
}

/** Single faded-blue face — the Sankey's PIC blue (--role-pic), so the per-type
 *  bars read as the same family as the career flow above. */
function neutralPalette() {
  const base = "rgb(var(--role-pic))";
  return {
    lite: `color-mix(in srgb, ${base} 34%, rgb(var(--surface)))`,
    mid: `color-mix(in srgb, ${base} 86%, rgb(var(--surface)))`,
    dark: `color-mix(in srgb, ${base} 66%, rgb(var(--ink-1)))`,
  };
}

// Soft, light contact shadow — a hint stronger than a flat drop.
const SHADOW = { fill: "rgb(var(--ink-3))", fillOpacity: 0.3, filter: "blur(2px)" } as const;
const HIGHLIGHT = { stroke: "rgb(var(--surface) / 0.5)" } as const;

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  fill?: string;
  colored?: boolean;
  /** Force the single slate palette (matches the Sankey aircraft nodes). */
  neutral?: boolean;
}

/** Vertical 3D bar — grows upward, flat top. */
export function ArrowBar3D(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, colored = false, neutral = false } = props;
  if (height <= 0 || width <= 0) return null;

  const pal = neutral ? neutralPalette() : paletteForIndex(colored ? index : 0);
  const depth = Math.min(width * 0.42, 11);
  const id = `varr-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}`;

  // Soft contact shadow — a short offset, not a full bar-width away.
  const shDx = Math.round(width * 0.5);
  const shDy = 4;

  const front = [`M ${x},${y + height}`, `L ${x},${y}`, `L ${x + width},${y}`, `L ${x + width},${y + height}`, "Z"].join(" ");
  const side = [`M ${x + width},${y}`, `L ${x + width + depth},${y - depth}`, `L ${x + width + depth},${y + height - depth}`, `L ${x + width},${y + height}`, "Z"].join(" ");
  const top = [`M ${x},${y}`, `L ${x + depth},${y - depth}`, `L ${x + width + depth},${y - depth}`, `L ${x + width},${y}`, "Z"].join(" ");

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: pal.lite }} />
          <stop offset="50%" style={{ stopColor: pal.mid }} />
          <stop offset="100%" style={{ stopColor: pal.dark }} />
        </linearGradient>
      </defs>
      <path d={front} transform={`translate(${shDx} ${shDy})`} style={SHADOW} />
      <path d={side} opacity="0.82" style={{ fill: pal.dark }} />
      <path d={top} opacity="0.85" style={{ fill: pal.lite }} />
      <path d={front} fill={`url(#${id})`} />
      {/* Specular highlight along the top-front edge */}
      <path d={`M ${x + 1.5},${y + 0.5} L ${x + width - 1.5},${y + 0.5}`} strokeWidth="1" strokeLinecap="round" style={HIGHLIGHT} />
    </g>
  );
}

/** Horizontal 3D bar — grows rightward, flat right edge. */
export function ArrowBar3DHorizontal(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, colored = false, neutral = false } = props;
  if (height <= 0 || width <= 0) return null;

  const pal = neutral ? neutralPalette() : paletteForIndex(colored ? index : 0);
  const depth = Math.min(height * 0.42, 9);
  const id = `harr-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${index}`;

  // Soft contact shadow — a short drop, not a full bar-height away.
  const shDx = 4;
  const shDy = Math.round(height * 0.5);

  const front = [`M ${x},${y}`, `L ${x + width},${y}`, `L ${x + width},${y + height}`, `L ${x},${y + height}`, "Z"].join(" ");
  const top = [`M ${x},${y}`, `L ${x + width},${y}`, `L ${x + width + depth},${y - depth}`, `L ${x + depth},${y - depth}`, "Z"].join(" ");
  // Right side face — fills the wedge between the bar's right edge and its
  // extruded back-right corner. Without this the bar end looks hollow.
  const side = [`M ${x + width},${y}`, `L ${x + width + depth},${y - depth}`, `L ${x + width + depth},${y + height - depth}`, `L ${x + width},${y + height}`, "Z"].join(" ");

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: pal.lite }} />
          <stop offset="50%" style={{ stopColor: pal.mid }} />
          <stop offset="100%" style={{ stopColor: pal.dark }} />
        </linearGradient>
      </defs>
      <path d={front} transform={`translate(${shDx} ${shDy})`} style={SHADOW} />
      <path d={side} opacity="0.82" style={{ fill: pal.dark }} />
      <path d={top} opacity="0.85" style={{ fill: pal.lite }} />
      <path d={front} fill={`url(#${id})`} />
      {/* Specular highlight along the top edge */}
      <path d={`M ${x + 0.5},${y + 0.5} L ${x + width - 1},${y + 0.5}`} strokeWidth="1" strokeLinecap="round" style={HIGHLIGHT} />
    </g>
  );
}

/** Same as ArrowBar3DHorizontal but cycles the chart palette by index. */
export function ArrowBar3DHorizontalColored(props: ShapeProps) {
  return <ArrowBar3DHorizontal {...props} colored />;
}

/** Single slate face — matches the aircraft nodes in the career Sankey. */
export function ArrowBar3DHorizontalNeutral(props: ShapeProps) {
  return <ArrowBar3DHorizontal {...props} neutral />;
}

/** @deprecated — kept for backward compat. Use ArrowBar3DHorizontal instead. */
export const CylinderBar = ArrowBar3DHorizontal;

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
  border: "1px solid rgb(var(--border))",
  boxShadow: "var(--shadow-pop)",
  background: "rgb(var(--surface))",
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
  const total = rows.reduce((s, r) => s + r.hours, 0) || 1;
  const height = Math.max(200, rows.length * 34 + 30);
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
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 56, bottom: 4, left: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} strokeDasharray="2 4" />
              <XAxis type="number" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={132} interval={0} axisLine={false} tickLine={false} tickFormatter={ellipsis} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "rgb(var(--ink-3))" }}
                itemStyle={{ color: "rgb(var(--ink-1))", fontWeight: 600 }}
                formatter={(v: unknown) => [`${nf(Number(v))} ${hoursUnit}`, strings.colHours]}
              />
              <Bar dataKey="hours" shape={<ArrowBar3DHorizontalNeutral />} isAnimationActive={!reduceMotion}>
                <LabelList dataKey="hours" position="right" offset={14} className="num" formatter={(v: unknown) => nf(Number(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={showTable ? "overflow-x-auto -mx-1" : "sr-only"}>
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
