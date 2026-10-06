"use client";

import {
  useId,
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { GlobeMethods } from "react-globe.gl";
import type { Locale } from "@/lib/i18n";
import { iso2ForFeatureName } from "@/lib/country-features";
import { GlobeBoundary, webglAvailable } from "@/components/WebGLGate";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Icon } from "@/components/ui";
import { adminOpsStrings } from "../admin-ops-strings";
import { countPhrase, countryText, intFormatter } from "./traffic-model";

/**
 * Visitor globe for the Traffic tab: a choropleth of visits by country.
 *
 * Same building blocks as the career globe (app/app/charts/Globe.tsx): the
 * ~250 KB /world-countries.json polygons, the dark "space" stage, scene
 * colours read off :root at runtime (three.js cannot resolve var()), a
 * ResizeObserver for sizing, and parked touch gestures so a swipe scrolls the
 * page instead of trapping the finger on the canvas.
 *
 *  - Shading: a sequential ramp from a muted land fill (no visits) to the
 *    --chart-1 token, alpha 0.15 → 0.9 on a log scale, pre-blended to an opaque
 *    colour so the ocean never bleeds through. Countries with traffic also get
 *    a bright outline, so a single visit is still visible.
 *  - Hover: tooltip "Country: n visits · m page views" (Intl.DisplayNames).
 *  - Click a country, or its row in the Countries list (GeoExplorer owns the
 *    focus): the camera flies to it and it is raised and highlighted; a
 *    second click, Escape or the reset button clears it.
 *  - No auto-rotate: a short arrival move (≤ 2 s, none under reduced motion)
 *    instead, so the data stays put while it is being read.
 *  - No WebGL, a failed polygon fetch or a lost context → onUnavailable(), and
 *    the parent shows the Countries list alone.
 *
 * Privacy boundary: this is a marginal (country totals only). Focusing a
 * country highlights it here and in the Countries list — it never filters
 * pages or sources, because no country × page data exists.
 */
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export type GlobeCountry = { code: string; visits: number; views: number };

type Geometry = { type: string; coordinates: unknown };
type Feature = { geometry?: Geometry; properties?: { name?: string } };
type Poly = {
  geometry: Geometry;
  code: string | null;
  name: string;
  visits: number;
  views: number;
  lat: number;
  lng: number;
  /** Rough angular size in degrees — sets the fly-to altitude. */
  extent: number;
};

// ---------- palette ----------
const TOKENS = {
  ocean: "--globe-ocean", oceanDeep: "--globe-ocean-deep", oceanSpec: "--globe-ocean-spec",
  graticule: "--globe-graticule", atmosphere: "--globe-atmosphere", ink: "--globe-ink",
  light: "--globe-light", lightSky: "--globe-light-sky", lightGround: "--globe-light-ground",
  accent: "--chart-1",
} as const;
type Palette = Record<keyof typeof TOKENS, [number, number, number]>;

function readPalette(): Palette {
  const css = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  const out = {} as Palette;
  for (const [k, v] of Object.entries(TOKENS) as [keyof typeof TOKENS, string][]) {
    const nums = (css?.getPropertyValue(v) ?? "").trim().split(/\s+/).map(Number);
    out[k] = nums.length === 3 && nums.every(Number.isFinite) ? [nums[0], nums[1], nums[2]] : [0, 0, 0];
  }
  return out;
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Legacy comma syntax on purpose: three.js and globe.gl only parse rgb(r, g, b) / rgba(r, g, b, a).
const rgb = (c: RGB) => `rgb(${c.map((x) => Math.round(x)).join(",")})`;
const rgba = (c: RGB, a: number) => `rgba(${c.map((x) => Math.round(x)).join(",")},${a})`;
const color3 = (c: RGB) => new THREE.Color(rgb(c));

// ---------- geometry helpers ----------
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
function toVec(lat: number, lng: number): RGB {
  const la = toRad(lat), lo = toRad(lng);
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}
function fromVec([x, y, z]: RGB) {
  const n = Math.hypot(x, y, z) || 1;
  return { lat: toDeg(Math.asin(z / n)), lng: toDeg(Math.atan2(y, x)) };
}

/** Centre and size of a feature's largest ring (so the USA centres on the lower 48, not Alaska). */
function ringCentre(geometry: Geometry): { lat: number; lng: number; extent: number } {
  const rings: number[][][] = [];
  if (geometry.type === "Polygon") rings.push((geometry.coordinates as number[][][])[0] ?? []);
  else if (geometry.type === "MultiPolygon") for (const p of geometry.coordinates as number[][][][]) rings.push(p[0] ?? []);
  let best: number[][] = [], bestArea = -1;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = r; }
  }
  if (best.length === 0) return { lat: 0, lng: 0, extent: 30 };
  let x = 0, y = 0, z = 0, minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lng, lat] of best) {
    const [a, b, c] = toVec(lat, lng);
    x += a; y += b; z += c;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  const centre = fromVec([x, y, z]);
  const extent = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos(toRad(centre.lat)));
  return { ...centre, extent };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const HOME_ALT = 1.8;
