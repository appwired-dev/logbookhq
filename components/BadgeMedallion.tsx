import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  Rocket, Bird, Moon, Compass, CloudFog, Plane, Globe2, MapPinned,
  Star, Award, Trophy, Crown, Gem, Medal, Target, Clock, Sparkles,
} from "lucide-react";

/**
 * Maps a badge `id` to a custom PNG filename (without the .png extension).
 * Add an entry here when a designer-supplied PNG uses a name that differs
 * from the canonical badge id (e.g. "ppl_bronze" instead of "ppl").
 *
 * BadgeMedallion checks `<id>.png` first, then this override, then falls
 * back to the Lucide medallion.
 */
const PNG_OVERRIDES: Record<string, string> = {
  // Certification
  "ppl":            "ppl_bronze",
  "cpl":            "cpl_silver",
  "atpl":           "airliner_gold",
  "night-rating":   "night_rating",
  "ifr-rating":     "ifr_rating",
  "me-rating":      "multi_engine_rating_gold",
  // Firsts
  "first-me":       "seneca_bronze",
  // Hour milestones (aircraft variants by tier — follows the infographic
  // ladder Cessna152 → CirrusSR22 → KingAir → Citation → A320 → B787).
  "total-50":       "cessna152_bronze",
  "total-500":      "a320_silver",
  "total-1000":     "citation_gold",
  "total-1500":     "a320_gold",
  // Endurance
  "long-haul":      "long_haul",
  "ultra-long":     "ultra_long",
  // Aircraft type milestones
  "types-5":        "aircraft_types",
  "types-10":       "aircraft_types",
  "types-20":       "milestone_master",
};

/**
 * Per-badge pixel size overrides. Use when a specific design needs to render
 * smaller or larger than the default to look right next to others. Width is
 * a percentage of the default `size` prop — 0.85 means "render at 85%".
 */
const SIZE_SCALE: Record<string, number> = {
  "ppl":                 0.85, // shield+wings is visually heavier than others
  "first-ifr":           0.65, // compass+cloud composition reads big
  "first-me":            0.9,  // front-on twin reads wider than others
  "first-international": 0.9,  // winged globe is visually busy
  "night-rating":        0.85, // tall moon sculpture
  "first-night":         0.9,  // tall moon
  "ifr-rating":          0.85, // compass + cloud rating piece
  "long-haul":           0.85, // soft drop-shadow on the pocket watch was clipping
  "cpl":                 1.15, // bronze winged trophy benefits from a size bump
  // PIC rank stripes — all slightly smaller so they don't dominate
  "pic-500":             0.9,
  "pic-1000":            0.9,
  "pic-1500":            0.9,
  "pic-3000":            0.9,
  "types-5":             0.85, // star cluster — bump up from 0.65
  "types-10":            0.85, // same source PNG as types-5
  "types-20":            1.3,  // laurel-wreath gets the headline size
};

/**
 * Per-badge horizontal nudge in pixels. Positive = right, negative = left.
 * Use when a design's visual center doesn't match its bounding-box center.
 */
const X_OFFSET: Record<string, number> = {
  "cpl":                -30, // pull left (winged trophy's visual mass is right)
  "atpl":                 0, // centered
  "long-haul":           12, // push right (pocket watch hangs left)
  "first-international":  0, // centered (was -10)
  "types-20":            32, // push right
};

/**
 * Per-badge vertical nudge in pixels. Positive = down, negative = up.
 */
const Y_OFFSET: Record<string, number> = {
  "types-20": -10, // lift the laurel-wreath up so it doesn't crowd the title
};

/**
 * Returns the public URL of the badge PNG to render, or `false` if no PNG
 * is available for this id (caller falls back to the Lucide medallion).
 *
 * Hits the filesystem on every check intentionally — `existsSync` is cheap
 * (a single stat per badge) and the alternative (in-memory cache) would
 * stick with stale "false" results when designers drop in new files mid-dev.
 */
function badgePngUrl(id: string): string | false {
  const candidates = [id, PNG_OVERRIDES[id]].filter(Boolean) as string[];
  for (const name of candidates) {
    const p = join(process.cwd(), "public", "badges", `${name}.png`);
    if (existsSync(p)) return `/badges/${name}.png`;
  }
  return false;
}

