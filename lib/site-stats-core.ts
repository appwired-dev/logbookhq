/**
 * Pure core for first-party, cookieless site statistics (admin Traffic tab).
 *
 * Imported by the client beacon (components/SiteStats.tsx), the ingest route
 * (app/api/view/route.ts), the opt-out switch, the admin Traffic tab and the
 * tsx tests — so it must stay free of server-only, next/* and node:* imports.
 * Everything that reaches the database is normalised here first and checked
 * again in SQL (record_page_view in supabase/migrations/0021).
 *
 * What is never produced here: a raw path, a query string (other than the
 * utm_source / utm_campaign tokens), a full referrer URL, a share token, an
 * IP address or a visitor identifier.
 */

export const SITE_HOST = "pilotlogbookhq.com";
export const SITE_ORIGIN = "https://pilotlogbookhq.com";
export const STATS_ENDPOINT = "/api/view";
export const OPT_OUT_KEY = "lhq.stats.optout";
export const MAX_BEACON_BYTES = 1024;
export const SHARE_PAGE = "/share/[token]";
export const NOT_FOUND = "(not found)";
/** Percent changes and the signup rate are hidden below this base (too noisy). */
export const SMALL_BASE = 20;
/** Mirrors the per-UTC-day flood ceiling in record_page_view. */
export const DAILY_VIEW_CEILING = 20000;
/** Separator inside a `flow` value: "<source> → <landing page>" (built in SQL). */
export const FLOW_SEP = " → ";

/** Every public page that is counted. A new public page must be added here (pinned by scripts/site-stats.test.ts). */
export const PUBLIC_PAGES = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/multi-regime-pilot-logbook",
  "/foreflight-logbook-alternative",
  "/logten-pro-alternative",
  "/transport-canada-pilot-logbook",
  "/myflightbook-alternative",
  "/easa-pilot-logbook",
  "/faa-easa-logbook",
  "/uk-caa-pilot-logbook",
  "/icao-pilot-logbook",
] as const;

/** Never counted: the signed-in app, auth and recovery flows, APIs. */
export const EXCLUDED_PREFIXES = ["/app", "/auth", "/forgot-password", "/reset-password", "/api", "/monitoring"] as const;

/** Fixed retention periods — stated in the privacy policy and enforced by run_housekeeping (0021). */
export const RETENTION = {
  rateLimitDays: 1,
  trafficDays: 395,
  stripeDays: 90,
  supportResolvedDays: 365,
  auditDays: 395,
  cronLogDays: 14,
} as const;

/** Manual purge choices offered in Maintenance; admin_purge enforces the floors again in SQL. 0 = all. */
export const PURGE_OPTIONS = {
  support_resolved: [30, 90, 180, 365],
  traffic: [30, 90, 180, 0],
} as const;
export const PURGE_DEFAULT = { support_resolved: 90, traffic: 90 } as const;
export type PurgeKind = keyof typeof PURGE_OPTIONS;

export function isPurgeKind(v: unknown): v is PurgeKind {
  return v === "support_resolved" || v === "traffic";
}
export function isPurgeOption(kind: PurgeKind, days: unknown): days is number {
  return typeof days === "number" && (PURGE_OPTIONS[kind] as readonly number[]).includes(days);
}

const PUBLIC_SET: ReadonlySet<string> = new Set(PUBLIC_PAGES);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * The page a pathname is counted as, or null when it is never counted.
 * Share links lose their token; anything unknown collapses to "(not found)",
 * so arbitrary paths (or a scanner's /wp-login.php) can never mint new values.
 */
export function statPath(pathname: string): string | null {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  let p = pathname;
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  if (EXCLUDED_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))) return null;
  if (/^\/share\/[^/]+$/.test(p)) return SHARE_PAGE;
  if (PUBLIC_SET.has(p)) return p;
  return NOT_FOUND;
}

/** A value parseViewBeacon accepts as a page. */
export function isCountedPage(p: unknown): p is string {
  return typeof p === "string" && (p === SHARE_PAGE || p === NOT_FOUND || PUBLIC_SET.has(p));
}

