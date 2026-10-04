"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type TrafficGlobe from "./TrafficGlobe";

/**
 * Defers the visitor globe (three.js + react-globe.gl, the heaviest chunk on
 * the page) until after the Traffic tab paints. GeoExplorer reserves the
 * stage height; WebGL failure is reported back so the page falls back to the
 * Countries list alone.
 */
const LazyGlobe = dynamic(() => import("./TrafficGlobe"), {
  ssr: false,
  loading: () => <div className="h-56" aria-hidden />,
});

export default function TrafficGlobeLazy(props: ComponentProps<typeof TrafficGlobe>) {
  return <LazyGlobe {...props} />;
}
