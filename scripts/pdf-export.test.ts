/**
 * PDF export gate tests — lib/pdf/export-request.ts and POST /api/export/pdf.
 *
 *   npm run test:pdf
 *
 * Covers, in order:
 *   1. The request parser accepts exactly the display options and drops
 *      everything else (a body can't name a user, flights or an avatar URL).
 *   2. The shared date-range filter is inclusive at both ends.
 *   3. The avatar guard only passes our own public `avatars` bucket, so the
 *      server never fetches a URL the pilot typed into profiles.avatar_url.
 *   4. The tier gate fails closed (missing tier / missing profile = free).
 *   5. Source guards: no "use client" module can reach the PDF toolchain
 *      (static or dynamic import), and the route uses the session client
 *      (never the service-role client) and checks the plan before it reads
 *      a single flight.
 *   6. LogbookPDF renders on the server (Node) to a real PDF with the
 *      expected page count.
 *
 * Offline — no network, no database.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { LogbookPDF } from "../lib/pdf/LogbookPDF";
import { inDateRange, parsePdfExportRequest, safeAvatarUrl } from "../lib/pdf/export-request";
import { computeTotals, deriveFlight } from "../lib/derive";
import { isFreeTier } from "../lib/limits";
import type { Flight } from "../lib/types";

// ---------------------------------------------------------------------------
// Tiny runner (async: the render test awaits)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const queue: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => { queue.push([name, fn]); };

// tsconfig has `jsx: preserve` (Next compiles JSX), so tsx falls back to the
// classic runtime for LogbookPDF.tsx, which then expects a global React.
(globalThis as { React?: typeof React }).React = React;

const ROOT = resolve(__dirname, "..");
const VALID = { layout: "faa", from: "2025-01-01", to: "2025-12-31", pilotName: "A. Pilot", licenseNumber: "CA-123", generatedAt: "2026-10-30, 9:00:00 a.m." };

// ---------------------------------------------------------------------------
// 1. Request parser
// ---------------------------------------------------------------------------

test("parser: a valid body round-trips; every layout is accepted", () => {
  const r = parsePdfExportRequest(VALID);
  assert.ok(r.ok);
  assert.deepEqual(r.value, VALID);
  for (const layout of ["comprehensive", "faa", "easa", "cars"]) assert.ok(parsePdfExportRequest({ ...VALID, layout }).ok, layout);
});

test("parser: stray keys (userId, user_id, flights, avatarUrl) are dropped, not forwarded", () => {
  const r = parsePdfExportRequest({ ...VALID, userId: "victim", user_id: "victim", flights: [{ id: 1 }], avatarUrl: "http://169.254.169.254/" });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value).sort(), ["from", "generatedAt", "layout", "licenseNumber", "pilotName", "to"]);
});

test("parser: open-ended range ('' dates) is allowed", () => {
  assert.ok(parsePdfExportRequest({ ...VALID, from: "", to: "" }).ok);
});

test("parser: rejects non-objects, unknown layouts, bad dates and oversize text", () => {
  for (const bad of [null, undefined, "x", 1, [], [VALID]]) assert.equal(parsePdfExportRequest(bad).ok, false, JSON.stringify(bad));
  for (const layout of ["", "FAA", "toString", "__proto__", "constructor", 1]) assert.equal(parsePdfExportRequest({ ...VALID, layout }).ok, false, String(layout));
  for (const from of ["2025-1-1", "01/01/2025", "2025-01-01T00:00", null, 20250101]) assert.equal(parsePdfExportRequest({ ...VALID, from }).ok, false, String(from));
  assert.equal(parsePdfExportRequest({ ...VALID, pilotName: "x".repeat(201) }).ok, false);
  assert.equal(parsePdfExportRequest({ ...VALID, generatedAt: undefined }).ok, false);
  assert.ok(parsePdfExportRequest({ ...VALID, pilotName: "x".repeat(200) }).ok);
});

// ---------------------------------------------------------------------------
// 2. Date range
// ---------------------------------------------------------------------------

test("inDateRange: inclusive at both ends; blank bound = open", () => {
  const d = (date: string) => ({ date });
  assert.ok(inDateRange(d("2025-01-01"), "2025-01-01", "2025-12-31"));
  assert.ok(inDateRange(d("2025-12-31"), "2025-01-01", "2025-12-31"));
  assert.equal(inDateRange(d("2024-12-31"), "2025-01-01", "2025-12-31"), false);
  assert.equal(inDateRange(d("2026-01-01"), "2025-01-01", "2025-12-31"), false);
  assert.ok(inDateRange(d("1990-05-05"), "", ""));
  assert.ok(inDateRange(d("1990-05-05"), "", "2000-01-01"));
});

// ---------------------------------------------------------------------------
// 3. Avatar guard
// ---------------------------------------------------------------------------

test("safeAvatarUrl: only our public avatars bucket passes", () => {
  const sb = "https://abc.supabase.co";
  const ok = `${sb}/storage/v1/object/public/avatars/u1/avatar.png?t=1`;
  assert.equal(safeAvatarUrl(ok, sb), ok);
  for (const bad of [
    "https://evil.example/storage/v1/object/public/avatars/u1/a.png",          // other host
    "http://abc.supabase.co/storage/v1/object/public/avatars/u1/a.png",        // scheme downgrade = other origin
    `${sb}/storage/v1/object/public/documents/u1/a.png`,                       // other bucket
    `${sb}/storage/v1/object/public/avatars/../documents/u1/a.png`,            // traversal normalises out of avatars/
    `https://abc.supabase.co@evil.example/storage/v1/object/public/avatars/a`, // userinfo trick
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "not a url",
    "",
  ]) assert.equal(safeAvatarUrl(bad, sb), undefined, bad);
  assert.equal(safeAvatarUrl(null, sb), undefined);
  assert.equal(safeAvatarUrl(ok, undefined), undefined);
});

// ---------------------------------------------------------------------------
// 4. Tier gate
// ---------------------------------------------------------------------------

test("tier gate fails closed: missing/blank/free tier is refused; paid tiers pass", () => {
  for (const t of [null, undefined, "", "free"]) assert.equal(isFreeTier(t), true, String(t));
  for (const t of ["pro", "lifetime"]) assert.equal(isFreeTier(t), false, t);
});

// ---------------------------------------------------------------------------
// 5. Source guards
// ---------------------------------------------------------------------------

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

test("no client module imports the PDF toolchain (static or dynamic, non-type)", () => {
  const FORBIDDEN = /^(@react-pdf\/|@\/lib\/pdf\/(LogbookPDF|render)$|.*\/pdf\/(LogbookPDF|render)$)/;
  const IMPORT = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const hits: string[] = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      for (const m of src.matchAll(IMPORT)) {
        const spec = m[3] ?? m[4];
        if (m[2] || !spec) continue; // `import type` is erased
        if (FORBIDDEN.test(spec)) hits.push(`${relative(ROOT, file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(hits, [], "client-reachable PDF rendering would bypass the server gate");
});

test("route: session client only, and the plan is checked before flights are read", () => {
  const src = readFileSync(join(ROOT, "app/api/export/pdf/route.ts"), "utf8");
  assert.doesNotMatch(src, /supabase\/admin|createAdminClient|SERVICE_ROLE/, "service-role client would bypass RLS");
  assert.match(src, /from "@\/lib\/supabase\/server"/);
  const gate = src.indexOf("isFreeTier(");
  const read = src.indexOf("fetchAllFlights(");
  assert.ok(gate > 0 && read > 0 && gate < read, "isFreeTier must run before fetchAllFlights");
  assert.match(src, /fetchAllFlights\(supabase, \{[^}]*userId: user\.id/, "explicit user_id filter on top of RLS");
  assert.match(src, /private, no-store/);
});

// ---------------------------------------------------------------------------
// 6. Server render
// ---------------------------------------------------------------------------

function flight(i: number): Flight {
  const day = String((i % 28) + 1).padStart(2, "0");
  return {
    id: i, user_id: "u1", date: `2025-03-${day}`,
    make_model: "C172", registration: "C-GABC",
    pic: "SELF", copilot: null, third_pilot: null, check_pilot: null,
    route: "CYVR-CYXX", remarks: i % 5 === 0 ? `Remark ${i}` : null,
    category: "SE", role: "PIC",
    day_time: 1.2, night_time: 0.3, is_xcountry: true, multi_pilot: false,
    actual_inst: 0, hood_inst: 0.2, sim_inst: 0,
    ifr_approaches: 0, precision_approaches: 0, non_precision_approaches: 0, holds: 0,
    cfi_time: 0, takeoffs_day: 1, takeoffs_night: 0, landings_day: 1, landings_night: 0,
    duty_time: 0, created_at: "2025-03-01T00:00:00Z", updated_at: "2025-03-01T00:00:00Z",
  } as Flight;
}

test("LogbookPDF renders server-side: cover + ceil(n/24) flight pages + totals", async () => {
  const flights = Array.from({ length: 50 }, (_, i) => deriveFlight(flight(i + 1)));
  for (const layout of ["comprehensive", "faa", "easa", "cars"] as const) {
    const buf = await renderToBuffer(createElement(LogbookPDF, {
      flights, totals: computeTotals(flights), pilotName: "A. Pilot", licenseNumber: "CA-123",
      fromDate: "", toDate: "", generatedAt: "2026-10-30", layout,
    }) as Parameters<typeof renderToBuffer>[0]);
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-", layout);
    const pages = buf.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
    assert.equal(pages, 2 + Math.ceil(50 / 24), `${layout}: page count`);
  }
});

// ---------------------------------------------------------------------------

(async () => {
  for (const [name, fn] of queue) {
    try {
      await fn();
      passed++;
      console.log(`PASS  ${name}`);
    } catch (e) {
      failed++;
      const reason = e instanceof Error ? e.message : String(e);
      console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
    }
  }
  console.log(`\n${passed + failed} test(s) — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
