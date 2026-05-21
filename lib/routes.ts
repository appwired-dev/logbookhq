/**
 * Parse a free-form route string into ordered airport segments.
 *
 * Examples:
 *   "CYVR-CYYZ"            → [["CYVR","CYYZ"]]
 *   "CZBB-CYXX-CZBB"       → [["CZBB","CYXX"],["CYXX","CZBB"]]
 *   "CYVR / CYYZ / CYUL"   → [["CYVR","CYYZ"],["CYYZ","CYUL"]]
 *   "CZBB-CZBB" (circuit)  → []  (same airport — no arc)
 */
export function parseRoute(route: string | null | undefined): [string, string][] {
  if (!route) return [];
  // Split on -, /, →, or whitespace; keep alphanumeric tokens.
  const codes = route
    .split(/[-→/\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{3,4}$/.test(s));
  const arcs: [string, string][] = [];
  for (let i = 0; i < codes.length - 1; i++) {
    if (codes[i] === codes[i + 1]) continue; // skip same-airport circuits
    arcs.push([codes[i], codes[i + 1]]);
  }
  return arcs;
}

/** Extract every unique code referenced by a list of route strings. */
export function uniqueCodes(routes: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const r of routes) {
    for (const [a, b] of parseRoute(r)) {
      set.add(a);
      set.add(b);
    }
  }
  return [...set];
}
