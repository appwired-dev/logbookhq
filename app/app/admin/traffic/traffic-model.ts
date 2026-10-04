/**
 * Pure view-model helpers for the admin Traffic tab, shared by the server page
 * and the client diagrams. No React, no next/*, no server imports.
 *
 * Everything here works on the single traffic_report() payload the page
 * fetched server-side; nothing fetches traffic data on the client.
 *
 * Privacy boundary: the only cross-tabulation in the data is the `flow` pair
 * (arrival source → landing page). So the only cross-filter on the page is
 * between Sources and Pages. Countries and devices are standalone marginals —
 * no helper here (or anywhere) derives "pages for a country" or similar.
 */
import {
  NOT_FOUND, SHARE_PAGE, splitFlow, utcDays,
  type TrafficDim, type TrafficReport,
} from "@/lib/site-stats-core";
import type { AdminOpsT } from "../admin-ops-strings";

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;

export function parseRange(v: string | string[] | undefined): Range {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : DEFAULT_RANGE;
}

/** "YYYY-MM-DD" shifted by whole UTC days. */
export function shiftDayISO(day: string, delta: number): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Daily series
// ---------------------------------------------------------------------------

/** One chart row. Previous-period day i is aligned with current day i (same offset into its window). */
export type DailyPoint = { day: string; prevDay: string; visits: number; views: number; prevVisits: number };

