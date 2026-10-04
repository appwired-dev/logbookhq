"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type TrafficChart from "./TrafficChart";

/**
 * Client boundary that defers the daily chart (and recharts) until after the
 * Traffic tab paints — the page is a Server Component, so it cannot call
 * `dynamic(..., { ssr: false })` itself (same pattern as
 * components/AircraftRoleSankeyLazy.tsx). The parent reserves the height.
 */
const LazyChart = dynamic(() => import("./TrafficChart"), {
  ssr: false,
  loading: () => <div className="h-56" aria-hidden />,
});

export default function TrafficChartLazy(props: ComponentProps<typeof TrafficChart>) {
  return <LazyChart {...props} />;
}
