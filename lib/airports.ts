/**
 * Server-side airport lookup. Loads data/airports.json once per process (Next
 * server function) and resolves ICAO/IATA codes to coordinates. Never shipped
 * to the client — the Globe component receives only the small subset that
 * matches the user's actual routes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Airport {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

let cache: Record<string, Airport> | null = null;

function load(): Record<string, Airport> {
  if (cache) return cache;
  const path = resolve(process.cwd(), "data/airports.json");
  cache = JSON.parse(readFileSync(path, "utf8"));
  return cache!;
}

export function lookup(code: string): Airport | undefined {
  return load()[code.trim().toUpperCase()];
}

/** Look up many codes; returns only the ones found in the airport DB. */
export function lookupMany(codes: string[]): Record<string, Airport> {
  const data = load();
  const out: Record<string, Airport> = {};
  for (const c of codes) {
    const k = c.trim().toUpperCase();
    if (!k) continue;
    const a = data[k];
    if (a) out[k] = a;
  }
  return out;
}

// ============================================================
// Flight-time-bounded plausibility check
// ============================================================

/**
 * Generous max ground speed (kt). Covers any common aircraft from a C150 at
 * 85 kt up to a 747 at ~510 kt. We pad with the safety factor below for
 * headwinds, climbs, descents, holding. Don't tighten this without checking
 * impact on long-haul jet routes.
 */
const CRUISE_SPEED_KT = 600;
const SAFETY_FACTOR = 1.5;

/**
 * Great-circle distance between two airports, in nautical miles.
 */
export function haversineDistanceNm(a: Airport, b: Airport): number {
  const R = 3440.065; // Earth radius (nm)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Given a flight's route codes + total flight time, return the codes that
 * are plausibly reachable. Strategy:
 *
 *   1. 4-letter codes that resolve to airports are trusted as "anchors"
 *      (ICAO format is the international standard for actual airports).
 *   2. 3-letter codes are validated by distance: a code's airport must be
 *      within `flight_time × 600 kt × 1.5` nm of at least one anchor.
 *      Otherwise it's almost certainly a navaid (VOR/NDB) that happens
 *      to share its ident with an unrelated real airport.
 *   3. If no 4-letter anchors exist (e.g. a US-only pilot routing in IATA
 *      codes like "LAX-SFO"), we trust everything — there's no reliable
 *      basis to validate distance.
 *
 * Returns the set of plausible codes; unknown / implausible codes are
 * dropped silently.
 */
export function validateFlightCodes(
  codes: string[],
  flightTimeHours: number,
): Set<string> {
  const data = load();
  const valid = new Set<string>();

  // Bucket: 4-letter anchors (trusted) vs 3-letter candidates (need check).
  const anchors: Airport[] = [];
  const candidates: { code: string; airport: Airport }[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    const a = data[code];
    if (!a) continue;
    if (code.length === 4) {
      anchors.push(a);
      valid.add(code);
    } else {
      candidates.push({ code, airport: a });
    }
  }

  // Fallback — no anchors to validate against. Trust all known codes.
  if (anchors.length === 0) {
    for (const c of candidates) valid.add(c.code);
    return valid;
  }

  // Maximum reachable distance from any anchor, given the flight time.
  // Math.max(1, …) handles 0-hour entries (sim, scratched flights) — still
  // allow some plotting rather than dropping everything.
  const maxDistNm = Math.max(1, flightTimeHours) * CRUISE_SPEED_KT * SAFETY_FACTOR;

  for (const c of candidates) {
    const minDistToAnchor = Math.min(
      ...anchors.map((a) => haversineDistanceNm(a, c.airport)),
    );
    if (minDistToAnchor <= maxDistNm) valid.add(c.code);
    // else: drop. Likely a navaid (VOR/NDB) sharing its ident with a real
    // airport elsewhere. Examples: BDR (Bridgeport VOR vs Sikorsky Memorial),
    // HUH (Watcom VOR vs Huahine, FP), CPL (CPL Flight Test vs Colombian
    // airport). No manual exclusion list needed — distance handles it.
  }
  return valid;
}
