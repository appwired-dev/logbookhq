"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { GlobeMethods } from "react-globe.gl";
import type { Airport } from "@/lib/airports";

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
 *  - `prefers-reduced-motion` disables auto-rotate, arc dash animation and rings.
 */
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// ---------- palette ----------
const OCEAN = "#12407a";
const OCEAN_DEEP = "#0a2a55";
const LAND = "#3f7d5a";
const LAND_HOVER = "#5aa377";
const BORDER = "rgba(226, 240, 220, 0.55)";
const ATMOSPHERE = "#60a5fa";
const HUB = "#fbbf24";
const DOT = "rgba(255,255,255,0.9)";
const SPACE_BG = "radial-gradient(ellipse at 50% 42%, #1c2942 0%, #0f172a 62%, #0b1120 100%)";

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
  year: string;
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

export default function FlightGlobe({ airports, arcs: rawArcs, year }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const [countries, setCountries] = useState<object[]>([]);
  const [ready, setReady] = useState(false);
  const [altQ, setAltQ] = useState(2.0);
  const [rotateOn, setRotateOn] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverCountry, setHoverCountry] = useState<object | null>(null);

  const rotateOnRef = useRef(true);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeRef = useRef({ lat: 30, lng: -40 });

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

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) { setReduceMotion(true); setRotateOn(false); }
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
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(-1.2, 1.4, 1.6);
    camera.add(key);
    scene.add(camera);
    g.lights([new THREE.AmbientLight(0xffffff, 0.75), new THREE.HemisphereLight(0xe6f0ff, 0x0b1a33, 0.7)]);

    g.pointOfView({ ...homeRef.current, altitude: 2.0 }, 1400);
    setReady(true);
  }, [scheduleResume]);

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
    g.pointOfView({ lat: mid.lat, lng: mid.lng, altitude }, 1200);
    scheduleResume(8000);
  }, [scheduleResume]);

  const selectRoute = useCallback((a: ArcDatum | null) => {
    setSelected((prev) => (a && prev === a.id ? null : a?.id ?? null));
    if (a) flyTo(a);
  }, [flyTo]);

  const resetView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    setSelected(null);
    g.pointOfView({ ...homeRef.current, altitude: 2.0 }, 1200);
    scheduleResume(2000);
  }, [scheduleResume]);

  // ---------- accessors (object-typed to satisfy globe.gl's generics) ----------
  const arcColor = useCallback((o: object) => {
    const d = o as ArcDatum;
    if (selected && d.id !== selected) return ["rgba(253,224,71,0.10)", "rgba(217,119,6,0.10)"];
    if (selected === d.id) return ["rgba(254,240,138,1)", "rgba(245,158,11,1)"];
    const t = Math.pow(d.count / maxCount, 0.6);
    const a = 0.45 + 0.5 * t;
    return [`rgba(253,224,71,${a})`, `rgba(217,119,6,${a})`];
  }, [selected, maxCount]);

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
    color: new THREE.Color(OCEAN),
    emissive: new THREE.Color(OCEAN_DEEP),
    emissiveIntensity: 0.25,
    shininess: 18,
    specular: new THREE.Color("#3b5f95"),
  }), []);

  if (arcs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No flights with parsable routes in {year} yet.
      </div>
    );
  }

  const selectedArc = selected ? arcs.find((a) => a.id === selected) ?? null : null;
  const plural = (n: number) => (n === 1 ? "" : "s");

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-2xl ring-1 ring-slate-900/10"
      style={{ background: SPACE_BG, height: size.h }}
    >
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onGlobeReady={onGlobeReady}
        showAtmosphere
        atmosphereColor={ATMOSPHERE}
        atmosphereAltitude={0.18}
        globeImageUrl={null as unknown as string}
        globeMaterial={globeMaterial}

        polygonsData={countries}
        polygonAltitude={(o: object) => (o === hoverCountry ? 0.012 : 0.006)}
        polygonCapColor={(o: object) => (o === hoverCountry ? LAND_HOVER : LAND)}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={() => BORDER}
        polygonLabel={(o: object) => (o as CountryFeature).properties?.name ?? ""}
        onPolygonHover={(o: object | null) => setHoverCountry(o)}
        polygonsTransitionDuration={250}

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
          return `${d.from} → ${d.to} · ${d.count} flight${plural(d.count)} · ${d.km.toLocaleString()} km`;
        }}
        onArcHover={(o: object | null) => onHoverObj(o)}
        onArcClick={(o: object) => selectRoute(o as ArcDatum)}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.006}
        pointRadius={pointRadius}
        pointColor={(o: object) => ((o as PointDatum).hub ? HUB : DOT)}
        pointsTransitionDuration={0}
        pointLabel={(o: object) => {
          const d = o as PointDatum;
          return `${d.code} — ${d.name}${d.country ? `, ${d.country}` : ""} · ${d.traffic} flight${plural(d.traffic)}`;
        }}
        onPointHover={(o: object | null) => onHoverObj(o)}

        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="code"
        labelSize={0.85 * zoomScale}
        labelDotRadius={0}
        labelIncludeDot={false}
        labelColor={() => "rgba(255,255,255,0.88)"}
        labelAltitude={0.012}
        labelResolution={2}
        labelsTransitionDuration={0}
        onLabelHover={(o: object | null) => onHoverObj(o)}

        ringsData={reduceMotion ? [] : rings}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.008}
        ringColor={() => (t: number) => `rgba(251,191,36,${Math.max(0, 0.55 * (1 - t))})`}
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
          <div className="w-44 h-44 rounded-full bg-sky-400/10 ring-1 ring-sky-300/20 animate-pulse" />
        </div>
      )}

      {/* Route / summary badge */}
      <div className="absolute top-3 left-3 max-w-[70%] px-3 py-2 rounded-xl bg-slate-950/55 backdrop-blur border border-white/10 text-white text-xs">
        {selectedArc ? (
          <>
            <div className="font-bold tracking-tight font-mono">{selectedArc.from} → {selectedArc.to}</div>
            <div className="text-amber-200/90 text-[10px] uppercase tracking-wider">
              {selectedArc.count} flight{plural(selectedArc.count)} · {selectedArc.km.toLocaleString()} km great-circle
            </div>
          </>
        ) : (
          <>
            <div className="font-bold tracking-tight">{year} flights</div>
            <div className="text-sky-200/80 text-[10px] uppercase tracking-wider">
              {arcs.length.toLocaleString()} routes · {points.length.toLocaleString()} airports
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        <IconBtn title={rotateOn ? "Pause rotation" : "Resume rotation"} onClick={() => setRotateOn((v) => !v)}>
          {rotateOn ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </IconBtn>
        <IconBtn title="Reset view" onClick={resetView}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
        </IconBtn>
      </div>

      {/* Top routes — click to fly */}
      {topRoutes.length > 0 && (
        <div className="absolute right-3 bottom-3 hidden md:block w-56 rounded-xl bg-slate-950/55 backdrop-blur border border-white/10 p-3 text-white">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-300/80 mb-2">Top routes</div>
          <ul className="space-y-1.5">
            {topRoutes.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => selectRoute(a)}
                  className={`w-full text-left transition-opacity ${selected === a.id ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
                >
                  <div className="flex justify-between text-xs">
                    <span className="font-mono">{a.from} → {a.to}</span>
                    <span className="tabular-nums text-amber-200">{a.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${(a.count / maxCount) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="absolute left-3 bottom-3 text-[10px] text-slate-300/70 pointer-events-none">
        arc width = flights · dot size = traffic · drag to spin · scroll to zoom
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="w-8 h-8 grid place-items-center rounded-lg bg-slate-950/55 backdrop-blur border border-white/10 text-white/85 hover:text-white hover:bg-slate-950/75 transition-colors"
    >
      {children}
    </button>
  );
}
