"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Animated number. The SERVER renders the real value (no "0.0" flash, correct
 * in print/reader mode); on the client it tweens from 85% of the value to the
 * value over --dur-slow with an ease-out curve. Under prefers-reduced-motion
 * it stays static. All instances share one requestAnimationFrame loop.
 */
export function CountUp({
  value, duration = 500, decimals = 1, prefix = "", suffix = "",
}: {
  value: number; duration?: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(value);

  useEffect(() => {
    if (reduce) { setN(value); return; }
    const from = value * 0.85;
    const start = performance.now();
    const unsubscribe = ticker.subscribe((now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (value - from) * eased);
      return p < 1; // keep ticking while true
    });
    return unsubscribe;
  }, [value, duration, reduce]);

  return <span className="num">{prefix}{n.toFixed(decimals)}{suffix}</span>;
}

// ---- shared rAF ticker: N counters, one animation frame ----
type Sub = (now: number) => boolean;
const ticker = (() => {
  const subs = new Set<Sub>();
  let raf = 0;
  const loop = (now: number) => {
    for (const s of subs) if (!s(now)) subs.delete(s);
    raf = subs.size ? requestAnimationFrame(loop) : 0;
  };
  return {
    subscribe(fn: Sub) {
      subs.add(fn);
      if (!raf) raf = requestAnimationFrame(loop);
      return () => { subs.delete(fn); };
    },
  };
})();
