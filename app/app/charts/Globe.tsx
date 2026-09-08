"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { GlobeMethods } from "react-globe.gl";
import type { Airport } from "@/lib/airports";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Icon } from "@/components/ui";
// TODO(icons): fold Pause / Play into components/ui/icons.ts (owned by another
// phase); imported directly until then, same as CustomBars.tsx.
import { Pause, Play } from "lucide-react";
import { fmt, type GlobeStrings } from "./charts-strings";

/**
 * Career flight globe.
 *
 * Vector globe (country polygons from a ~250 KB GeoJSON) with great-circle
 * arcs for every route flown, airport dots scaled by traffic, ICAO labels on
 * the busiest hubs, and a side panel of top routes that flies the camera to
 * a route on click.
 *
 * Motion notes:
 *  - OrbitControls auto-rotates slowly with damping; rotation pauses while the
 *    user drags or hovers an arc/airport and resumes after a short idle.
 *  - Zoom-dependent sizes (arc stroke, dot radius, label size) are driven by a
 *    QUANTISED altitude (0.25 steps). Feeding raw zoom into React state made
 *    globe.gl rebuild every arc/point on every wheel tick — visible stutter.
 *  - `prefers-reduced-motion` disables auto-rotate, arc dash animation, rings
 *    and every camera fly-through.
 *
 * Input notes:
 *  - Coarse pointers (phones, tablets) get the stage in a *parked* state:
 *    `touch-action: pan-y` and no OrbitControls touch gestures, so a swipe
 *    scrolls the page instead of trapping the finger on a WebGL canvas. A
 *    "Tap to explore" pill arms it; "Done" parks it again.
 *  - Wheel zoom only engages while the stage is hovered or focused, so a page
 *    scroll that happens to pass over the globe doesn't zoom it.
 *  - The stage is focusable: arrow keys nudge the camera.
 */
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// ---------- palette ----------
// three.js and globe.gl parse colour strings themselves and cannot resolve
// `var()`, so every scene colour is read off :root at runtime instead. The
// tokens live in the "Phase 3 — charts" block of app/globals.css.
const GLOBE_TOKENS = [
  "ocean", "ocean-deep", "ocean-spec", "land", "land-hover", "graticule",
  "atmosphere", "hub", "dot", "arc-from", "arc-to", "arc-sel-from", "arc-sel-to",
  "ring", "light", "light-sky", "light-ground",
] as const;
type GlobeToken = (typeof GLOBE_TOKENS)[number];
/** Token name → the raw `"r g b"` triple held by the CSS variable. */
type Palette = Record<GlobeToken, string>;

/** Read one CSS custom property off :root. Empty during SSR. */
function cssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readPalette(): Palette {
  const out = {} as Palette;
  for (const token of GLOBE_TOKENS) out[token] = cssVar(`--globe-${token}`) || "0 0 0";
  return out;
}

// Legacy comma syntax on purpose: three.js `Color.setStyle` and globe.gl's
// colour parsing both match `rgb(r, g, b)` / `rgba(r, g, b, a)` only — the
// modern space-separated form silently fails to parse.
const parts = (triple: string) => triple.split(/\s+/).filter(Boolean);
const rgb = (triple: string) => `rgb(${parts(triple).join(",")})`;
const rgba = (triple: string, alpha: number) => `rgba(${parts(triple).join(",")},${alpha})`;
const color = (triple: string) => new THREE.Color(rgb(triple));

interface ArcDatum {
  id: string; from: string; to: string;
  startLat: number; startLng: number; endLat: number; endLng: number;
  count: number; km: number;
}
interface PointDatum {
  code: string; name: string; country: string;
  lat: number; lng: number; traffic: number; hub: boolean;
}
interface CountryFeature { properties?: { name?: string } }

export interface GlobeProps {
  airports: Record<string, Airport>;
  arcs: Array<{ from: string; to: string; count: number }>;
  strings: GlobeStrings;
  locale: Locale;
}

