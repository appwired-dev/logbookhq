/**
 * Unit tests for the first-party site-statistics core (lib/site-stats-core.ts)
 * plus pins on the 0021 migration.
 *
 *   npm run test:stats
 *
 * Pure and offline: no database, no network, no Next.js. Every case prints
 * PASS/FAIL; process.exitCode is set to 1 on any failure.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  EXCLUDED_PREFIXES, NOT_FOUND, PUBLIC_PAGES, PURGE_OPTIONS, RETENTION, SHARE_PAGE, SITE_HOST,
  campaignParams, classifyReferrer, countryCode, deviceClass, isBotUA, isPurgeOption, parseTrafficReport,
  parseViewBeacon, pctChange, privacySignal, ratePctChange, todayElapsedFraction, redactAnalyticsUrl, sanitizeToken, sourceLabel, splitFlow,
  statPath, utcDays, windowStartUTC,
} from "../lib/site-stats-core";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
  }
}

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ---------------------------------------------------------------------------
// statPath
// ---------------------------------------------------------------------------

test("statPath: every public page maps to itself; a trailing slash is dropped", () => {
  for (const p of PUBLIC_PAGES) assert.equal(statPath(p), p);
  assert.equal(statPath("/pricing/"), "/pricing");
});

test("statPath: share links lose their token; nested share paths are not found", () => {
  assert.equal(statPath("/share/AbC_123-xyz"), SHARE_PAGE);
  assert.equal(statPath("/share/a/b"), NOT_FOUND);
});

test("statPath: the app, auth, recovery, API and monitoring are never counted", () => {
  for (const p of ["/app", "/app/flights/42", "/app/admin", "/auth/callback", "/auth/auth-code-error", "/reset-password", "/forgot-password", "/api/view", "/monitoring"]) {
    assert.equal(statPath(p), null, p);
  }
});

test("statPath: unknown paths collapse to (not found); no output carries ?, # or a token", () => {
  assert.equal(statPath("/wp-login.php"), NOT_FOUND);
  assert.equal(statPath("/Pricing"), NOT_FOUND);
  assert.equal(statPath("/apple"), NOT_FOUND, "/apple is not under /app");
  assert.equal(statPath("/pricing?q=Smith#x"), "/pricing");
  for (const p of ["/share/SECRET", "/pricing?x=1", "/x#y"]) {
    const out = statPath(p) ?? "";
    assert.ok(!/[?#]/.test(out) && !out.includes("SECRET"), `${p} → ${out}`);
  }
});

// ---------------------------------------------------------------------------
// Route inventory — every page is classified
// ---------------------------------------------------------------------------

function pageRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pageRoutes(full));
    else if (name === "page.tsx") {
      const rel = relative(join(ROOT, "app"), dir).split("/").filter((s) => s && !/^\(.*\)$/.test(s));
      out.push(`/${rel.join("/")}`);
    }
  }
  return out;
}

test("route inventory: every page outside /app is public, excluded or the share page", () => {
  const routes = pageRoutes(join(ROOT, "app")).filter((r) => r !== "/app" && !r.startsWith("/app/"));
  assert.ok(routes.length >= 15, `found only ${routes.length} routes`);
  for (const r of routes) {
    const ok = (PUBLIC_PAGES as readonly string[]).includes(r)
      || EXCLUDED_PREFIXES.some((x) => r === x || r.startsWith(`${x}/`))
      || r === "/share/[token]";
    assert.ok(ok, `unclassified page route ${r} — add it to PUBLIC_PAGES or EXCLUDED_PREFIXES in lib/site-stats-core.ts`);
  }
});

test("route inventory: every sitemap URL is a counted public page", () => {
  const src = read("app/sitemap.ts");
  const paths = [...src.matchAll(/\$\{base\}(\/[a-z0-9-]*)/g)].map((m) => m[1]);
  assert.ok(paths.length >= 10, "sitemap parse found too few URLs");
  for (const p of ["/", ...paths]) assert.ok((PUBLIC_PAGES as readonly string[]).includes(p), `sitemap ${p} not in PUBLIC_PAGES`);
});

// ---------------------------------------------------------------------------
// Referrers, tokens, sources
// ---------------------------------------------------------------------------

test("classifyReferrer: none / internal / external host only", () => {
  assert.deepEqual(classifyReferrer("", SITE_HOST), { kind: "none" });
  assert.deepEqual(classifyReferrer("https://pilotlogbookhq.com/pricing", SITE_HOST), { kind: "internal" });
  assert.deepEqual(classifyReferrer("https://www.pilotlogbookhq.com/", SITE_HOST), { kind: "internal" });
  assert.deepEqual(classifyReferrer("http://localhost:3030/x", "localhost"), { kind: "internal" });
  assert.deepEqual(classifyReferrer("https://www.google.co.uk/search?q=x", SITE_HOST), { kind: "external", host: "google.co.uk" });
});

test("classifyReferrer: junk is none", () => {
  for (const r of ["javascript:alert(1)", "not a url", `https://${"a".repeat(300)}.com/`, "http://localhost", "http://192.168.1.10/admin", "https://203.0.113.7:8443/x", "http://[2001:db8::1]/"]) {
    assert.deepEqual(classifyReferrer(r, SITE_HOST), { kind: "none" }, r);
  }
});

test("sanitizeToken: slugs; drops emails, long numbers, non-strings; caps at 60", () => {
  assert.equal(sanitizeToken("Spring Sale!"), "spring-sale");
  assert.equal(sanitizeToken("a@b.com"), null);
  assert.equal(sanitizeToken("1234567"), null);
  assert.equal(sanitizeToken("x".repeat(80))?.length, 60);
  assert.equal(sanitizeToken(42), null);
  assert.equal(sanitizeToken("   "), null);
});

test("campaignParams: reads only utm_source/ref and utm_campaign", () => {
  assert.deepEqual(campaignParams("?utm_source=Reddit&utm_campaign=Launch_1&q=Smith&gclid=x"), { source: "reddit", campaign: "launch_1" });
  assert.deepEqual(campaignParams("?ref=producthunt"), { source: "producthunt", campaign: null });
  assert.deepEqual(campaignParams("?code=9b2e6f2a-uuid&next=/app"), { source: null, campaign: null });
});

test("sourceLabel: groups, specific hosts first, tokens win", () => {
  assert.equal(sourceLabel(null, null), "(direct)");
  assert.equal(sourceLabel("google.de", null), "Google");
  assert.equal(sourceLabel("google.co.uk", null), "Google");
  assert.equal(sourceLabel("gemini.google.com", null), "Gemini");
  assert.equal(sourceLabel("mail.google.com", null), "Gmail");
  assert.equal(sourceLabel("l.facebook.com", null), "Facebook");
  assert.equal(sourceLabel("t.co", null), "X");
  assert.equal(sourceLabel("google.evil.com", null), "google.evil.com", "lookalike host is not Google");
  assert.equal(sourceLabel("pilotforum.example", null), "pilotforum.example");
  assert.equal(sourceLabel("google.com", "newsletter"), "newsletter");
  assert.equal(sourceLabel(null, "fb"), "Facebook");
});

// ---------------------------------------------------------------------------
// Classifiers
// ---------------------------------------------------------------------------

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidTab: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
};

test("deviceClass: phone / tablet / desktop", () => {
  assert.equal(deviceClass(UA.iphone), "mobile");
  assert.equal(deviceClass(UA.androidPhone), "mobile");
  assert.equal(deviceClass(UA.ipad), "tablet");
  assert.equal(deviceClass(UA.androidTab), "tablet");
  assert.equal(deviceClass(UA.winChrome, "?1"), "mobile");
  assert.equal(deviceClass(UA.winChrome), "desktop");
  assert.equal(deviceClass(null), "desktop");
});

test("isBotUA: crawlers, scripts and empty agents are bots; browsers are not", () => {
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1)", "curl/8.4.0", "Mozilla/5.0 HeadlessChrome/126.0", "GPTBot/1.0", "ClaudeBot/1.0", ""]) {
    assert.equal(isBotUA(ua), true, ua);
  }
  for (const ua of [UA.iphone, UA.winChrome, UA.macFirefox]) assert.equal(isBotUA(ua), false, ua);
});

test("privacySignal and countryCode", () => {
  assert.equal(privacySignal((n) => (n === "sec-gpc" ? "1" : null)), true);
  assert.equal(privacySignal((n) => (n === "dnt" ? "1" : null)), true);
  assert.equal(privacySignal(() => null), false);
  assert.equal(countryCode("CA"), "CA");
  for (const c of ["ca", "CAN", null, undefined, ""]) assert.equal(countryCode(c), "XX");
});

// ---------------------------------------------------------------------------
// Beacon + Vercel redaction
// ---------------------------------------------------------------------------

test("parseViewBeacon: valid landing body", () => {
  assert.deepEqual(parseViewBeacon(JSON.stringify({ p: "/pricing", l: 1, r: "www.google.com", s: "Reddit", c: "Launch" })),
    { page: "/pricing", landing: true, ref: "google.com", utmSource: "reddit", campaign: "launch" });
});

test("parseViewBeacon: rejects uncounted pages, raw tokens, junk and oversize bodies", () => {
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/app/flights" })), null);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/share/realtoken" })), null);
  assert.equal(parseViewBeacon("not json"), null);
  assert.equal(parseViewBeacon("[1,2]"), null);
  assert.equal(parseViewBeacon(""), null);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", pad: "x".repeat(1100) })), null);
});

test("parseViewBeacon: string l is not a landing; self/no-dot referrers dropped; non-landings carry no source", () => {
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", l: "1" }))?.landing, false);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", l: 1, r: "pilotlogbookhq.com" }))?.ref, null);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", l: 1, r: "app.pilotlogbookhq.com" }))?.ref, null);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", l: 1, r: "evil" }))?.ref, null);
  assert.equal(parseViewBeacon(JSON.stringify({ p: "/", l: 1, r: "10.0.0.1" }))?.ref, null, "IP literal never stored");
  assert.deepEqual(parseViewBeacon(JSON.stringify({ p: "/", r: "google.com", s: "x", c: "y", extra: true })),
    { page: "/", landing: false, ref: null, utmSource: null, campaign: null });
});

test("redactAnalyticsUrl: share token, hash and non-utm query keys removed", () => {
  assert.equal(redactAnalyticsUrl("https://pilotlogbookhq.com/share/TOKEN123?x=1#y"), "https://pilotlogbookhq.com/share/[token]");
  assert.equal(redactAnalyticsUrl("https://pilotlogbookhq.com/app/flights?q=Smith&utm_source=a"), "https://pilotlogbookhq.com/app/flights?utm_source=a");
  assert.equal(redactAnalyticsUrl("not a url"), "https://pilotlogbookhq.com/");
});

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

test("windowStartUTC / utcDays / pctChange / splitFlow", () => {
  assert.equal(windowStartUTC("2026-10-04", 7), "2026-09-28T00:00:00.000Z");
  assert.deepEqual(utcDays("2026-03-01", 3), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.equal(pctChange(30, 19), null);
  assert.equal(pctChange(30, 20), 50);
  assert.deepEqual(splitFlow("Google → /pricing"), { source: "Google", page: "/pricing" });
  assert.deepEqual(splitFlow("(other) → (not found)"), { source: "(other)", page: "(not found)" });
  assert.equal(splitFlow("no separator"), null);
});

test("ratePctChange: a flat traffic rate reads 0 % at any time of day; small bases stay hidden", () => {
  // 30-day windows, 10 visits/day: at 06:00 UTC the current window holds 29 full days + 0.25 of today.
  assert.equal(Math.round(ratePctChange(29 * 10 + 2.5, 300, 30, 0.25)! * 1000) / 1000, 0);
  assert.equal(Math.round(ratePctChange(30 * 10, 300, 30, 1)! * 1000) / 1000, 0);
  assert.ok(Math.abs(ratePctChange(29 * 20 + 5, 300, 30, 0.25)! - 100) < 1e-9, "double the rate = +100 %");
  assert.equal(ratePctChange(50, 19, 30, 0.5), null);
  assert.equal(todayElapsedFraction("2026-10-04", Date.UTC(2026, 9, 4, 6)), 0.25);
  assert.equal(todayElapsedFraction("2026-10-04", Date.UTC(2026, 9, 5, 1)), 1, "clamped");
  assert.equal(todayElapsedFraction("2026-10-04", Date.UTC(2026, 9, 3, 23)), 0, "clamped");
});

test("parseTrafficReport: normalises the jsonb and survives junk", () => {
  const r = parseTrafficReport({
    days: 30, today: "2026-10-04",
    series: [{ day: "2026-10-03", views: 5, landings: 2 }, { day: "bad" }],
    prev_series: [], totals: { views: 5, landings: 2 }, previous: { views: -3 },
    top: [{ dim: "page", value: "/", views: 5, landings: 2 }, { dim: "evil", value: "x" }, { dim: "flow", value: "" }],
    capped_days: ["2026-10-01", 7],
  });
  assert.equal(r.series.length, 1);
  assert.deepEqual(r.previous, { views: 0, landings: 0 });
  assert.equal(r.top.length, 1);
  assert.deepEqual(r.capped_days, ["2026-10-01"]);
  const empty = parseTrafficReport(null, 7);
  assert.equal(empty.days, 7);
  assert.deepEqual(empty.top, []);
});

test("purge options: floors respected by the allowlist", () => {
  assert.equal(isPurgeOption("support_resolved", 30), true);
  assert.equal(isPurgeOption("support_resolved", 10), false);
  assert.equal(isPurgeOption("support_resolved", 0), false, "support has no 'all'");
  assert.equal(isPurgeOption("traffic", 0), true);
  assert.ok(Math.min(...PURGE_OPTIONS.support_resolved) >= 30);
});

// ---------------------------------------------------------------------------
// Migration pins (0021)
// ---------------------------------------------------------------------------

const sql = read("supabase/migrations/0021_traffic_and_housekeeping.sql");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const FUNCS = [
  "record_page_view(text, boolean, text, text, text, text)",
  "traffic_report(int)",
  "run_housekeeping(uuid, boolean)",
  "admin_purge(text, int, boolean, uuid)",
];

test("0021: both tables have RLS and revoke the default anon/authenticated grants", () => {
  for (const t of ["traffic_daily", "admin_audit_log"]) {
    assert.match(code, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.match(code, new RegExp(`revoke all on table public\\.${t} from anon, authenticated`));
  }
});

test("0021: every function pins search_path, is owned by postgres and is service-role only", () => {
  assert.equal((code.match(/set search_path = public, pg_temp/g) ?? []).length, 4);
  for (const f of FUNCS) {
    const esc = f.replace(/[()]/g, "\\$&");
    assert.match(code, new RegExp(`alter function public\\.${esc} owner to postgres`), f);
    assert.match(code, new RegExp(`revoke all on function public\\.${esc} from public`), f);
    assert.match(code, new RegExp(`revoke all on function public\\.${esc} from anon, authenticated`), f);
    assert.match(code, new RegExp(`grant execute on function public\\.${esc} to service_role`), f);
  }
  assert.doesNotMatch(code, /security definer/i);
});

test("0021: pg_cron enabled idempotently, no unguarded unschedule", () => {
  assert.match(code, /create extension if not exists pg_cron/);
  assert.doesNotMatch(code, /cron\.unschedule\(/);
  assert.match(code, /cron\.schedule\('logbookhq-housekeeping'/);
});

test("0021: support deletes touch resolved rows only; retention intervals match RETENTION", () => {
  for (const m of code.matchAll(/(delete from|count\(\*\) into n from) support_requests[\s\S]*?;/g)) {
    assert.match(m[0], /status = 'resolved'/, m[0].slice(0, 80));
  }
  assert.match(code, new RegExp(`interval '${RETENTION.rateLimitDays} day'`));
  assert.match(code, new RegExp(`v_today - ${RETENTION.trafficDays}`));
  assert.match(code, new RegExp(`interval '${RETENTION.stripeDays} days'`));
  assert.match(code, new RegExp(`interval '${RETENTION.supportResolvedDays} days'`));
  assert.match(code, new RegExp(`interval '${RETENTION.auditDays} days'`));
  assert.match(code, new RegExp(`interval '${RETENTION.cronLogDays} days'`));
  assert.match(code, /p_days < 30/);
});

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
