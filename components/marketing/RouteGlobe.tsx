"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { Airport } from "@/lib/airports";
import { GlobeBoundary } from "@/components/WebGLGate";
import type { GlobeStrings } from "@/app/app/charts/charts-strings";

/**
 * The homepage route globe: the app's own Charts globe (a 2D-canvas night
 * globe — no WebGL, no three.js) showing a FICTIONAL sample career, labelled
 * "Sample logbook". A visitor can type a route of their own ("CYYZ-KJFK-EGLL")
 * and it is drawn on top; the codes are looked up in static per-letter files
 * (public/airports/*.json, scripts/build-airport-shards.ts) and nothing is
 * sent anywhere or stored.
 *
 * Mounted only when it nears the viewport, so the static page's first paint
 * never waits on it.
 */
const FlightGlobe = dynamic(() => import("@/app/app/charts/Globe"), {
  ssr: false,
  loading: () => <div className="globe-stage rounded-card" style={{ height: 420 }} aria-hidden />,
});

/** A made-up career — regional flying in eastern Canada, then widebody out of Seoul and Dubai. Not anyone's real logbook. */
const SAMPLE_AIRPORTS: Record<string, Airport> = {
  CYYZ: { lat: 43.6759, lon: -79.6294, name: "Toronto Pearson International Airport", country: "CA" },
  CYUL: { lat: 45.4678, lon: -73.7423, name: "Montréal–Trudeau International Airport", country: "CA" },
  CYOW: { lat: 45.3225, lon: -75.6692, name: "Ottawa Macdonald-Cartier International Airport", country: "CA" },
  CYHZ: { lat: 44.8808, lon: -63.5086, name: "Halifax Stanfield International Airport", country: "CA" },
  CYQB: { lat: 46.7911, lon: -71.3933, name: "Québec Jean Lesage International Airport", country: "CA" },
  CYWG: { lat: 49.91, lon: -97.2399, name: "Winnipeg Richardson International Airport", country: "CA" },
  KORD: { lat: 41.9786, lon: -87.9048, name: "Chicago O'Hare International Airport", country: "US" },
  KBOS: { lat: 42.362, lon: -71.0079, name: "Boston Logan International Airport", country: "US" },
  KJFK: { lat: 40.6394, lon: -73.7793, name: "John F. Kennedy International Airport", country: "US" },
  KLAX: { lat: 33.9425, lon: -118.408, name: "Los Angeles International Airport", country: "US" },
  KSFO: { lat: 37.6198, lon: -122.3748, name: "San Francisco International Airport", country: "US" },
  PANC: { lat: 61.179, lon: -149.9926, name: "Ted Stevens Anchorage International Airport", country: "US" },
  MMUN: { lat: 21.0408, lon: -86.8735, name: "Cancún International Airport", country: "MX" },
  EGLL: { lat: 51.4707, lon: -0.4599, name: "London Heathrow Airport", country: "GB" },
  LFPG: { lat: 49.009, lon: 2.5541, name: "Paris Charles de Gaulle Airport", country: "FR" },
  EDDF: { lat: 50.0267, lon: 8.5584, name: "Frankfurt Airport", country: "DE" },
  OMDB: { lat: 25.2498, lon: 55.371, name: "Dubai International Airport", country: "AE" },
  VIDP: { lat: 28.5556, lon: 77.0952, name: "Indira Gandhi International Airport", country: "IN" },
  RKSI: { lat: 37.4691, lon: 126.451, name: "Incheon International Airport", country: "KR" },
  RJTT: { lat: 35.5497, lon: 139.787, name: "Tokyo Haneda Airport", country: "JP" },
  ZSPD: { lat: 31.1434, lon: 121.805, name: "Shanghai Pudong International Airport", country: "CN" },
  VHHH: { lat: 22.3118, lon: 113.9149, name: "Hong Kong International Airport", country: "HK" },
  WSSS: { lat: 1.3502, lon: 103.994, name: "Singapore Changi Airport", country: "SG" },
  YSSY: { lat: -33.9461, lon: 151.177, name: "Sydney Kingsford Smith Airport", country: "AU" },
};
const SAMPLE_ROUTES: Array<{ from: string; to: string; count: number }> = [
  { from: "CYYZ", to: "CYUL", count: 212 }, { from: "CYYZ", to: "CYOW", count: 188 }, { from: "CYYZ", to: "CYHZ", count: 164 },
  { from: "CYYZ", to: "KORD", count: 142 }, { from: "RKSI", to: "RJTT", count: 140 }, { from: "CYUL", to: "CYQB", count: 131 },
  { from: "RKSI", to: "VHHH", count: 126 }, { from: "CYYZ", to: "KBOS", count: 118 }, { from: "RKSI", to: "ZSPD", count: 112 },
  { from: "CYYZ", to: "CYWG", count: 96 }, { from: "CYYZ", to: "KJFK", count: 88 }, { from: "RKSI", to: "WSSS", count: 84 },
  { from: "CYYZ", to: "EGLL", count: 64 }, { from: "CYUL", to: "LFPG", count: 58 }, { from: "RKSI", to: "KLAX", count: 52 },
  { from: "RKSI", to: "KSFO", count: 48 }, { from: "OMDB", to: "EGLL", count: 44 }, { from: "OMDB", to: "VIDP", count: 40 },
  { from: "RKSI", to: "EDDF", count: 36 }, { from: "CYYZ", to: "MMUN", count: 30 }, { from: "OMDB", to: "YSSY", count: 22 },
  { from: "RKSI", to: "PANC", count: 18 },
];

