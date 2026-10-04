/**
 * Source pins for the admin Traffic / Maintenance feature: the privacy and
 * security guarantees that must survive future edits, checked by reading the
 * files (no Next.js, no network).
 *
 *   npm run test:pins
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function files(dir: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...files(rel, re));
    else if (re.test(name)) out.push(rel);
  }
  return out;
}

test("root layout: SiteStats mounted, no direct @vercel/analytics, no dynamic APIs", () => {
  const s = noComments(read("app/layout.tsx"));
  assert.match(s, /<SiteStats/);
  assert.doesNotMatch(s, /@vercel\/analytics/);
  for (const bad of ["headers(", "cookies(", "useSearchParams"]) assert.ok(!s.includes(bad), `app/layout.tsx uses ${bad}`);
});

test("SiteStats: honours GPC/DNT/webdriver/prerender, ships dark, redacts Vercel, never writes storage", () => {
  const s = read("components/SiteStats.tsx");
  for (const must of ["globalPrivacyControl", "doNotTrack", "webdriver", "prerendering", "beforeSend", "NEXT_PUBLIC_STATS_ENABLED", "redactAnalyticsUrl"]) {
    assert.ok(s.includes(must), `missing ${must}`);
  }
  const c = noComments(s);
  for (const bad of ["useSearchParams", "useParams", "document.cookie", "localStorage.setItem", "sessionStorage"]) {
    assert.ok(!c.includes(bad), `SiteStats uses ${bad}`);
  }
});

test("StatsOptOut: never claims 'counted' for a browser that sends GPC or DNT", () => {
  const s = read("components/StatsOptOut.tsx");
  for (const must of ["globalPrivacyControl", "doNotTrack", "signalText"]) assert.ok(s.includes(must), `missing ${must}`);
});

test("/api/view: gated, origin-checked, GPC-aware, size-capped; never reads IPs or logs", () => {
  const s = read("app/api/view/route.ts");
  for (const must of ["VERCEL_ENV", "NEXT_PUBLIC_STATS_ENABLED", "privacySignal", "origin", "content-length", "x-vercel-ip-country", "parseViewBeacon"]) {
    assert.ok(s.includes(must), `missing ${must}`);
  }
  const c = noComments(s);
  for (const bad of ["x-forwarded-for", "x-real-ip", "clientIp", "console.", "export async function GET", "x-vercel-ip-city", "x-vercel-ip-latitude"]) {
    assert.ok(!c.includes(bad), `route uses ${bad}`);
  }
});

test("middleware matcher still excludes /api and marketing pages", () => {
  const s = read("middleware.ts");
  const matcher = s.slice(s.indexOf("matcher"));
  assert.ok(!matcher.includes('"/api'), "middleware now runs on /api");
  assert.ok(!matcher.includes('"/"'), "middleware now runs on /");
});

test("privacy policy discloses the first-party statistics and the opt-out", () => {
  const s = read("app/privacy/page.tsx");
  for (const must of ["Global Privacy Control", "daily totals", "13 months", "within 2 days", "lhq.stats.optout", "<StatsOptOut"]) {
    assert.ok(s.includes(must), `privacy page missing "${must}"`);
  }
  assert.ok(!s.includes("Last updated: May 18, 2026"), "privacy date not updated");
});

test("admin: the users page moved into (users); no duplicate /app/admin route", () => {
  assert.ok(!existsSync(join(ROOT, "app/app/admin/page.tsx")), "app/app/admin/page.tsx still exists (duplicate route)");
  assert.ok(existsSync(join(ROOT, "app/app/admin/(users)/page.tsx")));
  assert.ok(!existsSync(join(ROOT, "app/app/admin/loading.tsx")), "users skeleton would wrap every admin tab");
});

test("admin: every page gates itself; every exported server action gates itself", () => {
  const pages = files("app/app/admin", /^page\.tsx$/);
  assert.ok(pages.length >= 4, `expected ≥4 admin pages, found ${pages.length}`);
  for (const p of pages) assert.match(read(p), /await requireAdminPage\(\)/, `${p} does not call requireAdminPage()`);
  assert.match(read("app/app/admin/layout.tsx"), /requireAdminPage\(\)/);
  for (const f of ["app/app/admin/actions.ts", "app/app/admin/ops-actions.ts"]) {
    const src = read(f);
    const fns = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
    assert.ok(fns.length > 0, `no exported actions found in ${f}`);
    for (const [, name, body] of fns) assert.match(body, /requireAdmin\(\)/, `${f}:${name} does not call requireAdmin()`);
  }
});

test("admin: audit rows never carry emails, names, message text or passwords", () => {
  const src = read("app/app/admin/actions.ts");
  for (const m of src.matchAll(/logAdminAction\(([\s\S]*?)\);/g)) {
    assert.doesNotMatch(m[1], /tempPassword|email|fullName|full_name|message|subject/i, `audit call leaks: ${m[1].slice(0, 80)}`);
  }
});

test("traffic: no client-side traffic fetches (only the world outline for the globe)", () => {
  for (const f of files("app/app/admin/traffic", /\.tsx?$/)) {
    for (const m of noComments(read(f)).matchAll(/fetch\(([^)]*)\)/g)) {
      assert.match(m[1], /world-countries\.json/, `${f} fetches ${m[1]}`);
    }
  }
});

test("traffic: referrer hosts are never rendered as links", () => {
  for (const f of files("app/app/admin/traffic", /\.tsx$/)) {
    const s = noComments(read(f));
    assert.ok(!/href=\{[^}]*(source|host|ref)/i.test(s), `${f} links a source/host`);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