// ---------- spherical helpers ----------
const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
function toVec(lat: number, lng: number): [number, number, number] {
  const la = toRad(lat), lo = toRad(lng);
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}
function fromVec([x, y, z]: [number, number, number]) {
  const n = Math.hypot(x, y, z) || 1;
  return { lat: toDeg(Math.asin(z / n)), lng: toDeg(Math.atan2(y, x)) };
}
function angularDistance(aLat: number, aLng: number, bLat: number, bLng: number) {
  const [ax, ay, az] = toVec(aLat, aLng);
  const [bx, by, bz] = toVec(bLat, bLng);
  return Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
}
const greatCircleKm = (aLat: number, aLng: number, bLat: number, bLng: number) =>
  angularDistance(aLat, aLng, bLat, bLng) * R_EARTH_KM;
/** Deterministic 0..1 from a string — staggers arc dash phases without Math.random. */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/** Keyboard nudge per arrow press, in degrees (Shift = coarse step). */
const NUDGE_DEG = 6;
const NUDGE_DEG_FAST = 20;

export default function FlightGlobe({ airports, arcs: rawArcs, strings, locale }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const hintId = useId();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ w: 900, h: 560 });
  const [countries, setCountries] = useState<object[]>([]);
  const [ready, setReady] = useState(false);
  const [altQ, setAltQ] = useState(2.0);
  const [rotateOn, setRotateOn] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverCountry, setHoverCountry] = useState<object | null>(null);
  /** Primary pointer is touch — the stage stays parked until the user arms it. */
  const [coarse, setCoarse] = useState(false);
  const [armed, setArmed] = useState(false);
  /** Pointer is over the stage, or focus is inside it — gates wheel zoom. */
  const [zoomHot, setZoomHot] = useState(false);

  const rotateOnRef = useRef(true);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeRef = useRef({ lat: 30, lng: -40 });

  // Resolved once per mount. `useMemo` recomputes during the client's
  // hydration render, which is the first moment :root actually has values.
  const pal = useMemo(readPalette, []);
  /** Fully transparent — used where the scene must show the CSS backdrop. */
  const clear = useMemo(() => rgba(pal.dot, 0), [pal]);

  const flightCount = useCallback(
    (n: number) => fmt(n === 1 ? strings.flightOne : strings.flightMany, { n: n.toLocaleString(locale) }),
    [strings, locale],
  );

  // ---------- data ----------
  const arcs = useMemo<ArcDatum[]>(() => {
    const out: ArcDatum[] = [];
    for (const { from, to, count } of rawArcs) {
      const a = airports[from], b = airports[to];
      if (!a || !b) continue;
      out.push({
        id: `${from}-${to}`, from, to,
        startLat: a.lat, startLng: a.lon, endLat: b.lat, endLng: b.lon,
        count, km: Math.round(greatCircleKm(a.lat, a.lon, b.lat, b.lon)),
      });
    }
    return out.sort((x, y) => y.count - x.count);
  }, [airports, rawArcs]);
  const maxCount = useMemo(() => arcs.reduce((m, a) => Math.max(m, a.count), 1), [arcs]);

  const points = useMemo<PointDatum[]>(() => {
    const traffic = new Map<string, number>();
    for (const a of arcs) {
      traffic.set(a.from, (traffic.get(a.from) ?? 0) + a.count);
      traffic.set(a.to, (traffic.get(a.to) ?? 0) + a.count);
    }
    const list: PointDatum[] = Object.entries(airports).map(([code, a]) => ({
      code, name: a.name, country: a.country, lat: a.lat, lng: a.lon,
      traffic: traffic.get(code) ?? 0, hub: false,
    }));
    list.sort((x, y) => y.traffic - x.traffic);
    const hubCut = Math.max(1, Math.ceil(list.length * 0.1));
    list.forEach((p, i) => { p.hub = i < hubCut && p.traffic > 0; });
    return list;
  }, [airports, arcs]);
  const maxTraffic = useMemo(() => points.reduce((m, p) => Math.max(m, p.traffic), 1), [points]);
  const labels = useMemo(() => points.filter((p) => p.traffic > 0).slice(0, 12), [points]);
  const rings = useMemo(() => points.filter((p) => p.traffic > 0).slice(0, 3), [points]);
  const topRoutes = useMemo(() => arcs.slice(0, 6), [arcs]);

  // Traffic-weighted spherical mean of the airports — a sensible "home" view
  // that handles the antimeridian (a plain lat/lng average of YVR + HKG would
  // point at the middle of the Pacific... or Kansas, depending on sign).
  const home = useMemo(() => {
    let x = 0, y = 0, z = 0;
    for (const p of points) {
      const w = Math.sqrt(p.traffic) + 0.2;
      const [a, b, c] = toVec(p.lat, p.lng);
      x += a * w; y += b * w; z += c * w;
    }
    return (!x && !y && !z) ? { lat: 30, lng: -40 } : fromVec([x, y, z]);
  }, [points]);
  useEffect(() => { homeRef.current = home; }, [home]);

  const zoomScale = Math.min(1, Math.max(0.3, altQ / 2));

  // ---------- environment ----------
  useEffect(() => {
    fetch("/world-countries.json")
      .then((r) => r.json())
      .then((data) => setCountries(data.features ?? []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => { if (reduceMotion) setRotateOn(false); }, [reduceMotion]);

  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    if (!mq) return;
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (width: number) => {
      const w = Math.max(320, Math.floor(width));
      setSize({ w, h: Math.min(640, Math.max(420, Math.round(w * 0.6))) });
    };
    // Measure immediately so the first WebGL frame is already the right size;
    // the observer then tracks container changes.
    apply(el.getBoundingClientRect().width || 900);
    const ro = new ResizeObserver((entries) => { for (const e of entries) apply(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  // ---------- input gating ----------
  // Touch gestures are switched off wholesale on coarse pointers until the user
  // arms the stage; the mouse bindings (`mouseButtons`) are never touched, so
  // pointer devices behave exactly as before. OrbitControls forces
  // `touch-action: none` onto the canvas when it connects, so the parked value
  // has to be written back onto that same element.
  const touchLive = !coarse || armed;
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready) return;
    const c = g.controls();
    c.touches.ONE = touchLive ? THREE.TOUCH.ROTATE : null;
    c.touches.TWO = touchLive ? THREE.TOUCH.DOLLY_PAN : null;
    c.enableZoom = coarse ? armed : zoomHot;
    const canvas = c.domElement as HTMLElement | null;
    if (canvas) canvas.style.touchAction = touchLive ? "none" : "pan-y";
  }, [ready, coarse, armed, touchLive, zoomHot]);

  // ---------- rotation choreography ----------
  const scheduleResume = useCallback((ms: number) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      const c = globeRef.current?.controls();
      if (c && rotateOnRef.current && !draggingRef.current && !hoveringRef.current) c.autoRotate = true;
    }, ms);
  }, []);

  useEffect(() => {
    rotateOnRef.current = rotateOn;
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = rotateOn;
  }, [rotateOn]);

  const onHoverObj = useCallback((obj: object | null) => {
    hoveringRef.current = Boolean(obj);
    const c = globeRef.current?.controls();
    if (!c) return;
    if (obj) {
      c.autoRotate = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    } else {
      scheduleResume(1500);
    }
  }, [scheduleResume]);

  const onGlobeReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.7;
    controls.enablePan = false;
    controls.minDistance = 125;
    controls.maxDistance = 480;
    controls.autoRotate = rotateOnRef.current;
    controls.autoRotateSpeed = 0.45;
    controls.addEventListener("start", () => {
      draggingRef.current = true;
      controls.autoRotate = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    });
    controls.addEventListener("end", () => {
      draggingRef.current = false;
      scheduleResume(3500);
    });

    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Soft studio lighting: ambient + hemisphere for gentle top/bottom shading,
    // plus a key light parented to the camera so the specular highlight on the
    // ocean follows the viewer instead of painting a fixed day/night line.
    const scene = g.scene();
    const camera = g.camera();
    const key = new THREE.DirectionalLight(color(pal.light), 0.5);
    key.position.set(-1.2, 1.4, 1.6);
    camera.add(key);
    scene.add(camera);
    g.lights([
      new THREE.AmbientLight(color(pal.light), 0.75),
      new THREE.HemisphereLight(color(pal["light-sky"]), color(pal["light-ground"]), 0.7),
    ]);

    g.pointOfView({ ...homeRef.current, altitude: 2.0 }, reduceMotion ? 0 : 1400);
    setReady(true);
  }, [scheduleResume, pal, reduceMotion]);

  // ---------- camera actions ----------
  const flyTo = useCallback((a: ArcDatum) => {
    const g = globeRef.current;
    if (!g) return;
    const [x1, y1, z1] = toVec(a.startLat, a.startLng);
    const [x2, y2, z2] = toVec(a.endLat, a.endLng);
    const mid = fromVec([x1 + x2, y1 + y2, z1 + z2]);
    const theta = angularDistance(a.startLat, a.startLng, a.endLat, a.endLng);
    const altitude = Math.min(2.4, Math.max(0.7, 0.55 + theta * 1.5));
    const c = g.controls();
    c.autoRotate = false;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    g.pointOfView({ lat: mid.lat, lng: mid.lng, altitude }, reduceMotion ? 0 : 1200);
    scheduleResume(8000);
  }, [scheduleResume, reduceMotion]);

  const selectRoute = useCallback((a: ArcDatum | null) => {
    setSelected((prev) => (a && prev === a.id ? null : a?.id ?? null));
    if (a) flyTo(a);
  }, [flyTo]);

  const resetView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    setSelected(null);
    g.pointOfView({ ...homeRef.current, altitude: 2.0 }, reduceMotion ? 0 : 1200);
    scheduleResume(2000);
  }, [scheduleResume, reduceMotion]);

  /** Arrow-key camera nudge — the keyboard equivalent of a short drag. */
  const nudge = useCallback((dLat: number, dLng: number) => {
    const g = globeRef.current;
    if (!g) return;
    const pov = g.pointOfView();
    const c = g.controls();
    c.autoRotate = false;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    g.pointOfView({
      lat: Math.max(-85, Math.min(85, pov.lat + dLat)),
      lng: ((((pov.lng + dLng + 180) % 360) + 360) % 360) - 180,
      altitude: pov.altitude,
    }, reduceMotion ? 0 : 240);
    scheduleResume(4000);
  }, [scheduleResume, reduceMotion]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? NUDGE_DEG_FAST : NUDGE_DEG;
    switch (e.key) {
      case "ArrowLeft":  e.preventDefault(); nudge(0, -step); break;
      case "ArrowRight": e.preventDefault(); nudge(0, step); break;
      case "ArrowUp":    e.preventDefault(); nudge(step, 0); break;
      case "ArrowDown":  e.preventDefault(); nudge(-step, 0); break;
      default: break;
    }
  }, [nudge]);

  // ---------- accessors (object-typed to satisfy globe.gl's generics) ----------
  const arcColor = useCallback((o: object) => {
    const d = o as ArcDatum;
    if (selected && d.id !== selected) return [rgba(pal["arc-from"], 0.1), rgba(pal["arc-to"], 0.1)];
    if (selected === d.id) return [rgba(pal["arc-sel-from"], 1), rgba(pal["arc-sel-to"], 1)];
    const t = Math.pow(d.count / maxCount, 0.6);
    const a = 0.45 + 0.5 * t;
    return [rgba(pal["arc-from"], a), rgba(pal["arc-to"], a)];
  }, [selected, maxCount, pal]);

  const arcStroke = useCallback((o: object) => {
    const d = o as ArcDatum;
    const t = Math.pow(d.count / maxCount, 0.6);
    const base = 0.22 + 0.7 * t;
    return (selected === d.id ? base * 1.6 : base) * zoomScale;
  }, [selected, maxCount, zoomScale]);

  const pointRadius = useCallback((o: object) => {
    const d = o as PointDatum;
    return (0.12 + 0.38 * Math.sqrt(d.traffic / maxTraffic)) * zoomScale;
  }, [maxTraffic, zoomScale]);

  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: color(pal.ocean),
    emissive: color(pal["ocean-deep"]),
    emissiveIntensity: 0.25,
    shininess: 18,
    specular: color(pal["ocean-spec"]),
  }), [pal]);

  if (arcs.length === 0) return null;

  const selectedArc = selected ? arcs.find((a) => a.id === selected) ?? null : null;
  const legend = coarse ? (armed ? strings.legendTouchArmed : strings.legendTouch) : strings.legend;

  return (
    <div className="relative min-w-0">
      <p id={hintId} className="sr-only">{strings.stageHint}</p>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-label={strings.stageLabel}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onFocus={() => setZoomHot(true)}
        onBlur={() => setZoomHot(false)}
        onPointerEnter={(e) => { if (e.pointerType !== "touch") setZoomHot(true); }}
        onPointerLeave={() => setZoomHot(false)}
        className="globe-stage relative w-full overflow-hidden rounded-card ring-1 ring-ink-1/10
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
        style={{ height: size.h, touchAction: coarse ? (armed ? "none" : "pan-y") : undefined }}
      >
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor={clear}
          rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onGlobeReady={onGlobeReady}
          showAtmosphere
          atmosphereColor={rgb(pal.atmosphere)}
          atmosphereAltitude={0.18}
          globeImageUrl={null as unknown as string}
          globeMaterial={globeMaterial}

          polygonsData={countries}
          polygonAltitude={(o: object) => (o === hoverCountry ? 0.012 : 0.006)}
          polygonCapColor={(o: object) => (o === hoverCountry ? rgb(pal["land-hover"]) : rgb(pal.land))}
          polygonSideColor={() => clear}
          polygonStrokeColor={() => rgba(pal.graticule, 0.55)}
          polygonLabel={(o: object) => (o as CountryFeature).properties?.name ?? ""}
          onPolygonHover={(o: object | null) => setHoverCountry(o)}
          polygonsTransitionDuration={reduceMotion ? 0 : 250}

          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={arcColor}
          arcStroke={arcStroke}
          arcAltitudeAutoScale={0.45}
          arcDashLength={reduceMotion ? 1 : 0.45}
          arcDashGap={reduceMotion ? 0 : 0.25}
          arcDashInitialGap={(o: object) => hash01((o as ArcDatum).id)}
          arcDashAnimateTime={reduceMotion ? 0 : 4500}
          arcsTransitionDuration={0}
          arcLabel={(o: object) => {
            const d = o as ArcDatum;
            const km = fmt(strings.km, { n: d.km.toLocaleString(locale) });
            return `${d.from} → ${d.to} · ${flightCount(d.count)} · ${km}`;
          }}
          onArcHover={(o: object | null) => onHoverObj(o)}
          onArcClick={(o: object) => selectRoute(o as ArcDatum)}

          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.006}
          pointRadius={pointRadius}
          pointColor={(o: object) => ((o as PointDatum).hub ? rgb(pal.hub) : rgba(pal.dot, 0.9))}
          pointsTransitionDuration={0}
          pointLabel={(o: object) => {
            const d = o as PointDatum;
            return `${d.code} — ${d.name}${d.country ? `, ${d.country}` : ""} · ${flightCount(d.traffic)}`;
          }}
          onPointHover={(o: object | null) => onHoverObj(o)}

          labelsData={labels}
          labelLat="lat"
          labelLng="lng"
          labelText="code"
          labelSize={0.85 * zoomScale}
          labelDotRadius={0}
          labelIncludeDot={false}
          labelColor={() => rgba(pal.dot, 0.88)}
          labelAltitude={0.012}
          labelResolution={2}
          labelsTransitionDuration={0}
          onLabelHover={(o: object | null) => onHoverObj(o)}

          ringsData={reduceMotion ? [] : rings}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.008}
          ringColor={() => (t: number) => rgba(pal.ring, Math.max(0, 0.55 * (1 - t)))}
          ringMaxRadius={2.6}
          ringPropagationSpeed={1.1}
          ringRepeatPeriod={2000}

          onZoom={(pov: { altitude: number }) => {
            const q = Math.round(pov.altitude * 4) / 4;
            setAltQ((prev) => (prev === q ? prev : q));
          }}
        />

        {(!ready || countries.length === 0) && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-44 h-44 rounded-full bg-brand-glow/10 ring-1 ring-brand-glow/20 animate-pulse" />
            <span className="sr-only">{strings.loading}</span>
          </div>
        )}

        {/* Route / summary badge */}
        <div className="globe-hud absolute top-3 left-3 max-w-[70%] px-3 py-2 rounded-control">
          {selectedArc ? (
            <>
              <div className="globe-ink-1 font-mono text-xs font-bold tracking-tight">
                {selectedArc.from} → {selectedArc.to}
              </div>
              <div className="globe-ink-accent mt-0.5 text-2xs uppercase tracking-wider">
                {fmt(strings.greatCircle, {
                  flights: flightCount(selectedArc.count),
                  km: selectedArc.km.toLocaleString(locale),
                })}
              </div>
            </>
          ) : (
            <>
              <div className="globe-ink-1 text-xs font-bold tracking-tight">{strings.allTimeFlights}</div>
              <div className="globe-ink-info mt-0.5 text-2xs uppercase tracking-wider">
                {fmt(strings.routesAirports, {
                  routes: arcs.length.toLocaleString(locale),
                  airports: points.length.toLocaleString(locale),
                })}
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            type="button"
            className="globe-btn"
            title={rotateOn ? strings.pauseRotation : strings.resumeRotation}
            aria-label={rotateOn ? strings.pauseRotation : strings.resumeRotation}
            aria-pressed={!rotateOn}
            onClick={() => setRotateOn((v) => !v)}
          >
            {rotateOn
              ? <Pause size={15} strokeWidth={2} aria-hidden />
              : <Play size={15} strokeWidth={2} aria-hidden />}
          </button>
          <button
            type="button"
            className="globe-btn"
            title={strings.resetView}
            aria-label={strings.resetView}
            onClick={resetView}
          >
            <Icon.RotateCcw size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Top routes — click to fly */}
        {topRoutes.length > 0 && (
          <nav
            aria-label={strings.topRoutes}
            className="globe-hud absolute right-3 bottom-3 hidden md:block w-56 rounded-control p-3"
          >
            <div className="globe-ink-2 mb-2 text-2xs uppercase tracking-[0.14em]">{strings.topRoutes}</div>
            <ul className="space-y-1">
              {topRoutes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => selectRoute(a)}
                    aria-pressed={selected === a.id}
                    className={`globe-route ${selected === a.id ? "is-selected" : ""}`}
                  >
                    <span className="flex w-full justify-between gap-2 text-xs">
                      <span className="globe-ink-1 font-mono">{a.from} → {a.to}</span>
                      <span className="globe-ink-accent num">{a.count.toLocaleString(locale)}</span>
                    </span>
                    <span className="globe-meter mt-1 block h-1 w-full overflow-hidden rounded-pill">
                      <span
                        className="globe-meter-fill block h-full rounded-pill"
                        style={{ width: `${(a.count / maxCount) * 100}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Touch arming + legend. The md right inset clears the top-routes panel. */}
        <div className="absolute left-3 bottom-3 flex flex-col items-start gap-2
                        max-w-[calc(100%-1.5rem)] md:max-w-[calc(100%-15.5rem)]">
          {coarse && (
            <button
              type="button"
              className="globe-pill"
              aria-pressed={armed}
              onClick={() => setArmed((v) => !v)}
            >
              {armed
                ? <><Icon.Check size={14} strokeWidth={2} aria-hidden />{strings.done}</>
                : <><Icon.Globe2 size={14} strokeWidth={2} aria-hidden />{strings.tapToExplore}</>}
            </button>
          )}
          <p className="globe-ink-2 text-2xs pointer-events-none">{legend}</p>
        </div>
      </div>
    </div>
  );
}
