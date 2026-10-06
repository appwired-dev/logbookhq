/**
 * Split data/airports.json into one small file per ICAO first letter for the
 * homepage route globe ("type your route"): public/airports/A.json … Z.json.
 *
 *   npx tsx scripts/build-airport-shards.ts
 *
 * Only 4-letter ICAO idents. Each shard maps code → [lat, lon, name, country]
 * and is fetched by the browser only when a visitor types a code starting with
 * that letter (largest shard ~90 KB gzipped), so the marketing page never
 * downloads the full 70k-airport table. Source: OurAirports (public domain),
 * the same data that seeds the app's airports table.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const all = JSON.parse(readFileSync(join(ROOT, "data/airports.json"), "utf8")) as Record<string, { lat: number; lon: number; name: string; country?: string }>;
const shards = new Map<string, Record<string, [number, number, string, string]>>();
for (const [code, a] of Object.entries(all)) {
  if (!/^[A-Z]{4}$/.test(code)) continue;
  const s = shards.get(code[0]) ?? {};
  s[code] = [Math.round(a.lat * 1e4) / 1e4, Math.round(a.lon * 1e4) / 1e4, a.name.slice(0, 48), a.country ?? ""];
  shards.set(code[0], s);
}
const dir = join(ROOT, "public/airports");
mkdirSync(dir, { recursive: true });
let total = 0;
for (const [letter, s] of shards) {
  const body = JSON.stringify(s);
  writeFileSync(join(dir, `${letter}.json`), body);
  total += body.length;
}
console.log(`${shards.size} shards, ${[...shards.values()].reduce((n, s) => n + Object.keys(s).length, 0)} airports, ${Math.round(total / 1024)} KB`);
