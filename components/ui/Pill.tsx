import type { ReactNode } from "react";

/** Full class strings (not templates) so Tailwind's purge keeps every variant. */
const PILL: Record<string, string> = {
  pic: "pill-pic", dual: "pill-dual", fo: "pill-fo", sic: "pill-sic-role", aug: "pill-aug", check: "pill-check",
  se: "pill-se", me: "pill-me", ses: "pill-ses", mes: "pill-mes", heli: "pill-heli", sim: "pill-sim", xc: "pill-xc",
  good: "pill-good", warn: "pill-warn", bad: "pill-bad", neutral: "pill-neutral", inverse: "pill-inverse",
};
export type PillVariant = keyof typeof PILL;

export function Pill({ variant = "neutral", children, className = "", title }: {
  variant?: PillVariant | string; children: ReactNode; className?: string; title?: string;
}) {
  const cls = PILL[variant.toLowerCase()] ?? PILL.neutral;
  return <span className={`${cls} ${className}`} title={title}>{children}</span>;
}

/** Map a flight role/category to its pill variant. */
export const rolePill = (role: string) => (role === "SIC" ? "sic" : role.toLowerCase());
export const categoryPill = (cat: string) => cat.toLowerCase();
