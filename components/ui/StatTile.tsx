import type { ReactNode } from "react";
import { CountUp } from "@/components/CountUp";

export type Accent = "brand" | "pic" | "fo" | "dual" | "sic" | "me" | "se" | "good" | "warn" | "bad" | "neutral";
const ACCENT: Record<Accent, string> = {
  brand: "rgb(var(--brand))", pic: "rgb(var(--role-pic))", fo: "rgb(var(--role-fo))",
  dual: "rgb(var(--role-dual))", sic: "rgb(var(--role-sic))", me: "rgb(var(--cat-me))",
  se: "rgb(var(--cat-se))", good: "rgb(var(--good))", warn: "rgb(var(--warn))",
  bad: "rgb(var(--bad))", neutral: "rgb(var(--ink-3))",
};

/**
 * Flat KPI tile: 3px accent bar, small caps label, server-rendered number
 * (CountUp tweens it on the client), optional delta chip and sparkline.
 */
export function StatTile({
  label, value, decimals = 1, unit, accent = "brand", variant = "compact",
  delta, sparkline, className = "", href,
}: {
  label: ReactNode;
  value: number;
  decimals?: number;
  unit?: string;
  accent?: Accent;
  variant?: "hero" | "compact";
  /** e.g. { value: 18.3, label: "30 d" } → "+18.3 · 30 d" */
  delta?: { value: number; label: string; unit?: string };
  sparkline?: number[];
  className?: string;
  href?: string;
}) {
  const hero = variant === "hero";
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      href={href}
      className={`card relative overflow-hidden ${hero ? "p-4" : "p-3.5"} ${href ? "card-interactive" : ""} ${className}`}
      style={{ ["--accent" as string]: ACCENT[accent] }}
    >
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: "var(--accent)" }} />
      <div className="pl-2">
        <div className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-2">{label}</div>
        <div className={`mt-1 flex items-baseline gap-1.5 ${hero ? "text-num font-semibold" : "text-xl font-semibold"} text-ink-1`}>
          <CountUp value={value} decimals={decimals} />
          {unit && <span className="text-xs font-normal text-ink-3">{unit}</span>}
        </div>
        {(delta || sparkline) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {delta ? <DeltaChip {...delta} /> : <span />}
            {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function DeltaChip({ value, label, unit }: { value: number; label: string; unit?: string }) {
  const up = value > 0, flat = value === 0;
  const tone = flat ? "text-ink-3" : up ? "text-good-ink" : "text-bad-ink";
  return (
    <span className={`text-2xs font-medium num ${tone}`}>
      {flat ? "±0" : `${up ? "+" : "−"}${Math.abs(value).toFixed(1)}`}{unit ? ` ${unit}` : ""} <span className="text-ink-3 font-normal">· {label}</span>
    </span>
  );
}

/** Tiny inline sparkline — no chart library, 0 layout cost. */
export function Sparkline({ data, width = 72, height = 22 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(...data, 0.0001);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  const d = `M${pts.join(" L")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill="var(--accent)" opacity="0.10" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
