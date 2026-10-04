"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import {
  OPT_OUT_KEY,
  STATS_ENDPOINT,
  campaignParams,
  classifyReferrer,
  redactAnalyticsUrl,
  statPath,
} from "@/lib/site-stats-core";

/**
 * Site statistics, mounted once in the root layout (app/layout.tsx).
 *
 * 1. Vercel Analytics, with a beforeSend that redacts /share/<token>, drops the
 *    hash and every query key except utm_*, and sends nothing under Global
 *    Privacy Control, Do Not Track, browser automation or the visitor's own
 *    opt-out (components/StatsOptOut.tsx). This part is always on.
 * 2. First-party, cookieless page-view counts: one small beacon to /api/view
 *    per counted page view, stored server-side only as daily totals. Ships dark
 *    behind NEXT_PUBLIC_STATS_ENABLED (inlined at build time) and runs only in
 *    production builds.
 *
 * What leaves the browser toward our endpoint: the counted page name (never a
 * raw path, query or share token) and, on a landing only, the referrer's host,
 * a sanitised utm_source / ref token and a sanitised utm_campaign token. No
 * cookie, no storage write, no identifier. Disclosed in /privacy §1, §6, §7, §8.
 *
 * Only usePathname is read (no search-params hook), so static pages stay static
 * and no Suspense boundary is needed here. Prefetches and bfcache restores do
 * not run effects, so they are not counted; same-pathname updates (filters
 * that replaceState the query) do not re-send.
 */

/** The first page view after a hard load. Module scope, so soft navigations see `false`. */
let firstView = true;

/** Never count (or let Vercel count) this view. Re-read on every call so the opt-out applies without a reload. */
function blocked(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (n.globalPrivacyControl === true || n.doNotTrack === "1" || n.webdriver) return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false; // storage unavailable: the opt-out switch is disabled too, so no choice can have been recorded
  }
}

// Module scope = stable identity: the Analytics wrapper re-registers beforeSend whenever the prop changes.
const beforeSend: BeforeSend = (event) => (blocked() ? null : { ...event, url: redactAnalyticsUrl(event.url) });

function sendBeacon(body: Record<string, string | number>): void {
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.(STATS_ENDPOINT, json)) return;
  } catch {
    // fall through to fetch
  }
  // text/plain keeps it a simple request; keepalive lets it outlive a quick navigation away.
  fetch(STATS_ENDPOINT, { method: "POST", body: json, keepalive: true, headers: { "content-type": "text/plain" } })
    .catch(() => {});
}

export default function SiteStats() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATS_ENABLED !== "1") return; // ship dark
    // Production builds only; the ref also dedupes React strict-mode double effects.
    if (process.env.NODE_ENV !== "production" || !pathname || last.current === pathname) return;
    last.current = pathname;

    const isFirst = firstView;
    firstView = false; // consumed even when this view is not counted (e.g. a hard load inside /app)

    const page = statPath(pathname);
    if (!page || blocked()) return;

    const body: Record<string, string | number> = { p: page };
    if (isFirst) {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const ref = classifyReferrer(document.referrer, location.hostname);
      // A landing is an arrival from outside the site. Reloads and back/forward are not landings.
      if ((!nav || nav.type === "navigate" || nav.type === "prerender") && ref.kind !== "internal") {
        body.l = 1;
        if (ref.kind === "external") body.r = ref.host; // host only, never the full referrer URL
        const { source, campaign } = campaignParams(location.search);
        if (source) body.s = source;
        if (campaign) body.c = campaign;
      }
    }

    // A speculatively prerendered page runs effects before anyone sees it: wait for activation.
    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) document.addEventListener("prerenderingchange", () => sendBeacon(body), { once: true });
    else sendBeacon(body);
  }, [pathname]);

  return <Analytics beforeSend={beforeSend} />;
}
