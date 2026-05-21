"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { Airport } from "@/lib/airports";

/**
 * Vector globe — three colours (ocean, land, borders) rendered from a small
 * world-countries GeoJSON. ~30 KB gzipped vs ~1.7 MB for satellite textures.
 */
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface Arc {
  startLat: number; startLng: number;
  endLat: number;   endLng: number;
  label: string;
  count: number;
}

export interface GlobeProps {
  airports: Record<string, Airport>;
  arcs: Array<{ from: string; to: string; count: number }>;
  year: string;
}

// Palette.
const OCEAN = "#143d75";          // deep ocean blue — fills the globe sphere
const SPACE = "#2a3340";          // soft dark slate background around the globe
const LAND = "#4a7c59";           // warm forest green — readable, atlas-style
const BORDER = "#c4ddb2";         // soft sage outline for separation
const POINT = "#0b0b0b";          // black airport dots

export default function FlightGlobe({ airports, arcs: rawArcs, year }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  const [countries, setCountries] = useState<any[]>([]);
  /**
   * Camera altitude in globe units. Default initial framing puts the camera
   * at 2.2. As the user zooms in (altitude → 0), we shrink point radius and
   * arc stroke so they don't cover the visible feature.
   */
  const [altitude, setAltitude] = useState(2.2);

  // Load country polygons once.
  useEffect(() => {
    fetch("/world-countries.json")
      .then((r) => r.json())
      .then((data) => setCountries(data.features ?? []))
      .catch(() => setCountries([]));
  }, []);

  // Responsive sizing.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(300, Math.floor(e.contentRect.width));
        setSize({ w, h: Math.min(600, Math.max(400, Math.round(w * 0.7))) });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Configure controls + cinematic initial framing.
  useEffect(() => {
    if (!globeRef.current) return;
    const c = globeRef.current;
    const controls = c.controls?.();
    if (controls) {
      controls.autoRotate = false;
      controls.enableDamping = true;
    }
    const points = Object.values(airports);
    if (points.length > 0) {
      const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const avgLng = points.reduce((s, p) => s + p.lon, 0) / points.length;
      c.pointOfView({ lat: avgLat, lng: avgLng, altitude: 2.2 }, 1500);
    }
  }, [airports, countries.length]);

  const arcs: Arc[] = useMemo(() => {
    const out: Arc[] = [];
    for (const { from, to, count } of rawArcs) {
      const a = airports[from];
      const b = airports[to];
      if (!a || !b) continue;
      out.push({
        startLat: a.lat, startLng: a.lon,
        endLat: b.lat,   endLng: b.lon,
        label: `${from} → ${to} · ${count} flight${count === 1 ? "" : "s"}`,
        count,
      });
    }
    return out;
  }, [airports, rawArcs]);

  const points = useMemo(() => {
    return Object.entries(airports).map(([code, a]) => ({
      lat: a.lat, lng: a.lon, code, name: a.name,
    }));
  }, [airports]);

  const maxCount = useMemo(() => Math.max(1, ...arcs.map((a) => a.count)), [arcs]);

  if (arcs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No flights with parsable routes in {year} yet.
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl" style={{ background: SPACE }}>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        showGlobe={true}
        showAtmosphere={true}
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.15}
        globeImageUrl={null as any}
        /* Override the default Phong material with a flat blue material so the
           sphere reads as uniform ocean colour — no day/night terminator. */
        globeMaterial={new THREE.MeshBasicMaterial({ color: OCEAN })}

        polygonsData={countries}
        polygonAltitude={0.005}
        polygonCapColor={() => LAND}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={() => BORDER}
        polygonLabel={(d: any) => d.properties?.name ?? ""}

        arcsData={arcs}
        arcStartLat={(d: any) => d.startLat}
        arcStartLng={(d: any) => d.startLng}
        arcEndLat={(d: any) => d.endLat}
        arcEndLng={(d: any) => d.endLng}
        arcColor={(d: any) => {
          const intensity = Math.min(1, d.count / maxCount);
          const alpha = 0.55 + 0.45 * intensity;
          // Amber gradient — pale gold → deep amber along the arc.
          return [`rgba(253, 224, 71, ${alpha})`, `rgba(217, 119, 6, ${alpha})`];
        }}
        arcStroke={(d: any) => {
          // Scale with zoom so arcs don't dominate when zoomed in.
          const base = 0.3 + 0.7 * (d.count / maxCount);
          const zoomScale = Math.min(1, Math.max(0.35, altitude / 2.2));
          return base * zoomScale;
        }}
        arcDashLength={0.4}
        arcDashGap={0.15}
        arcDashAnimateTime={3500}
        arcLabel={(d: any) => d.label}
        arcAltitudeAutoScale={0.5}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.005}
        /* Scale point radius with camera altitude: smaller dots when zoomed in
           so they don't cover the city/airport feature. Clamp to a sane range. */
        pointRadius={Math.max(0.05, Math.min(0.3, 0.14 * altitude))}
        pointColor={() => POINT}
        pointLabel={(d: any) => `${d.code} — ${d.name}`}

        onZoom={(pov: { altitude: number }) => setAltitude(pov.altitude)}
      />

      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/55 backdrop-blur text-white text-xs">
        <div className="font-bold tracking-tight">{year} flights</div>
        <div className="text-emerald-200/80 text-[10px] uppercase tracking-wider">
          {arcs.length.toLocaleString()} routes · {Object.keys(airports).length.toLocaleString()} airports
        </div>
      </div>
    </div>
  );
}
