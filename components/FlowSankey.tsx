"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { Role } from "@/lib/types";

// Single source of truth for role colours across every Sankey and the
// dashboard legend. Values are CSS colour strings built from the design
// tokens in app/globals.css, so they are applied through `style` (SVG
// presentation attributes and inline styles both resolve `var()`).
export const ROLE_COLORS: Record<Role, string> = {
  PIC: "rgb(var(--role-pic))",
  FO: "rgb(var(--role-fo))",
  DUAL: "rgb(var(--role-dual))",
  SIC: "rgb(var(--role-sic))",
  CHECK: "rgb(var(--role-check))",
};
/** Neutral node colour (aircraft types). */
export const NODE_NEUTRAL = "rgb(var(--chart-8))";
/** Softer neutral for context columns (years). */
export const NODE_MUTED = "rgb(var(--chart-8) / 0.65)";

export type FlowNode = { name: string; color: string; kind?: string };
export type FlowLink = { source: number; target: number; value: number };

type Fmt = (n: number) => string;

type NodeShapeProps = {
  x?: number; y?: number; width?: number; height?: number;
  payload?: FlowNode & { depth?: number; value?: number };
  fmt: Fmt;
  mode: "wide" | "dense" | "tight";
  lastDepth: number;
};

// Source column labels sit to the right of the bar, every later column to the
// left, so text always points inward toward the flow (same convention as the
// finance-style diagrams this was modelled on). Every node gets a label —
// nodePadding keeps adjacent single-line labels apart, and the small rows are
// exactly the ones a reader can't identify from the ribbon alone. When the
// container is too narrow for inward-facing labels on both sides of a middle
// column, that column drops to name-only so it can't collide with its
// neighbours (the value is still in the tooltip).
function NodeShape({ x = 0, y = 0, width = 0, height = 0, payload, fmt, mode, lastDepth }: NodeShapeProps) {
  const depth = payload?.depth ?? 0;
  const onRight = depth === 0;
  const middle = depth > 0 && depth < lastDepth;
  const lx = onRight ? x + width + 8 : x - 8;
  const anchor = onRight ? "start" : "end";
  const name = payload?.name ?? "";
  const value = fmt(payload?.value ?? 0);
  const nameOnly = mode === "tight" || (mode === "dense" && middle);
  const compact = nameOnly || height < 24;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} style={{ fill: payload?.color ?? NODE_NEUTRAL }} />
      {compact ? (
        <text x={lx} y={y + height / 2} textAnchor={anchor} dominantBaseline="middle" className="text-2xs fill-ink-1">
          <tspan fontWeight={600}>{name}</tspan>
          {!nameOnly && <tspan className="mono text-2xs fill-ink-3">{`  ${value}`}</tspan>}
        </text>
      ) : (
        <text x={lx} y={y + height / 2} textAnchor={anchor} className="text-xs fill-ink-1">
          <tspan x={lx} dy="-0.2em" fontWeight={600}>{name}</tspan>
          <tspan x={lx} dy="1.3em" className="mono text-2xs fill-ink-3">{value}</tspan>
        </text>
      )}
    </g>
  );
}

type LinkShapeProps = {
  sourceX?: number; sourceY?: number; targetX?: number; targetY?: number;
  sourceControlX?: number; targetControlX?: number; linkWidth?: number;
  payload?: { source?: FlowNode; target?: FlowNode };
};

// Filled ribbon (top and bottom bezier edges) tinted by the destination node,
// instead of recharts' default stroked line.
function LinkShape({
  sourceX = 0, sourceY = 0, targetX = 0, targetY = 0,
  sourceControlX = 0, targetControlX = 0, linkWidth = 0, payload,
}: LinkShapeProps) {
  const h = Math.max(linkWidth, 1) / 2;
  const d = [
    `M${sourceX},${sourceY - h}`,
    `C${sourceControlX},${sourceY - h} ${targetControlX},${targetY - h} ${targetX},${targetY - h}`,
    `L${targetX},${targetY + h}`,
    `C${targetControlX},${targetY + h} ${sourceControlX},${sourceY + h} ${sourceX},${sourceY + h}`,
    "Z",
  ].join(" ");
  return <path d={d} stroke="none" style={{ fill: payload?.target?.color ?? NODE_NEUTRAL, fillOpacity: 0.38 }} />;
}

type TooltipEntry = { payload?: unknown; value?: unknown };
function FlowTooltip({ active, payload, fmt }: { active?: boolean; payload?: TooltipEntry[]; fmt: Fmt }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { name?: string; source?: FlowNode; target?: FlowNode; value?: number } | undefined;
  const isLink = Boolean(p?.source && p?.target);
  const title = isLink ? `${p?.source?.name} → ${p?.target?.name}` : (p?.name ?? "");
  const raw = typeof p?.value === "number" ? p.value : Number(payload[0]?.value ?? 0);
  return (
    <div className="card shadow-pop px-3 py-2 text-xs">
      <div className="text-ink-3">{title}</div>
      <div className="mono text-sm font-bold text-ink-1">{fmt(raw)}</div>
    </div>
  );
}

export default function FlowSankey({
  nodes, links, height, columns = 2,
  fmt = (n) => `${n.toFixed(1)} hrs`,
  nodeWidth = 14, nodePadding = 14,
  margin = { top: 12, right: 16, bottom: 12, left: 16 },
}: {
  nodes: FlowNode[];
  links: FlowLink[];
  height: number;
  /** Number of node columns (depth levels); drives the narrow-width label mode. */
  columns?: number;
  fmt?: Fmt;
  nodeWidth?: number;
  nodePadding?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}) {
  const data = useMemo(() => ({ nodes, links }), [nodes, links]);
  const [width, setWidth] = useState(0);
  // ResponsiveContainer measures the DOM; on the server (and the first client
  // paint) there is nothing to measure, so render a same-height skeleton
  // instead — no SSR warning, no layout shift when the chart appears.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Label density from the measured width. ~360px per column lets two
  // inward-facing "name + value" labels clear each other; below that, middle
  // columns go name-only; below ~220px per column (phones) every column does.
  const perCol = width > 0 ? width / columns : Infinity;
  const mode: "wide" | "dense" | "tight" = perCol < 220 ? "tight" : perCol < 360 ? "dense" : "wide";
  if (nodes.length === 0 || links.length === 0) return null;
  if (!mounted) return <div className="skeleton w-full" style={{ height }} aria-hidden />;
  return (
    <div className="min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
        {/* sort={false} + iterations={0} keep nodes in the order given, so a
            chronological input stays chronological instead of being shuffled
            by the crossing-minimisation pass. */}
        <Sankey
          key={mode}
          data={data}
          sort={false}
          iterations={0}
          nodeWidth={nodeWidth}
          nodePadding={nodePadding}
          linkCurvature={0.55}
          node={<NodeShape fmt={fmt} mode={mode} lastDepth={columns - 1} />}
          link={<LinkShape />}
          margin={margin}
        >
          <Tooltip content={<FlowTooltip fmt={fmt} />} wrapperStyle={{ outline: "none" }} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
