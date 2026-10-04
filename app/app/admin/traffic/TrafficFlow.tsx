"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type ReactElement, type SVGProps } from "react";
import { ResponsiveContainer, Sankey, Tooltip, type SankeyLinkProps, type SankeyNodeProps } from "recharts";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { adminOpsStrings, type AdminOpsT } from "../admin-ops-strings";
import { focusedNodeKeys, intFormatter, type FlowFocus, type FlowModel, type FlowNodeModel, type FlowSide, countPhrase } from "./traffic-model";

/**
 * Arrivals Sankey: sources (left) → landing pages (right), ribbon width =
 * visits, ribbons tinted by their source. Built on recharts' Sankey with the
 * same ribbon/node shapes and `.lp-ribbon` / `.lp-snode` styling as
 * components/FlowSankey.tsx, whose API has no focus or keyboard support.
 *
 *  - Hover a ribbon: it lifts (CSS) and the tooltip reads "source → page: n".
 *  - Click, Enter or Space on a node toggles the shared focus (owned by
 *    FlowExplorer, which also filters the Sources / Pages lists): the
 *    focused node's ribbons stay in colour, everything else dims.
 *  - Nodes are real focus stops (role="button", aria-pressed) with a visible
 *    ring for keyboard focus; Escape (handled by FlowExplorer) clears.
 *
 * The parent supplies the sr-only table of flows and the empty state.
 */

const NODE_W = 10;
const NODE_PADDING = 14;
const MARGIN = { top: 8, right: 4, bottom: 8, left: 4 } as const;
/** Average glyph advance for 12 px semibold labels — used to clip long page paths. */
const CHAR_PX = 6.8;
/** Surface-coloured halo behind node labels, so they stay legible where they cross ribbons. */
const LABEL_HALO = { paintOrder: "stroke", stroke: "rgb(var(--surface))", strokeWidth: 3, strokeLinejoin: "round" } as const;

/** Our node fields, as recharts hands them back on `payload` (plus its layout fields). */
type SNode = FlowNodeModel & { name: string };

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

