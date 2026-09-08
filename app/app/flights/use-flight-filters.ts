"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { creditedHours } from "@/lib/derive";
import type { Locale } from "@/lib/i18n";
import type { Category, FlightDerived, Role } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Sort keys                                                                   */
/* -------------------------------------------------------------------------- */

/** Columns that sort directly on a FlightDerived field. */
export const FIELD_SORT_KEYS = [
  "date", "make_model", "registration", "route", "category", "role",
  "pic", "copilot", "third_pilot", "check_pilot",
  "day_time", "night_time", "total_time", "is_xcountry", "cfi_time",
  "actual_inst", "hood_inst", "sim_inst",
  "ifr_approaches", "precision_approaches", "non_precision_approaches", "holds",
  "remarks",
] as const satisfies readonly (keyof FlightDerived)[];

/** Computed columns (day + night). */
export const VIRTUAL_SORT_KEYS = ["takeoffs", "landings"] as const;

export type SortKey = (typeof FIELD_SORT_KEYS)[number] | (typeof VIRTUAL_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

const SORT_KEY_SET: ReadonlySet<string> = new Set<string>([...FIELD_SORT_KEYS, ...VIRTUAL_SORT_KEYS]);
export const isSortKey = (v: string): v is SortKey => SORT_KEY_SET.has(v);

export const DEFAULT_SORT_KEY: SortKey = "date";
export const DEFAULT_SORT_DIR: SortDir = "desc";

/** Text columns open A→Z; dates, hours, counts and flags open largest-first. */
const TEXT_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  "make_model", "registration", "route", "category", "role",
  "pic", "copilot", "third_pilot", "check_pilot", "remarks",
]);
export const defaultDirFor = (k: SortKey): SortDir => (TEXT_KEYS.has(k) ? "asc" : "desc");

/* -------------------------------------------------------------------------- */
/* Option lists                                                                */
/* -------------------------------------------------------------------------- */

export const CATEGORY_ORDER: readonly Category[] = ["SE", "ME", "SES", "MES", "HELI", "SIM"];
export const ROLE_ORDER: readonly Role[] = ["DUAL", "PIC", "FO", "SIC", "CHECK"];
export const isCategory = (v: string): v is Category => (CATEGORY_ORDER as readonly string[]).includes(v);
export const isRole = (v: string): v is Role => (ROLE_ORDER as readonly string[]).includes(v);

/* -------------------------------------------------------------------------- */
/* URL contract: ?q=&y=&cat=&role=&sort=<key>:<asc|desc>                       */
/* -------------------------------------------------------------------------- */

export const PARAM = { q: "q", year: "y", cat: "cat", role: "role", sort: "sort", saved: "saved" } as const;

export type FlightFilters = {
  q: string;
  /** "YYYY" or "" for all years. */
  year: string;
  /** Category code or "". */
  cat: string;
  /** Role code or "". */
  role: string;
  sortKey: SortKey;
  sortDir: SortDir;
};

type ParamsLike = { get(name: string): string | null };

export function parseFilters(sp: ParamsLike): FlightFilters {
  const [rawKey = "", rawDir = ""] = (sp.get(PARAM.sort) ?? "").split(":");
  const sortKey: SortKey = isSortKey(rawKey) ? rawKey : DEFAULT_SORT_KEY;
  const sortDir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : isSortKey(rawKey) ? defaultDirFor(sortKey) : DEFAULT_SORT_DIR;
  const year = sp.get(PARAM.year) ?? "";
  const cat = (sp.get(PARAM.cat) ?? "").toUpperCase();
  const role = (sp.get(PARAM.role) ?? "").toUpperCase();
  return {
    q: sp.get(PARAM.q) ?? "",
    year: /^\d{4}$/.test(year) ? year : "",
    cat: isCategory(cat) ? cat : "",
    role: isRole(role) ? role : "",
    sortKey,
    sortDir,
  };
}

/** Query string for `f` ("" when everything is at its default). Keeps unrelated params. */
export function serializeFilters(f: FlightFilters, base?: URLSearchParams): string {
  const p = new URLSearchParams(base);
  for (const key of Object.values(PARAM)) p.delete(key);
  const q = f.q.trim();
  if (q) p.set(PARAM.q, q);
  if (f.year) p.set(PARAM.year, f.year);
  if (f.cat) p.set(PARAM.cat, f.cat);
  if (f.role) p.set(PARAM.role, f.role);
  if (f.sortKey !== DEFAULT_SORT_KEY || f.sortDir !== DEFAULT_SORT_DIR) p.set(PARAM.sort, `${f.sortKey}:${f.sortDir}`);
  const s = p.toString().replace(/%3A/g, ":");
  return s ? `?${s}` : "";
}

