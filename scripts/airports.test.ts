/**
 * Tests for lib/airports.ts.
 *
 *   npm run test:airports
 *
 * Pure-function tests (validateFlightCodes / haversine / lookupMany) run
 * offline against a fixture. The fetchAirports integration test runs only if a
 * Supabase with the airports table is reachable (uses .env.local); otherwise
 * it SKIPs so the suite stays offline-safe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchAirports, lookupMany, validateFlightCodes, haversineDistanceNm, type Airport } from "../lib/airports";

let passed = 0, failed = 0, skipped = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS  ${name}`); }
  catch (e) {
    if (e instanceof Error && e.message === "SKIP") { skipped++; console.log(`SKIP  ${name}`); return; }
    failed++; console.log(`FAIL  ${name}\n      ${(e instanceof Error ? e.message : String(e)).split("\n").join("\n      ")}`);
  }
}

// ---- Fixture for the pure functions -------------------------------------
const FIX: Record<string, Airport> = {
  CYYZ: { lat: 43.6772, lon: -79.6306, name: "Toronto Pearson", country: "CA" },
  YTZ:  { lat: 43.6275, lon: -79.396,  name: "Billy Bishop",   country: "CA" }, // ~10nm from CYYZ
  HNL:  { lat: 21.3187, lon: -157.9224, name: "Honolulu",      country: "US" }, // ~4000nm away
};

async function run() {
  await test("validateFlightCodes: 4-letter anchor + nearby 3-letter both valid", () => {
    const v = validateFlightCodes(["CYYZ", "YTZ"], 1, FIX);
    assert.deepEqual([...v].sort(), ["CYYZ", "YTZ"]);
  });
  await test("validateFlightCodes: far 3-letter dropped when an anchor exists", () => {
    const v = validateFlightCodes(["CYYZ", "HNL"], 1, FIX); // 1h → max ~900nm; HNL ~4000nm
    assert.deepEqual([...v], ["CYYZ"]);
  });
  await test("validateFlightCodes: no anchors → trust all known codes", () => {
    const v = validateFlightCodes(["YTZ", "HNL"], 1, FIX);
    assert.deepEqual([...v].sort(), ["HNL", "YTZ"]);
  });
  await test("haversine: same point = 0; CYYZ↔HNL is trans-Pacific", () => {
    assert.equal(haversineDistanceNm(FIX.CYYZ, FIX.CYYZ), 0);
    const d = haversineDistanceNm(FIX.CYYZ, FIX.HNL);
    assert.ok(d > 3800 && d < 4600, `CYYZ↔HNL ${d.toFixed(0)}nm`);
  });
  await test("lookupMany: uppercases, skips blank + unknown", () => {
    const out = lookupMany(["cyyz", " ", "XXXX", "ytz"], FIX);
    assert.deepEqual(Object.keys(out).sort(), ["CYYZ", "YTZ"]);
  });

  // ---- Integration: fetchAirports against a real table ------------------
  // load .env.local (local Supabase creds) if present
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch { /* none */ }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const json = JSON.parse(readFileSync(resolve(process.cwd(), "data/airports.json"), "utf8")) as Record<string, Airport>;

  await test("fetchAirports: returns DB coords matching data/airports.json (50-code sample)", async () => {
    if (!url || !key) throw new Error("SKIP");
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    // Probe once; if the table is empty/unreachable, skip.
    let probe;
    try { probe = await fetchAirports(sb, ["CYYZ", "klax", "EGLL", "ZZZZZ"]); }
    catch { throw new Error("SKIP"); }
    if (Object.keys(probe).length === 0) throw new Error("SKIP");
    assert.ok(!("ZZZZZ" in probe), "unknown code absent");
    assert.ok(probe.KLAX, "lowercase input resolves (uppercased)");
    // Sample 50 real codes and assert exact coord/name/country match to JSON.
    const codes = Object.keys(json);
    const sample = Array.from({ length: 50 }, (_, i) => codes[(i * 1399) % codes.length]);
    const got = await fetchAirports(sb, sample);
    for (const c of sample) {
      const j = json[c], g = got[c];
      assert.ok(g, `missing ${c}`);
      assert.ok(Math.abs(g.lat - j.lat) < 1e-6 && Math.abs(g.lon - j.lon) < 1e-6, `coords ${c}`);
      assert.equal(g.name, j.name ?? "", `name ${c}`);
      assert.equal(g.country, j.country ?? "", `country ${c}`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
}
run();