// ---------------------------------------------------------------------------
// Referrers and sources
// ---------------------------------------------------------------------------

export type RefClass = { kind: "none" } | { kind: "internal" } | { kind: "external"; host: string };

const HOST_RE = /^[a-z0-9.-]{1,100}$/;
/** A dotted IPv4 literal passes HOST_RE but is an IP address — never stored as a source. */
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const normHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

function isOwnHost(host: string, ownHost: string): boolean {
  const own = normHost(ownHost);
  return host === own || host.endsWith(`.${own}`);
}

/** http(s) referrer → its host only. The own host (or a subdomain) is internal. */
export function classifyReferrer(ref: string | null | undefined, ownHost: string): RefClass {
  if (!ref || typeof ref !== "string") return { kind: "none" };
  let u: URL;
  try { u = new URL(ref); } catch { return { kind: "none" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { kind: "none" };
  const host = normHost(u.hostname);
  if (isOwnHost(host, ownHost) || isOwnHost(host, SITE_HOST)) return { kind: "internal" };
  if (!HOST_RE.test(host) || !host.includes(".") || IPV4_RE.test(host)) return { kind: "none" };
  return { kind: "external", host };
}

/** A utm/ref token, lower-cased and slugged. Anything that looks like an email or a long number is dropped. */
export function sanitizeToken(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (!t || t.includes("@") || /\d{6,}/.test(t)) return null;
  const s = t.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return s || null;
}

/** Only utm_source (or ref) and utm_campaign are ever read from the query string. */
export function campaignParams(search: string): { source: string | null; campaign: string | null } {
  let q: URLSearchParams;
  try { q = new URLSearchParams(search); } catch { return { source: null, campaign: null }; }
  return { source: sanitizeToken(q.get("utm_source") ?? q.get("ref")), campaign: sanitizeToken(q.get("utm_campaign")) };
}

const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", ddg: "DuckDuckGo", yahoo: "Yahoo", ecosia: "Ecosia",
  brave: "Brave Search", yandex: "Yandex", baidu: "Baidu", naver: "Naver", reddit: "Reddit",
  fb: "Facebook", facebook: "Facebook", ig: "Instagram", instagram: "Instagram", x: "X", twitter: "X",
  linkedin: "LinkedIn", youtube: "YouTube", yt: "YouTube", hn: "Hacker News", hackernews: "Hacker News",
  producthunt: "Product Hunt", "product-hunt": "Product Hunt", github: "GitHub", chatgpt: "ChatGPT",
  "chatgpt.com": "ChatGPT", openai: "ChatGPT", perplexity: "Perplexity", claude: "Claude", gemini: "Gemini", gmail: "Gmail",
};

/** Host → source group. Specific hosts come before the broad ones they would also match. */
const SOURCE_GROUPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^gemini\.google\.com$/, "Gemini"],
  [/^mail\.google\.com$/, "Gmail"],
  [/(^|\.)google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/^search\.brave\.com$/, "Brave Search"],
  [/(^|\.)yandex\.(com|ru|[a-z]{2})$/, "Yandex"],
  [/(^|\.)baidu\.com$/, "Baidu"],
  [/(^|\.)naver\.com$/, "Naver"],
  [/(^|\.)reddit\.com$|^redd\.it$/, "Reddit"],
  [/(^|\.)facebook\.com$|^fb\.me$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "X"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/^news\.ycombinator\.com$/, "Hacker News"],
  [/(^|\.)producthunt\.com$/, "Product Hunt"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)claude\.ai$/, "Claude"],
];

/** The source shown in Traffic: a campaign/ref token wins, then the referrer's group, then the bare host. */
export function sourceLabel(refHost: string | null | undefined, utmSource: string | null | undefined): string {
  const tok = utmSource ? sanitizeToken(utmSource) : null;
  if (tok) return TOKEN_ALIASES[tok] ?? tok;
  if (refHost) {
    for (const [re, label] of SOURCE_GROUPS) if (re.test(refHost)) return label;
    return refHost;
  }
  return "(direct)";
}

