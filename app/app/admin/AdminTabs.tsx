"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon, Pill } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { adminStrings, type AdminStringKey } from "./admin-strings";

type Tab = { href: string; label: AdminStringKey; icon: LucideIcon; exact?: boolean };

const TABS: readonly Tab[] = [
  // Users lives at the bare /app/admin, so it must match exactly or it would
  // light up on every other tab too.
  { href: "/app/admin", label: "tabUsers", icon: Icon.Users, exact: true },
  { href: "/app/admin/support", label: "tabSupport", icon: Icon.Inbox },
  { href: "/app/admin/traffic", label: "tabTraffic", icon: Icon.Activity },
  { href: "/app/admin/maintenance", label: "tabMaintenance", icon: Icon.Wrench },
];

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
}

/** Width of the edge fade that hints at more tabs off-screen. */
const FADE = "1.5rem";

function fadeMask(start: boolean, end: boolean): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const from = start ? `transparent, black ${FADE}` : "black";
  const to = end ? `black calc(100% - ${FADE}), transparent` : "black";
  const image = `linear-gradient(to right, ${from}, ${to})`;
  return { maskImage: image, WebkitMaskImage: image };
}

/**
 * Admin section tabs: Users | Support | Traffic | Maintenance.
 *
 * Real links (each section is its own route with its own gate and data), so
 * this is a <nav> with aria-current, not an ARIA tablist. Support carries the
 * open-request count; Maintenance a warn dot when the nightly clean-up is
 * overdue. Both have screen-reader text — the visual badge is aria-hidden.
 *
 * At phone width the strip scrolls sideways instead of overflowing the page:
 * icons drop below `sm`, the active tab is kept in view, and the edges fade
 * while more tabs are off-screen.
 */
export default function AdminTabs({
  locale, openSupport, maintenanceAttention,
}: {
  locale: Locale;
  openSupport: number;
  maintenanceAttention: boolean;
}) {
  const s = useMemo(() => adminStrings(locale), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pathname = usePathname() ?? "";
  const reduce = useReducedMotion();
  const stripRef = useRef<HTMLUListElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { start: max > 1 && el.scrollLeft > 1, end: max > 1 && el.scrollLeft < max - 1 };
    setFade((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  // Re-measure when the strip resizes (viewport) or any tab does (locale,
  // badge appearing, font swap) — the strip's own box doesn't change then.
  useLayoutEffect(() => {
    measure();
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure]);

  // Keep the active tab visible in the scrolling (phone) strip.
  useEffect(() => {
    const el = stripRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, left - 16), behavior: reduce ? "auto" : "smooth" });
    }
  }, [pathname, reduce]);

  return (
    <nav aria-label={s("tabsLabel")} className="border-b border-border">
      <ul
        ref={stripRef}
        onScroll={measure}
        style={fadeMask(fade.start, fade.end)}
        className="relative flex items-stretch gap-0.5 sm:gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => {
          const active = isActive(tab, pathname);
          const Cmp = tab.icon;
          const showBadge = tab.label === "tabSupport" && openSupport > 0;
          const showDot = tab.label === "tabMaintenance" && maintenanceAttention;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex h-11 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap rounded-t-control cursor-pointer select-none
                  transition-colors duration-fast motion-reduce:transition-none
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60
                  ${active ? "text-ink-1" : "text-ink-3 hover:text-ink-1"}`}
              >
                <Cmp size={16} strokeWidth={1.75} aria-hidden className="hidden sm:block shrink-0" />
                <span>{s(tab.label)}</span>
                {showBadge && (
                  <>
                    <Pill variant="warn" className="num">
                      <span aria-hidden>{openSupport > 99 ? `${nf.format(99)}+` : nf.format(openSupport)}</span>
                    </Pill>
                    <span className="sr-only">{" "}{s("tabOpenBadge", { n: nf.format(openSupport) })}</span>
                  </>
                )}
                {showDot && (
                  <>
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warn ring-2 ring-warn/25" />
                    <span className="sr-only">{" "}{s("tabNeedsAttention")}</span>
                  </>
                )}
                {active && (
                  <span aria-hidden className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