const Q_DEBOUNCE_MS = 250;

/**
 * Sync the URL without a server round-trip. Next.js (≥ 14.1) patches
 * `history.replaceState` so `usePathname` / `useSearchParams` stay in sync;
 * unlike `router.replace()` it does not re-request the RSC payload (which on
 * this page would re-fetch every flight from Supabase on each keystroke) and
 * it never re-triggers `loading.tsx`.
 */
function replaceUrl(f: FlightFilters) {
  const search = serializeFilters(f, new URLSearchParams(window.location.search));
  const next = `${window.location.pathname}${search}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.replaceState(null, "", next);
}

export function useFlightFilters() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FlightFilters>(() => parseFilters(searchParams));
  const syncedRef = useRef(filters);

  // URL sync: text search is debounced, everything else is written immediately.
  useEffect(() => {
    const prev = syncedRef.current;
    if (prev === filters) return;
    const onlyQChanged =
      prev.q !== filters.q &&
      prev.year === filters.year && prev.cat === filters.cat && prev.role === filters.role &&
      prev.sortKey === filters.sortKey && prev.sortDir === filters.sortDir;
    const write = () => { syncedRef.current = filters; replaceUrl(filters); };
    if (!onlyQChanged) { write(); return; }
    const id = window.setTimeout(write, Q_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [filters]);

  const setQ = useCallback((q: string) => setFilters((f) => (f.q === q ? f : { ...f, q })), []);
  const setYear = useCallback((year: string) => setFilters((f) => (f.year === year ? f : { ...f, year })), []);
  const setCat = useCallback((cat: string) => setFilters((f) => (f.cat === cat ? f : { ...f, cat })), []);
  const setRole = useCallback((role: string) => setFilters((f) => (f.role === role ? f : { ...f, role })), []);
  const toggleSort = useCallback((key: SortKey) => setFilters((f) =>
    f.sortKey === key
      ? { ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc" }
      : { ...f, sortKey: key, sortDir: defaultDirFor(key) },
  ), []);
  const clear = useCallback(() => setFilters((f) =>
    f.q || f.year || f.cat || f.role ? { ...f, q: "", year: "", cat: "", role: "" } : f,
  ), []);

  const active = Boolean(filters.q || filters.year || filters.cat || filters.role);
  return { filters, setQ, setYear, setCat, setRole, toggleSort, clear, active };
}

/* -------------------------------------------------------------------------- */
/* ?saved=<id> — one-shot highlight after create/update                        */
/* -------------------------------------------------------------------------- */

/** How long the saved row keeps its highlight class (matches `.row-saved` in globals.css). */
export const SAVED_HIGHLIGHT_MS = 1700;

export function useSavedFlightId(): number | null {
  const searchParams = useSearchParams();
  const [id, setId] = useState<number | null>(() => {
    const n = Number(searchParams.get(PARAM.saved));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  useEffect(() => {
    if (id == null) return;
    // Drop the one-shot param so a reload / back-navigation doesn't pulse again.
    const p = new URLSearchParams(window.location.search);
    if (p.has(PARAM.saved)) {
      p.delete(PARAM.saved);
      const s = p.toString().replace(/%3A/g, ":");
      window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`);
    }
    const t = window.setTimeout(() => setId(null), SAVED_HIGHLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [id]);
  return id;
}