// ---------------------------------------------------------------------------
// Request classifiers (used in memory by the route, then dropped)
// ---------------------------------------------------------------------------

export type DeviceClass = "mobile" | "tablet" | "desktop";

/** Same rules as lib/device-hint.ts (which cannot be imported here: it pulls in next/headers), plus tablets. */
export function deviceClass(ua: string | null | undefined, secChUaMobile?: string | null): DeviceClass {
  const s = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobi)/i.test(s)) return "tablet";
  if (secChUaMobile === "?1" || /Mobi|iPhone|iPod|Android/i.test(s)) return "mobile";
  return "desktop";
}

const BOT_RE = /bot|crawl|spider|slurp|scrape|preview|fetch|monitor|uptime|pingdom|gtmetrix|lighthouse|pagespeed|headless|phantomjs|puppeteer|playwright|selenium|curl|wget|python-requests|aiohttp|axios|node-fetch|undici|go-http-client|java\/|okhttp|libwww|httpclient|facebookexternalhit|embedly|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|twitterbot|applebot|googlebot|google-inspectiontool|bingbot|duckduckbot|yandex|baiduspider|petalbot|ahrefs|semrush|mj12bot|dotbot|bytespider|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|ccbot|perplexitybot|amazonbot|vercel/i;

export function isBotUA(ua: string | null | undefined): boolean {
  return !ua || BOT_RE.test(ua);
}

/** Global Privacy Control or Do Not Track. */
export function privacySignal(get: (name: string) => string | null | undefined): boolean {
  return get("sec-gpc") === "1" || get("dnt") === "1";
}

export function countryCode(h: string | null | undefined): string {
  return typeof h === "string" && /^[A-Z]{2}$/.test(h) ? h : "XX";
}

// ---------------------------------------------------------------------------
// Beacon
// ---------------------------------------------------------------------------

export type ViewBeacon = { page: string; landing: boolean; ref: string | null; utmSource: string | null; campaign: string | null };

/**
 * The beacon body `{p, l?, r?, s?, c?}` (sent by SiteStats), re-validated on the
 * server: page must be a counted page, landing only for l === 1, and the
 * referrer/source/campaign are kept only on a landing. Unknown keys are ignored.
 */
export function parseViewBeacon(raw: string): ViewBeacon | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_BEACON_BYTES) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const b = o as Record<string, unknown>;
  if (!isCountedPage(b.p)) return null;
  const landing = b.l === 1;
  let ref: string | null = null;
  if (landing && typeof b.r === "string") {
    const h = normHost(b.r);
    if (HOST_RE.test(h) && h.includes(".") && !IPV4_RE.test(h) && !isOwnHost(h, SITE_HOST)) ref = h;
  }
  return {
    page: b.p,
    landing,
    ref,
    utmSource: landing ? sanitizeToken(b.s) : null,
    campaign: landing ? sanitizeToken(b.c) : null,
  };
}

/** Vercel Analytics beforeSend: no share token, no hash, no query keys other than utm_*. */
export function redactAnalyticsUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.pathname = u.pathname.replace(/^\/share\/[^/]+/, SHARE_PAGE);
    const keep = new URLSearchParams();
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = u.searchParams.get(k);
      if (v != null) keep.set(k, v);
    }
    const qs = keep.toString();
    u.search = qs ? `?${qs}` : "";
    return u.toString();
  } catch {
    return `${SITE_ORIGIN}/`;
  }
}

// ---------------------------------------------------------------------------
// Report (admin Traffic tab)
// ---------------------------------------------------------------------------

export type TrafficDim = "page" | "source" | "campaign" | "country" | "device" | "flow";
export type TrafficPoint = { day: string; views: number; landings: number };
export type TrafficRow = { dim: TrafficDim; value: string; views: number; landings: number };
export type TrafficTotals = { views: number; landings: number };
export type TrafficReport = {
  days: number;
  today: string;
  series: TrafficPoint[];
  prev_series: TrafficPoint[];
  totals: TrafficTotals;
  previous: TrafficTotals;
  top: TrafficRow[];
  capped_days: string[];
};