/**
 * Visual tier of an achievement. Drives the medallion's gradient and ring
 * colors — bronze for entry-level firsts, gold/platinum/diamond for the
 * harder career milestones.
 */
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/**
 * Symbol shown in the center of the medallion. Maps to a Lucide icon.
 */
export type BadgeKind =
  | "rocket" | "eagle" | "moon" | "compass" | "fog" | "twin" | "passport"
  | "star" | "award" | "trophy" | "crown" | "gem" | "medal" | "sparkles"
  | "target" | "clock" | "globe" | "plane";

const KIND_ICONS: Record<BadgeKind, typeof Rocket> = {
  rocket: Rocket,
  eagle: Bird,
  moon: Moon,
  compass: Compass,
  fog: CloudFog,
  twin: Plane,
  passport: MapPinned,
  star: Star,
  award: Award,
  trophy: Trophy,
  crown: Crown,
  gem: Gem,
  medal: Medal,
  sparkles: Sparkles,
  target: Target,
  clock: Clock,
  globe: Globe2,
  plane: Plane,
};

/**
 * Each tier's gradient + ring tones. Picked so the medallion reads
 * unambiguously as bronze / silver / gold / platinum / diamond on a card
 * background, with a subtle outer glow appropriate to its prestige.
 */
const TIER_THEMES: Record<BadgeTier, {
  g1: string; g2: string; ring: string; glow: string;
}> = {
  bronze: {   g1: "#fbbf24", g2: "#b45309", ring: "#92400e", glow: "rgba(180,83,9,0.35)" },
  silver: {   g1: "#f1f5f9", g2: "#64748b", ring: "#475569", glow: "rgba(100,116,139,0.30)" },
  gold: {     g1: "#fde047", g2: "#b45309", ring: "#a16207", glow: "rgba(245,158,11,0.40)" },
  platinum: { g1: "#c7d2fe", g2: "#4f46e5", ring: "#4338ca", glow: "rgba(99,102,241,0.40)" },
  diamond: {  g1: "#67e8f9", g2: "#0891b2", ring: "#0e7490", glow: "rgba(8,145,178,0.45)" },
};

/**
 * Circular achievement medallion. When a PNG exists at
 * /public/badges/{id}.png, it's rendered directly so designers can drop in
 * polished 3D-rendered artwork incrementally. Otherwise falls back to the
 * tier-themed gradient + Lucide icon medallion.
 *
 * Server-renderable. Greys out when `earned` is false.
 */
export function BadgeMedallion({
  id, kind, tier, earned = true, size = 128,
}: {
  id?: string;
  kind: BadgeKind;
  tier: BadgeTier;
  earned?: boolean;
  size?: number;
}) {
  // Per-badge size scaling — some designs read better at a smaller size.
  const scale = (id ? SIZE_SCALE[id] : undefined) ?? 1;
  const effSize = Math.round(size * scale);
  const xNudge = (id ? X_OFFSET[id] : undefined) ?? 0;
  const yNudge = (id ? Y_OFFSET[id] : undefined) ?? 0;
  const transform = (xNudge || yNudge)
    ? `translate(${xNudge}px, ${yNudge}px)`
    : undefined;

  // Prefer a hand-crafted PNG when one has been dropped in for this badge.
  const pngUrl = id ? badgePngUrl(id) : false;
  if (pngUrl) {
    return (
      <div
        className={`shrink-0 mx-auto ${earned ? "" : "grayscale opacity-35"}`}
        style={{ width: effSize, height: effSize, transform }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pngUrl}
          alt=""
          width={effSize}
          height={effSize}
          className="w-full h-full object-contain"
          style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.18))" }}
        />
      </div>
    );
  }

  const Icon = KIND_ICONS[kind];
  const t = TIER_THEMES[tier];
  const iconSize = Math.round(size * 0.5);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${
        earned ? "" : "grayscale opacity-35"
      }`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${t.g1} 0%, ${t.g2} 75%, ${t.ring} 100%)`,
        boxShadow: [
          `inset 0 -2px 3px ${t.ring}`,
          "inset 0 2px 3px rgba(255,255,255,0.55)",
          `0 4px 12px ${t.glow}`,
        ].join(", "),
        border: `1.5px solid ${t.ring}`,
      }}
      aria-hidden
    >
      <Icon
        size={iconSize}
        strokeWidth={2.25}
        color="white"
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.30))" }}
      />
    </div>
  );
}