/** Every UTC day of the window, oldest first, zero-filled; the previous window rides along by offset. */
export function buildDailySeries(report: TrafficReport, range: number): DailyPoint[] {
  const days = utcDays(report.today, range);
  const prevDays = utcDays(shiftDayISO(report.today, -range), range);
  const cur = new Map(report.series.map((p) => [p.day, p]));
  const prev = new Map(report.prev_series.map((p) => [p.day, p]));
  return days.map((day, i) => ({
    day,
    prevDay: prevDays[i],
    visits: cur.get(day)?.landings ?? 0,
    views: cur.get(day)?.views ?? 0,
    prevVisits: prev.get(prevDays[i])?.landings ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Rows per dimension
// ---------------------------------------------------------------------------

export type DimRow = { value: string; visits: number; views: number };
export type FlowRow = { source: string; page: string; visits: number };

export function dimRows(report: TrafficReport, dim: Exclude<TrafficDim, "flow">): DimRow[] {
  return report.top
    .filter((r) => r.dim === dim)
    .map((r) => ({ value: r.value, visits: r.landings, views: r.views }));
}

/** Flow rows ("<source> → <page>", arrivals only) split into their parts; malformed values are dropped. */
export function flowRows(report: TrafficReport): FlowRow[] {
  const out: FlowRow[] = [];
  for (const r of report.top) {
    if (r.dim !== "flow" || r.landings <= 0) continue;
    const parts = splitFlow(r.value);
    if (parts) out.push({ source: parts.source, page: parts.page, visits: r.landings });
  }
  return out;
}

/** Pages by views (the Pages list order), then visits. */
export const byViews = (a: DimRow, b: DimRow) => b.views - a.views || b.visits - a.visits || a.value.localeCompare(b.value);
/** Everything else by visits, then views. */
export const byVisits = (a: DimRow, b: DimRow) => b.visits - a.visits || b.views - a.views || a.value.localeCompare(b.value);

// ---------------------------------------------------------------------------
// Labels (values are shown as plain text, never as links)
// ---------------------------------------------------------------------------

export const DIRECT_SOURCE = "(direct)";
export const OTHER_SOURCE = "(other)";

export function pageLabel(value: string, o: AdminOpsT): string {
  if (value === NOT_FOUND) return o("pageNotFound");
  if (value === SHARE_PAGE) return o("pageShare");
  return value;
}

export function sourceText(value: string, o: AdminOpsT): string {
  if (value === DIRECT_SOURCE) return o("srcDirect");
  if (value === OTHER_SOURCE) return o("srcOther");
  return value;
}

export function campaignText(value: string, o: AdminOpsT): string {
  return value === OTHER_SOURCE ? o("srcOther") : value;
}

export function deviceText(value: string, o: AdminOpsT): string {
  if (value === "mobile") return o("devMobile");
  if (value === "tablet") return o("devTablet");
  if (value === "desktop") return o("devDesktop");
  return value;
}

const regionNames = new Map<string, Intl.DisplayNames | null>();
/** Localised country name for an alpha-2 code; "XX" (or anything malformed) is Unknown. */
export function countryText(code: string, locale: string, o: AdminOpsT): string {
  if (code === "XX" || !/^[A-Z]{2}$/.test(code)) return o("countryUnknown");
  let dn = regionNames.get(locale);
  if (dn === undefined) {
    try {
      dn = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      dn = null;
    }
    regionNames.set(locale, dn);
  }
  try {
    return dn?.of(code) ?? code;
  } catch {
    return code;
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function intFormatter(locale: string): (n: number) => string {
  const f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return (n) => f.format(n);
}

/** 0.0734 → "7.3%", 0.42 → "42%", 0 → "0%". */
export function shareFormatter(locale: string): (share: number) => string {
  const fine = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const coarse = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return (s) => (s > 0 && s < 0.1 ? fine : coarse).format(s);
}

/** A localised UTC calendar day ("Oct 4"). */
export function dayFormatter(locale: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
  return (day: string) => f.format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

export const share = (part: number, whole: number) => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0);

// ---------------------------------------------------------------------------
// Flow model (Sankey + the Sources/Pages cross-filter)
// ---------------------------------------------------------------------------

const SOURCE_PALETTE = [
  "rgb(var(--chart-1))", "rgb(var(--chart-4))", "rgb(var(--chart-2))", "rgb(var(--chart-3))",
  "rgb(var(--chart-7))", "rgb(var(--chart-6))", "rgb(var(--chart-5))",
] as const;
/**
 * Coloured sources drawn as their own Sankey node: one per palette colour, so no two
 * sources ever share a ribbon colour. "Direct" (neutral) is drawn in addition; the rest
 * fold into the "Other" node, and each folded source stays selectable from the list.
 */
export const MAX_FLOW_SOURCES = SOURCE_PALETTE.length;
const DIRECT_COLOR = "rgb(var(--chart-8))";
const OTHER_COLOR = "rgb(var(--chart-8) / 0.55)";
export const PAGE_NODE_COLOR = "rgb(var(--brand-deep))";

export type FlowSide = "source" | "page";
/**
 * One shared focus for the Sankey and the Sources/Pages lists. `key` is a node key; `raw` is set
 * when one folded source is picked from the Sources list (the Sankey highlights "Other", the
 * lists narrow to that single source).
 */
export type FlowFocus = { side: FlowSide; key: string; raw?: string } | null;

export type FlowNodeModel = { key: string; side: FlowSide; label: string; value: number; color: string };
/** `source` / `target` index into [...sources, ...pages] (recharts' node array). */
export type FlowLinkModel = { source: number; target: number; value: number; sourceKey: string; pageKey: string };

export type FlowModel = {
  sources: FlowNodeModel[];
  pages: FlowNodeModel[];
  links: FlowLinkModel[];
  /** Raw source value → its node key (itself, or OTHER_SOURCE when folded). Only sources present in flows. */
  sourceKey: ReadonlyMap<string, string>;
  /** Raw source values folded into the Other node (beyond MAX_FLOW_SOURCES). */
  folded: readonly string[];
  total: number;
};

function sumBy<K>(rows: FlowRow[], key: (r: FlowRow) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.visits);
  return m;
}
const desc = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

export function buildFlowModel(
  rows: FlowRow[],
  label: { source: (v: string) => string; page: (v: string) => string },
): FlowModel {
  const bySource = [...sumBy(rows, (r) => r.source)].sort(desc);
  const named = bySource.filter(([s]) => s !== OTHER_SOURCE);
  // Direct is neutral grey and always drawn; every other source needs its own palette colour.
  const kept = new Set<string>();
  let coloured = 0;
  for (const [s] of named) {
    if (s === DIRECT_SOURCE) kept.add(s);
    else if (coloured < MAX_FLOW_SOURCES) { kept.add(s); coloured++; }
  }
  const sourceKey = new Map<string, string>();
  const folded: string[] = [];
  for (const [s] of bySource) {
    const k = kept.has(s) ? s : OTHER_SOURCE;
    sourceKey.set(s, k);
    if (k === OTHER_SOURCE && s !== OTHER_SOURCE) folded.push(s);
  }

  const nodeTotals = [...sumBy(rows, (r) => sourceKey.get(r.source)!)].sort((a, b) =>
    a[0] === OTHER_SOURCE ? 1 : b[0] === OTHER_SOURCE ? -1 : desc(a, b));
  let palette = 0;
  const sources: FlowNodeModel[] = nodeTotals.map(([key, value]) => ({
    key,
    side: "source",
    label: label.source(key),
    value,
    color: key === OTHER_SOURCE ? OTHER_COLOR : key === DIRECT_SOURCE ? DIRECT_COLOR : SOURCE_PALETTE[palette++],
  }));
  const pages: FlowNodeModel[] = [...sumBy(rows, (r) => r.page)].sort(desc).map(([key, value]) => ({
    key, side: "page", label: label.page(key), value, color: PAGE_NODE_COLOR,
  }));

  const sIdx = new Map(sources.map((n, i) => [n.key, i] as const));
  const pIdx = new Map(pages.map((n, i) => [n.key, sources.length + i] as const));
  const agg = new Map<string, FlowLinkModel>();
  for (const r of rows) {
    const sk = sourceKey.get(r.source)!;
    const id = `${sk}\u0000${r.page}`;
    const cur = agg.get(id);
    if (cur) cur.value += r.visits;
    else agg.set(id, { source: sIdx.get(sk)!, target: pIdx.get(r.page)!, value: r.visits, sourceKey: sk, pageKey: r.page });
  }
  const links = [...agg.values()].sort((a, b) => a.source - b.source || a.target - b.target);
  const total = rows.reduce((t, r) => t + r.visits, 0);
  return { sources, pages, links, sourceKey, folded, total };
}

export function linkInFocus(link: FlowLinkModel, focus: FlowFocus): boolean {
  if (!focus) return true;
  return focus.side === "source" ? link.sourceKey === focus.key : link.pageKey === focus.key;
}

/** Node keys touched by the focus: the focused node plus everything linked to it. */
export function focusedNodeKeys(model: FlowModel, focus: FlowFocus): { sources: Set<string>; pages: Set<string> } | null {
  if (!focus) return null;
  const sources = new Set<string>();
  const pages = new Set<string>();
  if (focus.side === "source") sources.add(focus.key);
  else pages.add(focus.key);
  for (const l of model.links) {
    if (!linkInFocus(l, focus)) continue;
    sources.add(l.sourceKey);
    pages.add(l.pageKey);
  }
  return { sources, pages };
}

/** Landing pages reached from the focused source node (or one folded raw source), by visits. */
export function pagesFromSource(rows: FlowRow[], model: FlowModel, key: string, raw?: string): DimRow[] {
  const m = sumBy(rows.filter((r) => (raw ? r.source === raw : model.sourceKey.get(r.source) === key)), (r) => r.page);
  return [...m].sort(desc).map(([value, visits]) => ({ value, visits, views: 0 }));
}

/** Raw sources arriving on the focused page, by visits. */
export function sourcesToPage(rows: FlowRow[], page: string): DimRow[] {
  const m = sumBy(rows.filter((r) => r.page === page), (r) => r.source);
  return [...m].sort(desc).map(([value, visits]) => ({ value, visits, views: 0 }));
}

// ---------------------------------------------------------------------------
// Count phrases ("1 visit" / "2 visits"; ko/zh have one form, es two)
// ---------------------------------------------------------------------------

export type CountKind = "Visits" | "Views" | "Sources" | "Pages" | "Countries";

/** A localised, plural-correct count phrase, e.g. countPhrase(o, "es", 1, "Visits", nf) → "1 visita". */
export function countPhrase(o: AdminOpsT, locale: string, n: number, kind: CountKind, fmt: (n: number) => string): string {
  let one = n === 1;
  try { one = new Intl.PluralRules(locale).select(n) === "one"; } catch { /* keep the n === 1 fallback */ }
  return o(`count${kind}${one ? "One" : "Other"}` as Parameters<AdminOpsT>[0], { n: fmt(n) });
}