const DIMS: ReadonlySet<string> = new Set(["page", "source", "campaign", "country", "device", "flow"]);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isoDay = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

function points(v: unknown): TrafficPoint[] {
  if (!Array.isArray(v)) return [];
  const out: TrafficPoint[] = [];
  for (const p of v) {
    const day = isoDay((p as { day?: unknown })?.day);
    if (day) out.push({ day, views: int((p as { views?: unknown }).views), landings: int((p as { landings?: unknown }).landings) });
  }
  return out;
}
function totals(v: unknown): TrafficTotals {
  const o = (v ?? {}) as { views?: unknown; landings?: unknown };
  return { views: int(o.views), landings: int(o.landings) };
}

/** traffic_report() jsonb → a fully-typed report. Defensive: a malformed payload becomes an empty report. */
export function parseTrafficReport(v: unknown, fallbackDays = 30): TrafficReport {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const today = isoDay(o.today) ?? new Date().toISOString().slice(0, 10);
  const top: TrafficRow[] = [];
  if (Array.isArray(o.top)) {
    for (const r of o.top) {
      const row = r as { dim?: unknown; value?: unknown; views?: unknown; landings?: unknown };
      if (typeof row?.dim === "string" && DIMS.has(row.dim) && typeof row.value === "string" && row.value) {
        top.push({ dim: row.dim as TrafficDim, value: row.value, views: int(row.views), landings: int(row.landings) });
      }
    }
  }
  return {
    days: int(o.days) || fallbackDays,
    today,
    series: points(o.series),
    prev_series: points(o.prev_series),
    totals: totals(o.totals),
    previous: totals(o.previous),
    top,
    capped_days: Array.isArray(o.capped_days) ? o.capped_days.map(isoDay).filter((d): d is string => !!d) : [],
  };
}

/** "<source> → <page>" → its parts (neither side can contain the separator). */
export function splitFlow(value: string): { source: string; page: string } | null {
  const i = value.lastIndexOf(FLOW_SEP);
  if (i <= 0) return null;
  const page = value.slice(i + FLOW_SEP.length);
  return page ? { source: value.slice(0, i), page } : null;
}

/** The n UTC days ending at `todayISO`, oldest first ("YYYY-MM-DD"). */
export function utcDays(todayISO: string, n: number): string[] {
  const [y, m, d] = todayISO.slice(0, 10).split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  return out;
}

/** Start of the window that traffic_report counts: today − (n − 1) days, 00:00Z (matches SQL `day > today − n`). */
export function windowStartUTC(todayISO: string, n: number): string {
  const [y, m, d] = todayISO.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - (n - 1))).toISOString();
}

/** Percent change, or null when the previous base is too small to mean anything. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev < SMALL_BASE) return null;
  return ((cur - prev) / prev) * 100;
}

/** Fraction of the current UTC day that has elapsed (0..1) — `todayISO` is the database's today. */
export function todayElapsedFraction(todayISO: string, nowMs: number): number {
  const [y, m, d] = todayISO.slice(0, 10).split("-").map(Number);
  const f = (nowMs - Date.UTC(y, m - 1, d)) / 86_400_000;
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 1;
}

/**
 * Period-over-period change of a daily RATE. The current window is n − 1 full UTC days plus
 * today so far; the previous window is n full days. Comparing raw totals would read low every
 * morning, so compare per-elapsed-day rates. Null when the previous base is too small.
 */
export function ratePctChange(cur: number, prev: number, n: number, elapsed: number): number | null {
  if (prev < SMALL_BASE || n < 1) return null;
  const curDays = n - 1 + Math.min(1, Math.max(0, elapsed));
  if (curDays <= 0) return null;
  return ((cur / curDays) / (prev / n) - 1) * 100;
}