export default function TrafficFlow({ model, focus, onToggle, height, locale }: {
  model: FlowModel;
  focus: FlowFocus;
  onToggle: (side: FlowSide, key: string) => void;
  height: number;
  locale: Locale;
}) {
  const o = useMemo(() => adminOpsStrings(locale), [locale]);
  const nf = useMemo(() => intFormatter(locale), [locale]);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  /** Node id ("side:key") showing the keyboard focus ring. */
  const [ring, setRing] = useState<string | null>(null);

  const data = useMemo(() => ({
    nodes: [...model.sources, ...model.pages].map((n) => ({ ...n, name: n.label })),
    links: model.links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
  }), [model]);

  const touched = useMemo(() => focusedNodeKeys(model, focus), [model, focus]);

  // Labels face inward; each side gets ~40% of the inner width before clipping.
  const inner = Math.max(0, width - MARGIN.left - MARGIN.right - 2 * NODE_W);
  const labelPx = width > 0 ? Math.max(56, inner * 0.4) : 200;
  const maxChars = Math.max(6, Math.floor(labelPx / CHAR_PX));

  const renderNode = useCallback((props: SankeyNodeProps) => {
    const { x, y, width: w, height: h } = props;
    const n = props.payload as unknown as SNode;
    const id = `${n.side}:${n.key}`;
    const left = n.side === "source";
    const active = !touched || (left ? touched.sources.has(n.key) : touched.pages.has(n.key));
    const pressed = !!focus && focus.side === n.side && focus.key === n.key;
    const lx = left ? x + w + 8 : x - 8;
    const anchor = left ? "start" : "end";
    const value = nf(n.value);
    const twoLine = h >= 26;
    // Node + half the gap on each side: neighbours' hit areas meet but never overlap (list rows give 44 px targets).
    const hitH = h + NODE_PADDING;
    const hitW = w + 8 + Math.min(labelPx, n.label.length * CHAR_PX + 40);
    const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(n.side, n.key);
      }
    };
    return (
      <g
        role="button"
        tabIndex={0}
        aria-pressed={pressed}
        aria-label={`${n.label}, ${o("statVisits")}: ${value}`}
        onClick={() => onToggle(n.side, n.key)}
        onKeyDown={onKeyDown}
        onFocus={(e) => setRing(e.currentTarget.matches(":focus-visible") ? id : null)}
        onBlur={() => setRing((r) => (r === id ? null : r))}
        style={{
          outline: "none",
          cursor: "pointer",
          opacity: active ? 1 : 0.35,
          transition: reduceMotion ? undefined : "opacity 180ms ease",
        }}
      >
        {/* Generous transparent hit area: bar + label, at least 22 px tall. */}
        <rect
          x={left ? x - 4 : x + w + 4 - hitW}
          y={y + h / 2 - hitH / 2}
          width={hitW}
          height={hitH}
          fill="transparent"
        />
        {ring === id && (
          <rect
            x={x - 4} y={y - 4} width={w + 8} height={Math.max(h, 2) + 8} rx={5}
            fill="none" style={{ stroke: "rgb(var(--brand))", strokeWidth: 2 }}
          />
        )}
        <rect className="lp-snode" x={x} y={y} width={w} height={Math.max(h, 2)} rx={3} style={{ fill: n.color }} />
        {pressed && (
          <rect
            x={x - 2} y={y - 2} width={w + 4} height={Math.max(h, 2) + 4} rx={4}
            fill="none" style={{ stroke: "rgb(var(--ink-1))", strokeWidth: 1.5 }}
          />
        )}
        {twoLine ? (
          <text x={lx} y={y + h / 2} textAnchor={anchor} className="text-xs fill-ink-1" style={LABEL_HALO}>
            <tspan x={lx} dy="-0.2em" fontWeight={600}>{clip(n.label, maxChars)}</tspan>
            <tspan x={lx} dy="1.3em" className="mono text-2xs fill-ink-3">{value}</tspan>
          </text>
        ) : (
          <text x={lx} y={y + h / 2} textAnchor={anchor} dominantBaseline="middle" className="text-2xs fill-ink-1" style={LABEL_HALO}>
            <tspan fontWeight={600}>{clip(n.label, Math.max(4, maxChars - value.length - 2))}</tspan>
            <tspan className="mono text-2xs fill-ink-3">{`  ${value}`}</tspan>
          </text>
        )}
      </g>
    );
  }, [touched, focus, nf, o, onToggle, labelPx, maxChars, ring, reduceMotion]);

  const renderLink = useCallback((props: SankeyLinkProps): ReactElement<SVGProps<SVGPathElement>> => {
    const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth } = props;
    const s = props.payload.source as unknown as SNode;
    const t = props.payload.target as unknown as SNode;
    const on = !focus || (focus.side === "source" ? s.key === focus.key : t.key === focus.key);
    const half = Math.max(linkWidth, 1) / 2;
    const d = [
      `M${sourceX},${sourceY - half}`,
      `C${sourceControlX},${sourceY - half} ${targetControlX},${targetY - half} ${targetX},${targetY - half}`,
      `L${targetX},${targetY + half}`,
      `C${targetControlX},${targetY + half} ${sourceControlX},${sourceY + half} ${sourceX},${sourceY + half}`,
      "Z",
    ].join(" ");
    // No inline opacity without a focus, so the shared `.lp-ribbon` hover
    // (lift one, dim the rest) applies; with a focus, React owns the dimming.
    return (
      <path
        className={focus && !on ? "lp-ribbon lp-dim" : "lp-ribbon"}
        d={d}
        stroke="none"
        style={{ fill: s.color, ...(focus ? { fillOpacity: on ? 0.55 : 0.06 } : null) }}
      />
    );
  }, [focus]);

  if (model.links.length === 0) return null;

  return (
    <div className="min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
        {/* sort={false} + iterations={0} keep the given order: biggest first, "Other" last. */}
        <Sankey
          data={data}
          sort={false}
          iterations={0}
          nodeWidth={NODE_W}
          nodePadding={NODE_PADDING}
          linkCurvature={0.5}
          margin={MARGIN}
          node={renderNode}
          link={renderLink}
        >
          <Tooltip
            wrapperStyle={{ outline: "none" }}
            content={(p) => <FlowTip entry={p.active ? p.payload?.[0]?.payload : undefined} o={o} nf={nf} locale={locale} />}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

function FlowTip({ entry, o, nf, locale }: { entry: unknown; o: AdminOpsT; nf: (n: number) => string; locale: string }) {
  if (!entry || typeof entry !== "object") return null;
  const p = entry as { source?: SNode; target?: SNode; value?: number; label?: string; name?: string };
  const value = typeof p.value === "number" ? p.value : 0;
  if (p.source && p.target) {
    return (
      <div className="card shadow-pop px-3 py-2 text-xs text-ink-1 max-w-[18rem]">
        {o("flowTooltip", { source: p.source.label, page: p.target.label, visits: countPhrase(o, locale, value, "Visits", nf) })}
      </div>
    );
  }
  return (
    <div className="card shadow-pop px-3 py-2 text-xs max-w-[18rem]">
      <div className="text-ink-3 break-words">{p.label ?? p.name}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="mono text-sm font-bold text-ink-1">{nf(value)}</span>
        <span className="text-2xs text-ink-3">{o("statVisits")}</span>
      </div>
    </div>
  );
}
