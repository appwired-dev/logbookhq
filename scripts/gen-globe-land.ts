/**
 * Generate public/globe-land.bin — the land "dots" the charts globe draws.
 *
 *   npx tsx scripts/gen-globe-land.ts
 *
 * Samples an even lat/lon grid (spacing in degrees along each parallel scaled
 * by cos(lat), so dots are equally dense everywhere) and keeps the points that
 * fall inside a country polygon of public/world-countries.json. Output is a
 * flat little-endian Int16 array of [lat×10, lon×10] pairs: ~8.7k points,
 * ~35 KB, fetched once and cached — far lighter than shipping the 250 KB
 * GeoJSON plus a 3D engine to every Charts visit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Ring = [number, number][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

const STEP = 1.12;
const ROOT = join(__dirname, "..");
const geo = JSON.parse(readFileSync(join(ROOT, "public/world-countries.json"), "utf8")) as { features: { geometry: Geometry | null }[] };

const polys: { x0: number; x1: number; y0: number; y1: number; outer: Ring; holes: Ring[] }[] = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  for (const poly of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
    const outer = poly[0];
    const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
    polys.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), outer, holes: poly.slice(1) });
  }
}

function inRing(x: number, y: number, r: Ring): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) c = !c;
  }
  return c;
}
const isLand = (lon: number, lat: number) =>
  polys.some((p) => lon >= p.x0 && lon <= p.x1 && lat >= p.y0 && lat <= p.y1 && inRing(lon, lat, p.outer) && !p.holes.some((h) => inRing(lon, lat, h)));

const out: number[] = [];
let row = 0;
for (let lat = -58; lat <= 80; lat += STEP, row++) {
  const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / STEP));
  for (let k = 0; k < n; k++) {
    let lon = -180 + (360 * k) / n + (row % 2 ? STEP / 2 : 0);
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    if (isLand(lon, lat)) out.push(Math.round(lat * 10), Math.round(lon * 10));
  }
}
const buf = Buffer.alloc(out.length * 2);
out.forEach((v, i) => buf.writeInt16LE(v, i * 2));
writeFileSync(join(ROOT, "public/globe-land.bin"), buf);
console.log(`globe-land.bin: ${out.length / 2} points, ${buf.length} bytes`);