/* -------------------------------------------------------------------------- */
/* Client-side filtering / sorting / totals                                    */
/* -------------------------------------------------------------------------- */

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Lower-cased haystack for the free-text search; compute once per flight. */
export function searchText(f: FlightDerived): string {
  return [f.make_model, f.registration, f.route, f.pic, f.copilot, f.third_pilot, f.check_pilot, f.remarks]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** All search terms must match (any field), plus exact category / role / year. */
export function applyFilters(
  flights: readonly FlightDerived[],
  haystack: readonly string[],
  f: Pick<FlightFilters, "q" | "year" | "cat" | "role">,
): FlightDerived[] {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out: FlightDerived[] = [];
  for (let i = 0; i < flights.length; i++) {
    const x = flights[i];
    if (f.cat && x.category !== f.cat) continue;
    if (f.role && x.role !== f.role) continue;
    if (f.year && !x.date.startsWith(f.year)) continue;
    if (terms.length) {
      const h = haystack[i];
      let ok = true;
      for (const t of terms) if (!h.includes(t)) { ok = false; break; }
      if (!ok) continue;
    }
    out.push(x);
  }
  return out;
}

export function sortValue(f: FlightDerived, k: SortKey): number | string | null {
  switch (k) {
    case "takeoffs": return num(f.takeoffs_day) + num(f.takeoffs_night);
    case "landings": return num(f.landings_day) + num(f.landings_night);
    case "is_xcountry": return f.is_xcountry ? 1 : 0;
    default: {
      const v = f[k];
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (v == null) return null;
      const s = String(v);
      return s.trim() ? s : null;
    }
  }
}

/**
 * One collator per UI locale, built lazily. The locale is passed explicitly
 * (never `undefined`) so the server and the browser sort text identically —
 * their default locales differ, and a different order would be a hydration
 * mismatch.
 */
const collators = new Map<Locale, Intl.Collator>();
function collatorFor(locale: Locale): Intl.Collator {
  let c = collators.get(locale);
  if (!c) {
    c = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    collators.set(locale, c);
  }
  return c;
}
/** Newest first, then highest id — keeps equal keys in a stable, predictable order. */
const tieBreak = (a: FlightDerived, b: FlightDerived) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);

export function sortFlights(rows: readonly FlightDerived[], key: SortKey, dir: SortDir, locale: Locale): FlightDerived[] {
  const sign = dir === "asc" ? 1 : -1;
  const isoDate = key === "date";
  const collator = collatorFor(locale);
  const decorated = rows.map((f) => ({ f, v: sortValue(f, key) }));
  decorated.sort((a, b) => {
    const av = a.v, bv = b.v;
    if (av == null || bv == null) {
      if (av == null && bv == null) return tieBreak(a.f, b.f);
      return av == null ? 1 : -1; // empties last in either direction
    }
    let c: number;
    if (typeof av === "number" && typeof bv === "number") c = av - bv;
    else if (isoDate) c = av < bv ? -1 : av > bv ? 1 : 0; // ISO dates compare lexically
    else c = collator.compare(String(av), String(bv));
    c *= sign;
    return c !== 0 ? c : tieBreak(a.f, b.f);
  });
  return decorated.map((d) => d.f);
}

/** Footer / subtitle totals for the filtered set. Hours are rounded to 0.1. */
export type Agg = {
  count: number;
  day: number; night: number;
  /** Logged block hours. */
  total: number;
  /** Block hours under the user's convention (SIC at 50 % when augHalfCredit). */
  credited: number;
  /** Number of cross-country flights. */
  xc: number;
  actual: number; hood: number; sim: number;
  ifr: number; prec: number; nonPrec: number; holds: number;
  cfi: number;
  takeoffs: number; landings: number;
};

export function aggregate(rows: readonly FlightDerived[], augHalfCredit: boolean): Agg {
  const a: Agg = {
    count: 0, day: 0, night: 0, total: 0, credited: 0, xc: 0,
    actual: 0, hood: 0, sim: 0, ifr: 0, prec: 0, nonPrec: 0, holds: 0, cfi: 0, takeoffs: 0, landings: 0,
  };
  for (const f of rows) {
    a.count++;
    a.day += num(f.day_time);
    a.night += num(f.night_time);
    a.total += num(f.total_time);
    a.credited += creditedHours(f, augHalfCredit);
    if (f.is_xcountry) a.xc++;
    a.actual += num(f.actual_inst);
    a.hood += num(f.hood_inst);
    a.sim += num(f.sim_inst);
    a.ifr += num(f.ifr_approaches);
    a.prec += num(f.precision_approaches);
    a.nonPrec += num(f.non_precision_approaches);
    a.holds += num(f.holds);
    a.cfi += num(f.cfi_time);
    a.takeoffs += num(f.takeoffs_day) + num(f.takeoffs_night);
    a.landings += num(f.landings_day) + num(f.landings_night);
  }
  a.day = r1(a.day); a.night = r1(a.night); a.total = r1(a.total); a.credited = r1(a.credited);
  a.actual = r1(a.actual); a.hood = r1(a.hood); a.sim = r1(a.sim); a.cfi = r1(a.cfi);
  return a;
}
