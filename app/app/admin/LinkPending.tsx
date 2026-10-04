"use client";

import type { ReactNode } from "react";
import { useLinkStatus } from "next/link";

/**
 * Child of a <Link> that pulses while that link's navigation is pending.
 * Admin range/filter links only change search params, so Next keeps the old
 * page on screen and loading.tsx never shows — without this, a click on
 * "7 days" or "Resolved" gives no feedback until the server answers.
 * No layout change (opacity/pulse only); still under reduced motion.
 */
export default function LinkPending({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`inline-flex items-center gap-1.5 transition-opacity motion-reduce:transition-none ${pending ? "opacity-60 animate-pulse motion-reduce:animate-none" : ""}`}
      aria-busy={pending || undefined}
    >
      {children}
    </span>
  );
}
