/**
 * Download the OurAirports.com airport database, filter to airports with
 * usable ICAO/ident codes, and emit a slim JSON file the client fetches.
 *
 * Run with:  npm run build:airports
 *
 * Output:  public/airports.json  (~ICAO code → {lat, lon, name, country})
 *
 * Source: https://ourairports.com/data/ (Public Domain / Unlicense)
 *   CSV: https://davidmegginson.github.io/ourairports-data/airports.csv
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const OUT = resolve("data/airports.json");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else { inQ = false; } }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(field); field = ""; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

async function main() {
  console.log(`Fetching ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) { console.error(`Fetch failed: ${res.status}`); process.exit(1); }
  const text = await res.text();
  const lines = text.split("\n");
  const header = parseCsvLine(lines[0]);
  const col = (name: string) => header.indexOf(name);

  const idxIdent = col("ident");
  const idxType = col("type");
  const idxName = col("name");
  const idxLat = col("latitude_deg");
  const idxLon = col("longitude_deg");
  const idxCountry = col("iso_country");
  const idxGps = col("gps_code");
  const idxIata = col("iata_code");
  const idxLocal = col("local_code");

  if ([idxIdent, idxType, idxName, idxLat, idxLon, idxCountry].some((i) => i < 0)) {
    console.error("Header missing expected columns");
    process.exit(1);
  }

  /**
   * Keep airports where we have a usable identifier (4-letter ICAO or 3-letter
   * IATA) and which are real airports (skip closed/heliports/balloonports for
   * size). Index by ICAO code primarily; also index by IATA where present so
   * pilots who log `LAX` instead of `KLAX` still get a hit.
   */
  const out: Record<string, { lat: number; lon: number; name: string; country: string }> = {};
  const wantedTypes = new Set([
    "large_airport", "medium_airport", "small_airport", "seaplane_base",
  ]);
  let kept = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 6) continue;
    const type = row[idxType];
    if (!wantedTypes.has(type)) continue;
    const lat = parseFloat(row[idxLat]);
    const lon = parseFloat(row[idxLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const entry = {
      lat, lon,
      name: row[idxName],
      country: row[idxCountry],
    };

    const candidates = [
      row[idxIdent],
      row[idxGps],
      row[idxIata],
      row[idxLocal],
    ].filter((s) => s && s.length >= 3);

    for (const code of candidates) {
      const k = code.trim().toUpperCase();
      if (!k || out[k]) continue; // first-write wins (ICAO usually comes first)
      out[k] = entry;
    }
    kept++;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${OUT}: ${kept} airports, ${Object.keys(out).length} code entries`);
}

main().catch((e) => { console.error(e); process.exit(1); });