type Shard = Record<string, [number, number, string, string]>;
const shardCache = new Map<string, Promise<Shard>>();
function loadShard(letter: string): Promise<Shard> {
  let p = shardCache.get(letter);
  if (!p) {
    p = fetch(`/airports/${letter}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    shardCache.set(letter, p);
  }
  return p;
}

/** English only (the marketing site is English); inlined so the page doesn't ship the app's four-locale table. */
const GLOBE_STRINGS: GlobeStrings = {
  stageLabel: "Interactive route globe, sample logbook",
  stageHint: "Use the arrow keys to rotate the globe. The buttons above pause rotation and reset the view.",
  tapToExplore: "Tap to explore the globe",
  done: "Done",
  pauseRotation: "Pause rotation",
  resumeRotation: "Resume rotation",
  resetView: "Reset view",
  topRoutes: "Top routes",
  allTimeFlights: "Sample logbook",
  routesAirports: "{routes} routes · {airports} airports",
  flightOne: "{n} flight",
  flightMany: "{n} flights",
  greatCircle: "{flights} · {km} km great-circle",
  km: "{n} km",
  legend: "Arc width = flights · drag to spin · scroll to zoom",
  legendTouch: "Arc width = flights · dot size = traffic",
  legendTouchArmed: "Drag to spin · pinch to zoom",
  loading: "Loading globe…",
  unavailable: "The map couldn't be drawn in this browser.",
  yourRoutes: "Your routes",
  legsKm: "{legs} legs · {km} km great-circle",
};

const MAX_CODES = 12;
/** Letters that have a shard (no ICAO prefix starts with Q). Keep in step with scripts/build-airport-shards.ts. */
const SHARD_LETTERS = new Set("ABCDEFGHIJKLMNOPRSTUVWXYZ");

export default function RouteGlobe() {
  const holder = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const [near, setNear] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [extra, setExtra] = useState<Record<string, Airport>>({});
  const [legs, setLegs] = useState<Array<{ from: string; to: string }>>([]);

  useEffect(() => {
    const el = holder.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const strings = GLOBE_STRINGS;
  const airports = useMemo(() => ({ ...SAMPLE_AIRPORTS, ...extra }), [extra]);

  async function draw(e: FormEvent) {
    e.preventDefault();
    const codes = text.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    const bad = codes.filter((c) => c.length !== 4);
    if (bad.length) { setStatus({ tone: "warn", text: `Use 4-letter ICAO codes, like CYYZ-KJFK-EGLL (not ${bad.slice(0, 2).join(", ")}).` }); return; }
    if (codes.length < 2) { setStatus({ tone: "warn", text: "Type at least two airports, like CYYZ-KJFK." }); return; }
    const list = codes.slice(0, MAX_CODES);
    setBusy(true);
    const found: Record<string, Airport> = {};
    const shards = await Promise.all([...new Set(list.map((c) => c[0]))].filter((l) => SHARD_LETTERS.has(l)).map(async (l) => [l, await loadShard(l)] as const));
    const byLetter = new Map(shards);
    const missing: string[] = [];
    for (const c of list) {
      const a = SAMPLE_AIRPORTS[c] ? [SAMPLE_AIRPORTS[c].lat, SAMPLE_AIRPORTS[c].lon, SAMPLE_AIRPORTS[c].name, SAMPLE_AIRPORTS[c].country] as const : byLetter.get(c[0])?.[c];
      if (a) found[c] = { lat: a[0], lon: a[1], name: a[2], country: a[3] };
      else if (!missing.includes(c)) missing.push(c);
    }
    const next: Array<{ from: string; to: string }> = [];
    for (let i = 0; i + 1 < list.length; i++) if (found[list[i]] && found[list[i + 1]] && list[i] !== list[i + 1]) next.push({ from: list[i], to: list[i + 1] });
    setBusy(false);
    setExtra(found);
    setLegs(next);
    if (missing.length) setStatus({ tone: "warn", text: `Couldn't find ${missing.join(", ")}: check the ICAO code.${next.length ? ` Drew ${next.length} leg${next.length === 1 ? "" : "s"} with the rest.` : ""}` });
    else setStatus({ tone: "ok", text: `${next.length} leg${next.length === 1 ? "" : "s"} drawn${codes.length > MAX_CODES ? ` (first ${MAX_CODES} airports)` : ""}. Nothing is saved or sent anywhere.` });
  }

  function clear() {
    setLegs([]); setExtra({}); setText(""); setStatus(null);
  }

  return (
    <div ref={holder} className="min-w-0">
      {near ? (
        <GlobeBoundary onError={() => {}} fallback={<SampleList />}>
          <FlightGlobe airports={airports} arcs={SAMPLE_ROUTES} strings={strings} locale="en" visitorLegs={legs} chipStrip={false} routesPanel={false} />
        </GlobeBoundary>
      ) : (
        <div className="globe-stage rounded-card" style={{ height: 420 }} aria-hidden />
      )}

      <form onSubmit={draw} className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="w-full lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-ink-3)" }}>
          Draw your own route
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="CYYZ-KJFK-EGLL"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="h-12 min-w-0 flex-1 basis-56 rounded-[10px] px-4 lp-mono text-base outline-none focus-visible:ring-2"
          style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--lp-line-2)", color: "var(--lp-ink)" }}
        />
        <button type="submit" className="lp-btn lp-btn-ghost" disabled={busy}>{busy ? "Drawing…" : "Draw route"}</button>
        {legs.length > 0 && (
          <button type="button" onClick={clear} className="lp-link inline-flex items-center min-h-[44px] px-2 text-sm">Clear</button>
        )}
      </form>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm" style={{ color: status?.tone === "warn" ? "var(--lp-amber)" : "var(--lp-ink-3)" }}>
        {status?.text}
        {status?.tone === "ok" && legs.length > 0 && (
          <> <Link className="lp-cyan-text hover:underline" href="/signup">Import your logbook to see every route →</Link></>
        )}
      </p>
    </div>
  );
}

/** Shown if the globe itself fails: the sample's busiest routes as a list. */
function SampleList() {
  const top = SAMPLE_ROUTES.slice(0, 6);
  return (
    <div className="lp-panel p-5 space-y-2" role="status">
      <div className="lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-ink-3)" }}>Sample logbook · top routes</div>
      {top.map((r) => (
        <div key={`${r.from}-${r.to}`} className="flex justify-between lp-mono text-sm">
          <span style={{ color: "var(--lp-ink)" }}>{r.from} → {r.to}</span>
          <span style={{ color: "var(--lp-amber)" }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}
