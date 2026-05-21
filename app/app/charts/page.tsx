import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { lookupMany, validateFlightCodes } from "@/lib/airports";
import { parseRoute } from "@/lib/routes";
import { getLocale } from "@/lib/i18n-server";
import ChartsClient from "./ChartsClient";

export default async function ChartsPage() {
  const supabase = await createClient();
  const flights = await fetchAllFlights(supabase, { orderAsc: true });
  const derived = flights.map(deriveFlight);

  // Career-wide flight-route bundle for the Globe. Each route's codes are
  // validated against the flight's total time — codes that are physically
  // unreachable (likely VOR/NDB navaids sharing idents with unrelated
  // airports) get filtered out. A code is only plotted if it passes the
  // plausibility check on every flight that references it; one implausible
  // sighting marks it implausible everywhere (prevents a long-haul flight
  // from accidentally legitimising a navaid that's clearly wrong on shorter
  // flights). See lib/airports.ts:validateFlightCodes.
  type Plausibility = "ok" | "blocked";
  const codeStatus = new Map<string, Plausibility>();
  const perFlightValid: { arcs: [string, string][]; valid: Set<string> }[] = [];

  for (const f of derived) {
    const arcs = parseRoute(f.route);
    if (arcs.length === 0) continue;
    const codes = [...new Set(arcs.flat())];
    const valid = validateFlightCodes(codes, f.total_time);
    perFlightValid.push({ arcs, valid });
    for (const c of codes) {
      if (valid.has(c)) {
        if (!codeStatus.has(c)) codeStatus.set(c, "ok");
      } else {
        codeStatus.set(c, "blocked"); // implausible on this flight → blocked globally
      }
    }
  }

  const globallyPlausible = new Set(
    [...codeStatus.entries()].filter(([, s]) => s === "ok").map(([c]) => c),
  );
  const airports = lookupMany([...globallyPlausible]);

  // Build arcs from flight legs where both endpoints are globally plausible.
  // Track each direction separately so we can label arcs correctly:
  //   - both directions flown → bidirectional label (still one arc on globe,
  //     since the great-circle line is the same physical curve)
  //   - only one direction flown → label points the direction it was actually
  //     flown (e.g. CYGE → CYBW stays CYGE → CYBW, not the alphabetical flip)
  //
  // We canonicalise the storage key (alphabetical), but remember which
  // direction(s) contributed to each entry.
  const directional = new Map<string, { forward: number; reverse: number }>();
  for (const { arcs } of perFlightValid) {
    for (const [a, b] of arcs) {
      if (!airports[a] || !airports[b]) continue;
      if (!globallyPlausible.has(a) || !globallyPlausible.has(b)) continue;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const key = `${lo}|${hi}`;
      const entry = directional.get(key) ?? { forward: 0, reverse: 0 };
      // `forward` = lo → hi, `reverse` = hi → lo.
      if (a === lo) entry.forward += 1;
      else entry.reverse += 1;
      directional.set(key, entry);
    }
  }
  const arcs = [...directional.entries()].map(([k, c]) => {
    const [lo, hi] = k.split("|");
    const total = c.forward + c.reverse;
    if (c.forward > 0 && c.reverse > 0) {
      // Flown both ways. Use the heavier direction as `from→to` so the
      // implied arrow leans toward the more-common direction; could swap to
      // a true bidirectional rendering on the globe if you ever want it.
      const fwd = c.forward >= c.reverse;
      return { from: fwd ? lo : hi, to: fwd ? hi : lo, count: total };
    }
    // Single-direction route — preserve the actual flown direction.
    if (c.forward > 0) return { from: lo, to: hi, count: total };
    return { from: hi, to: lo, count: total };
  });

  const locale = await getLocale();
  return <ChartsClient flights={derived} globeAirports={airports} globeArcs={arcs} globeYear="Career" locale={locale} />;
}
