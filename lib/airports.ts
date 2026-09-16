/**
 * Airport lookups for /app/charts (globe arcs + route validation).
 *
 * Airports live in a Postgres reference table (see migration 0020_airports).
 * `fetchAirports` pulls ONLY the codes a user actually flew — a few hundred at
 * most — instead of parsing the full 70k-entry data/airports.json into ~31MB of
 * heap per server instance on this route. The validation/distance helpers are
 * pure: they take the fetched map, so they stay trivially testable and unit-
 * tested against a fixture (scripts/airports.test.ts). data/airports.json
 * remains the source that seeds the table (scripts/load-airports.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Airport {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

const norm = (code: string) => code.trim().toUpperCase();

/**
 * Fetch the given codes from the airports table. Returns a map keyed by the
 * normalised (trimmed, upper-cased) code, containing only codes that exist.
 * One round trip per ~800 codes; a career's worth of distinct route codes is
 * well under that, so in practice this is a single query.
 */
export async function fetchAirports(
  supabase: SupabaseClient,
  codes: string[],
): Promise<Record<string, Airport>> {
  const uniq = [...new Set(codes.map(norm).filter(Boolean))];
  const out: Record<string, Airport> = {};
  if (uniq.length === 0) return out;
  const CHUNK = 800;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("airports")
      .select("code, lat, lon, name, country")
      .in("code", slice);
    if (error) throw error;
    for (const row of data ?? []) {
      out[row.code as string] = {
        lat: Number(row.lat),
        lon: Number(row.lon),
        name: (row.name as string) ?? "",
        country: (row.country as string) ?? "",
      };
    }
  }
  return out;
}

/** Subset of `data` for the given codes; skips blanks and unknown codes. */
export function lookupMany(
  codes: string[],
  data: Record<string, Airport>,
): Record<string, Airport> {
  const out: Record<string, Airport> = {};
  for (const c of codes) {
    const k = norm(c);
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
 * dropped silently. `data` is the airport map from `fetchAirports`.
 */
export function validateFlightCodes(
  codes: string[],
  flightTimeHours: number,
  data: Record<string, Airport>,
): Set<string> {
  const valid = new Set<string>();

  // Bucket: 4-letter anchors (trusted) vs 3-letter candidates (need check).
  const anchors: Airport[] = [];
  const candidates: { code: string; airport: Airport }[] = [];
  for (const raw of codes) {
    const code = norm(raw);
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