const NUDGE_DEG = 6;
const NUDGE_DEG_FAST = 20;

export default function TrafficGlobe(props: {
  countries: GlobeCountry[];
  focus: string | null;
  onFocusChange: (code: string | null) => void;
  /** Called once the polygons are on screen, with the codes that have one. */
  onReady: (codes: ReadonlySet<string>) => void;
  onUnavailable: () => void;
  locale: Locale;
}) {
  const { onUnavailable } = props;
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    const ok = webglAvailable();
    setWebgl(ok);
    if (!ok) onUnavailable();
  }, [onUnavailable]);
  if (!webgl) return null;
  return (
    <GlobeBoundary onError={onUnavailable}>
      <GlobeStage {...props} />
    </GlobeBoundary>
  );
}

function GlobeStage({ countries, focus, onFocusChange, onReady, onUnavailable, locale }: {
  countries: GlobeCountry[];
  focus: string | null;
  onFocusChange: (code: string | null) => void;
  onReady: (codes: ReadonlySet<string>) => void;
  onUnavailable: () => void;
  locale: Locale;
}) {
  const o = useMemo(() => adminOpsStrings(locale), [locale]);
  const nf = useMemo(() => intFormatter(locale), [locale]);
  const reduceMotion = useReducedMotion();
  const baseId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Poly | null>(null);
  const [coarse, setCoarse] = useState(false);
  const [zoomHot, setZoomHot] = useState(false);
  const reportedRef = useRef(false);
  const prevFocusRef = useRef<string | null>(null);

  // Read once per mount: the first client render is when :root has values.
  const pal = useMemo(readPalette, []);
  const land = useMemo(() => mix(pal.oceanDeep, pal.graticule, 0.35), [pal]);
  const fillFor = useCallback((alpha: number) => mix(land, pal.accent, alpha), [land, pal]);
  const clear = useMemo(() => rgba(pal.ink, 0), [pal]);

  // ---------- data ----------
  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c] as const)), [countries]);
  const maxVisits = useMemo(() => countries.reduce((m, c) => Math.max(m, c.visits), 0), [countries]);

  useEffect(() => {
    let alive = true;
    fetch("/world-countries.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { features?: Feature[] }) => {
        if (!alive) return;
        const list = (data.features ?? []).filter((f) => f.geometry);
        if (list.length === 0) onUnavailable();
        else setFeatures(list);
      })
      .catch(() => { if (alive) onUnavailable(); });
    return () => { alive = false; };
  }, [onUnavailable]);

  const polys = useMemo<Poly[]>(() => (features ?? []).map((f) => {
    const english = f.properties?.name ?? "";
    const code = iso2ForFeatureName(english);
    const row = code ? byCode.get(code) : undefined;
    const c = ringCentre(f.geometry!);
    return {
      geometry: f.geometry!,
      code,
      name: code ? countryText(code, locale, o) : english,
      visits: row?.visits ?? 0,
      views: row?.views ?? 0,
      lat: c.lat,
      lng: c.lng,
      extent: c.extent,
    };
  }), [features, byCode, locale, o]);

  const polyByCode = useMemo(() => {
    const m = new Map<string, Poly>();
    for (const p of polys) if (p.code && !m.has(p.code)) m.set(p.code, p);
    return m;
  }, [polys]);

  /** Visits-weighted centre of the countries with traffic — the resting view. */
  const home = useMemo(() => {
    let x = 0, y = 0, z = 0;
    for (const p of polys) {
      if (p.visits <= 0) continue;
      const w = Math.sqrt(p.visits);
      const [a, b, c] = toVec(p.lat, p.lng);
      x += a * w; y += b * w; z += c * w;
    }
    return !x && !y && !z ? { lat: 25, lng: -40 } : fromVec([x, y, z]);
  }, [polys]);
  const homeRef = useRef(home);
  useEffect(() => { homeRef.current = home; }, [home]);

  const alphaFor = useCallback((p: Poly) => {
    if (p.visits <= 0) return p.views > 0 ? 0.15 : 0;
    const t = maxVisits > 0 ? Math.log1p(p.visits) / Math.log1p(maxVisits) : 0;
    return 0.15 + 0.75 * t;
  }, [maxVisits]);

  // ---------- environment ----------
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
    const apply = (w: number, h: number) => setSize({ w: Math.max(200, Math.floor(w)), h: Math.max(200, Math.floor(h)) });
    const r = el.getBoundingClientRect();
    apply(r.width || 600, r.height || 360);
    const ro = new ResizeObserver((entries) => { for (const e of entries) apply(e.contentRect.width, e.contentRect.height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Touch: parked (page scrolls, taps still pick countries); wheel zoom only while hovered/focused.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready) return;
    const c = g.controls();
    c.touches.ONE = coarse ? null : THREE.TOUCH.ROTATE;
    c.touches.TWO = coarse ? null : THREE.TOUCH.DOLLY_PAN;
    c.enableZoom = !coarse && zoomHot;
    const canvas = c.domElement as HTMLElement | null;
    if (canvas) canvas.style.touchAction = coarse ? "pan-y" : "none";
  }, [ready, coarse, zoomHot]);

  // Report readiness (and which codes have a polygon) once.
  useEffect(() => {
    if (!ready || polys.length === 0 || reportedRef.current) return;
    reportedRef.current = true;
    onReady(new Set(polyByCode.keys()));
  }, [ready, polys.length, polyByCode, onReady]);

  // ---------- camera ----------
  const flyTo = useCallback((p: Poly) => {
    const g = globeRef.current;
    if (!g) return;
    const altitude = Math.min(2.0, Math.max(0.95, 0.55 + p.extent / 45));
    g.pointOfView({ lat: p.lat, lng: p.lng, altitude }, reduceMotion ? 0 : 1100);
  }, [reduceMotion]);

  const flyHome = useCallback(() => {
    globeRef.current?.pointOfView({ ...homeRef.current, altitude: HOME_ALT }, reduceMotion ? 0 : 1100);
  }, [reduceMotion]);

  useEffect(() => {
    if (!ready) return;
    const prev = prevFocusRef.current;
    prevFocusRef.current = focus;
    if (focus === prev) return;
    const p = focus ? polyByCode.get(focus) : undefined;
    if (p) flyTo(p);
    else if (prev) flyHome();
  }, [focus, ready, polyByCode, flyTo, flyHome]);

  // globe.gl can report "ready" while react-kapsule is still mounting — before
  // the ref is attached — so the callback only flags it; the scene is set up
  // in an effect once the ref exists. A stable callback also keeps globe.gl
  // from re-registering it on every render.
  const [glReady, setGlReady] = useState(false);
  const onGlobeReady = useCallback(() => setGlReady(true), []);
  const setupDoneRef = useRef(false);

  const configure = useCallback((g: GlobeMethods) => {
    const controls = g.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.7;
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 420;
    controls.autoRotate = false;

    const renderer = g.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.addEventListener("webglcontextlost", () => onUnavailable(), { once: true });

    const scene = g.scene();
    const camera = g.camera();
    const key = new THREE.DirectionalLight(color3(pal.light), 0.45);
    key.position.set(-1.2, 1.4, 1.6);
    camera.add(key);
    scene.add(camera);
    g.lights([
      new THREE.AmbientLight(color3(pal.light), 0.8),
      new THREE.HemisphereLight(color3(pal.lightSky), color3(pal.lightGround), 0.65),
    ]);

    // Arrival: drift in from the west onto the visits-weighted centre (instant under reduced motion).
    const h = homeRef.current;
    if (reduceMotion) {
      g.pointOfView({ ...h, altitude: HOME_ALT }, 0);
    } else {
      g.pointOfView({ lat: h.lat, lng: h.lng - 40, altitude: HOME_ALT + 0.5 }, 0);
      g.pointOfView({ ...h, altitude: HOME_ALT }, 1600);
    }
  }, [pal, reduceMotion, onUnavailable]);

  useEffect(() => {
    if (!glReady || setupDoneRef.current) return;
    let raf = 0;
    const init = () => {
      const g = globeRef.current;
      if (!g) { raf = requestAnimationFrame(init); return; }
      setupDoneRef.current = true;
      configure(g);
      setReady(true);
    };
    init();
    return () => cancelAnimationFrame(raf);
  }, [glReady, configure]);

  const nudge = useCallback((dLat: number, dLng: number) => {
    const g = globeRef.current;
    if (!g) return;
    const pov = g.pointOfView();
    g.pointOfView({
      lat: Math.max(-85, Math.min(85, pov.lat + dLat)),
      lng: ((((pov.lng + dLng + 180) % 360) + 360) % 360) - 180,
      altitude: pov.altitude,
    }, reduceMotion ? 0 : 240);
  }, [reduceMotion]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // buttons inside handle their own keys
    const step = e.shiftKey ? NUDGE_DEG_FAST : NUDGE_DEG;
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); nudge(0, -step); break;
      case "ArrowRight": e.preventDefault(); nudge(0, step); break;
      case "ArrowUp": e.preventDefault(); nudge(step, 0); break;
      case "ArrowDown": e.preventDefault(); nudge(-step, 0); break;
      default: break;
    }
  }, [nudge]);

  const resetView = useCallback(() => {
    if (focus) onFocusChange(null); // the focus effect flies home
    else flyHome();
  }, [focus, onFocusChange, flyHome]);

  // ---------- accessors (object-typed to satisfy globe.gl's generics) ----------
  const capColor = useCallback((obj: object) => {
    const p = obj as Poly;
    if (p.code && p.code === focus) return rgb(mix(fillFor(0.9), pal.ink, 0.3));
    const base = fillFor(alphaFor(p));
    return rgb(p === hover ? mix(base, pal.ink, 0.18) : base);
  }, [focus, hover, fillFor, alphaFor, pal]);

  const strokeColor = useCallback((obj: object) => {
    const p = obj as Poly;
    if (p.code && p.code === focus) return rgba(pal.ink, 0.95);
    if (p.visits > 0 || p.views > 0) return rgba(mix(pal.accent, pal.ink, 0.35), 0.9);
    return rgba(pal.graticule, 0.3);
  }, [focus, pal]);

  const altitude = useCallback((obj: object) => {
    const p = obj as Poly;
    if (p.code && p.code === focus) return 0.026;
    return p === hover ? 0.014 : 0.006;
  }, [focus, hover]);

  const label = useCallback((obj: object) => {
    const p = obj as Poly;
    return escapeHtml(o("globeTooltip", {
      country: p.name,
      visits: countPhrase(o, locale, p.visits, "Visits", nf),
      views: countPhrase(o, locale, p.views, "Views", nf),
    }));
  }, [o, nf]);

  const onPolygonClick = useCallback((obj: object) => {
    const p = obj as Poly;
    if (!p.code || (p.visits <= 0 && p.views <= 0)) return; // nothing to show for it
    onFocusChange(p.code === focus ? null : p.code);
  }, [focus, onFocusChange]);

  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: color3(pal.ocean),
    emissive: color3(pal.oceanDeep),
    emissiveIntensity: 0.25,
    shininess: 14,
    specular: color3(pal.oceanSpec),
  }), [pal]);

  const focusedPoly = focus ? polyByCode.get(focus) ?? null : null;
  const withTraffic = countries.filter((c) => c.code !== "XX" && (c.visits > 0 || c.views > 0)).length;
  const keysHintId = `${baseId}-keys`;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={o("globeAria", { countries: countPhrase(o, locale, withTraffic, "Countries", nf) })}
      aria-describedby={keysHintId}
      onKeyDown={onKeyDown}
      onFocus={() => setZoomHot(true)}
      onBlur={() => setZoomHot(false)}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") setZoomHot(true); }}
      onPointerLeave={() => setZoomHot(false)}
      className="globe-stage absolute inset-0 overflow-hidden rounded-card ring-1 ring-ink-1/10
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
      style={{ touchAction: coarse ? "pan-y" : undefined }}
    >
      <span id={keysHintId} className="sr-only">{o("globeKeys")}</span>
      {size.w > 0 && features && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor={clear}
          rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onGlobeReady={onGlobeReady}
          showAtmosphere
          atmosphereColor={rgb(pal.atmosphere)}
          atmosphereAltitude={0.16}
          globeImageUrl={null as unknown as string}
          globeMaterial={globeMaterial}
          polygonsData={polys}
          polygonGeoJsonGeometry="geometry"
          polygonAltitude={altitude}
          polygonCapColor={capColor}
          polygonSideColor={() => clear}
          polygonStrokeColor={strokeColor}
          polygonLabel={label}
          onPolygonHover={(obj: object | null) => setHover((obj as Poly | null) ?? null)}
          onPolygonClick={onPolygonClick}
          polygonsTransitionDuration={reduceMotion ? 0 : 250}
          showPointerCursor={(type: string, obj: object) => {
            if (type !== "polygon" || !obj) return false;
            const p = obj as Poly;
            return !!p.code && (p.visits > 0 || p.views > 0);
          }}
        />
      )}

      {!ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
          <div className="w-36 h-36 rounded-full bg-brand-glow/10 ring-1 ring-brand-glow/20 animate-pulse motion-reduce:animate-none" />
        </div>
      )}

      {/* Focused country summary */}
      {focusedPoly && (
        <div className="globe-hud absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-control px-3 py-2 pointer-events-none">
          <div className="globe-ink-1 text-xs font-bold tracking-tight truncate">{focusedPoly.name}</div>
          <dl className="mt-1 flex gap-4">
            <div>
              <dt className="globe-ink-2 text-2xs uppercase tracking-[0.1em]">{o("statVisits")}</dt>
              <dd className="globe-ink-info num text-sm font-semibold">{nf(focusedPoly.visits)}</dd>
            </div>
            <div>
              <dt className="globe-ink-2 text-2xs uppercase tracking-[0.1em]">{o("statViews")}</dt>
              <dd className="globe-ink-info num text-sm font-semibold">{nf(focusedPoly.views)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="absolute top-3 right-3">
        <button
          type="button"
          className="globe-btn"
          title={o("globeReset")}
          aria-label={o("globeReset")}
          onClick={resetView}
        >
          <Icon.RotateCcw size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* Scale legend */}
      {maxVisits > 0 && (
        <div className="globe-hud absolute left-3 bottom-3 rounded-control px-2.5 py-2 pointer-events-none" aria-hidden>
          <div className="globe-ink-2 text-2xs uppercase tracking-[0.12em]">{o("statVisits")}</div>
          <div
            className="mt-1 h-1.5 w-28 rounded-pill"
            style={{ background: `linear-gradient(90deg, ${rgb(fillFor(0.15))}, ${rgb(fillFor(0.9))})` }}
          />
          <div className="globe-ink-2 mt-0.5 flex justify-between text-2xs num">
            <span>1</span>
            <span>{nf(maxVisits)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
