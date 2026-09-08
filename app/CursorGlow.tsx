"use client";

import { useEffect, useRef } from "react";

/**
 * A soft light that eases toward the pointer and settles, adding depth to the
 * dark storefront. Rendered behind the tiles (z-index:-1 in globals.css). Pure
 * transform updates on a rAF loop that idles once the glow has caught up, so it
 * costs nothing when the mouse is still. Disabled for touch / reduced-motion.
 */
export default function CursorGlow({ className = "lp-cursor-glow" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let raf = 0;
    let shown = false;

    const tick = () => {
      // ease toward the pointer, then settle
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0; // settled — stop the loop until the next move
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!shown) {
        shown = true;
        x = targetX;
        y = targetY;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.classList.add("is-on");
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className={className} aria-hidden />;
}
