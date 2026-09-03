"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { Role } from "@/lib/types";

// Single source of truth for role colours across every Sankey and the
// dashboard legend (tailwind blue/emerald/amber/violet/fuchsia-500).
export const ROLE_COLORS: Record<Role, string> = {
  PIC: "#3b82f6",
  FO: "#10b981",
  DUAL: "#f59e0b",
  SIC: "#8b5cf6",
  CHECK: "#d946ef",
};

export type FlowNode = { name: string; color: string; kind?: string };
export type FlowLink = { source: number; target: number; value: number };

type Fmt = (n: number) => string;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

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
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} fill={payload?.color ?? "#94a3b8"} />
      {compact ? (
        <text x={lx} y={y + height / 2} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="#334155">
          <tspan fontWeight={600}>{name}</tspan>
          {!nameOnly && <tspan fill="#64748b" fontFamily={MONO} fontSize={10}>{`  ${value}`}</tspan>}
        </text>
      ) : (
        <text x={lx} y={y + height / 2} textAnchor={anchor} fontSize={12} fill="#1e293b">
          <tspan x={lx} dy="-0.2em" fontWeight={600}>{name}</tspan>
          <tspan x={lx} dy="1.3em" fill="#64748b" fontFamily={MONO} fontSize={11}>{value}</tspan>
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
  return <path d={d} fill={payload?.target?.color ?? "#94a3b8"} fillOpacity={0.38} stroke="none" />;
}

type TooltipEntry = { payload?: unknown; value?: unknown };
function FlowTooltip({ active, payload, fmt }: { active?: boolean; payload?: TooltipEntry[]; fmt: Fmt }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { name?: string; source?: FlowNode; target?: FlowNode; value?: number } | undefined;
  const isLink = Boolean(p?.source && p?.target);
  const title = isLink ? `${p?.source?.name} → ${p?.target?.name}` : (p?.name ?? "");
  const raw = typeof p?.value === "number" ? p.value : Number(payload[0]?.value ?? 0);
  return (
    <div style={{
      borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 12px", fontSize: 12,
      boxShadow: "0 8px 24px rgba(15,23,42,0.10)", background: "rgba(255,255,255,0.98)",
    }}>
      <div style={{ color: "#64748b" }}>{title}</div>
      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, fontFamily: MONO }}>{fmt(raw)}</div>
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
  // Label density from the measured width. ~360px per column lets two
  // inward-facing "name + value" labels clear each other; below that, middle
  // columns go name-only; below ~220px per column (phones) every column does.
  const perCol = width > 0 ? width / columns : Infinity;
  const mode: "wide" | "dense" | "tight" = perCol < 220 ? "tight" : perCol < 360 ? "dense" : "wide";
  if (nodes.length === 0 || links.length === 0) return null;
  return (
    <div style={{ height }}>
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
