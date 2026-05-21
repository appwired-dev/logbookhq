/**
 * Download a small world-countries GeoJSON for the Globe component.
 * Replaces the 1.5 MB satellite earth texture with a ~30 KB (gzipped)
 * vector outline rendered as polygons in three colors.
 *
 * Source: Natural Earth vector data (public domain).
 *   Resolution: 110m (low — fine for a globe at the size we render it).
 *
 * Run with:  npm run build:world
 * Output:    public/world-countries.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OUT = resolve("public/world-countries.json");

async function main() {
  console.log(`Fetching ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) { console.error(`Fetch failed: ${res.status}`); process.exit(1); }
  const text = await res.text();
  const json = JSON.parse(text);

  // Strip everything except geometry + a name property, to minimise payload.
  const slim = {
    type: "FeatureCollection",
    features: (json.features as any[]).map((f) => ({
      type: "Feature",
      properties: { name: f.properties?.NAME ?? f.properties?.ADMIN ?? "" },
      geometry: f.geometry,
    })),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(slim));
  const size = Buffer.byteLength(JSON.stringify(slim));
  console.log(`Wrote ${OUT}: ${slim.features.length} countries, ${(size / 1024).toFixed(1)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
