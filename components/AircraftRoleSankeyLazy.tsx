"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type AircraftRoleSankey from "./AircraftRoleSankey";

/**
 * Client boundary that defers the aircraft→role Sankey (and its recharts
 * dependency, ~91KB gzip) until after the dashboard paints. The dashboard is a
 * Server Component, so it can't use `dynamic(..., { ssr: false })` itself; this
 * thin "use client" wrapper can. The Sankey is the last card on the page, so a
 * height-reserving placeholder avoids layout shift.
 */
const LazySankey = dynamic(() => import("./AircraftRoleSankey"), {
  ssr: false,
  loading: () => <div className="min-h-[440px]" aria-hidden />,
});

export default function AircraftRoleSankeyLazy(props: ComponentProps<typeof AircraftRoleSankey>) {
  return <LazySankey {...props} />;
}
