"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number counter. Ticks from 0 to `value` over `duration` ms when
 * the component mounts. Uses requestAnimationFrame with an easeOutCubic curve
 * so the number decelerates as it approaches the target — feels natural, not
 * mechanical.
 *
 * Props:
 *   - value: target number
 *   - duration: total animation time in ms (default 900)
 *   - decimals: digits after decimal point (default 1)
 *   - prefix/suffix: optional string wrapping the number
 */
export function CountUp({
  value, duration = 900, decimals = 1, prefix = "", suffix = "",
}: {
  value: number; duration?: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const [n, setN] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (startedAt.current === null) startedAt.current = t;
      const elapsed = t - startedAt.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setN(eased * value);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {prefix}{n.toFixed(decimals)}{suffix}
    </span>
  );
}
