"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type TrafficFlow from "./TrafficFlow";

/**
 * Defers the arrivals Sankey (recharts) until after the Traffic tab paints.
 * FlowExplorer reserves the diagram's height, so nothing shifts when it lands.
 */
const LazyFlow = dynamic(() => import("./TrafficFlow"), {
  ssr: false,
  loading: () => <div className="h-56" aria-hidden />,
});

export default function TrafficFlowLazy(props: ComponentProps<typeof TrafficFlow>) {
  return <LazyFlow {...props} />;
}
