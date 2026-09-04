"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Icon } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { Locale } from "@/lib/i18n";

/**
 * Primary app navigation.
 *
 *  - md and up: a horizontal tab strip inside the header with a sliding
 *    active indicator (measured with refs, animated via left/width).
 *  - below md: the strip is hidden and a fixed bottom bar renders instead —
 *    Dashboard · Flights · [New flight] · Charts · More. "More" opens a small
 *    dark sheet above the bar with the remaining destinations.
 *
 * Icons arrive as string names (this is a client component receiving props
 * across the server boundary) and are mapped to `Icon.*` here.
 */
export type NavItem = {
  href: string;
  label: string;
  /** Name of an export in components/ui/icons, e.g. "LayoutDashboard". */
  icon: string;
  /** Match only the exact path (used by the dashboard root). */
  exact?: boolean;
  /** Extra path prefixes that count as "this tab" (e.g. legacy import/export). */
  also?: string[];
  /** 'accent' tabs (Admin) read amber when inactive. */
  tone?: "accent";
};

type Strings = { en: string; ko: string; zh: string; es: string };
const STR: Record<"more" | "primaryNav" | "morePages", Strings> = {
  more:       { en: "More",       ko: "더보기",   zh: "更多",   es: "Más" },
  primaryNav: { en: "Primary",    ko: "주 메뉴",  zh: "主导航", es: "Principal" },
  morePages:  { en: "More pages", ko: "더 많은 페이지", zh: "更多页面", es: "Más páginas" },
};

const ICONS = Icon as unknown as Record<string, LucideIcon | undefined>;
function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Icon.Ellipsis;
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return (
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    (item.also ?? []).some((p) => pathname.startsWith(p))
  );
}

/** "+ New Flight" → "New Flight" (the button already carries a Plus icon). */
const stripPlus = (s: string) => s.replace(/^\+\s*/, "");

const FOCUS_RING_INVERSE =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-inverse";

export default function NavTabs({
  items, newFlight, locale = "en",
}: {
  items: NavItem[];
  newFlight: { href: string; label: string };
  locale?: Locale;
}) {
  const pathname = usePathname() ?? "";
  const reduce = useReducedMotion();
  const s = (k: keyof typeof STR) => STR[k][locale] ?? STR[k].en;

  return (
    <>
      <DesktopStrip items={items} pathname={pathname} reduce={reduce} label={s("primaryNav")} />
      <BottomBar
        items={items}
        newFlight={newFlight}
        pathname={pathname}
        labels={{ nav: s("primaryNav"), more: s("more"), morePages: s("morePages") }}
      />
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Desktop / tablet strip                                                    */
/* ------------------------------------------------------------------------ */

function DesktopStrip({
  items, pathname, reduce, label,
}: {
  items: NavItem[];
  pathname: string;
  reduce: boolean;
  label: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  const activeHref = items.find((i) => isActive(i, pathname))?.href ?? null;

  const measure = useCallback(() => {
    const el = activeHref ? tabRefs.current.get(activeHref) : undefined;
    if (!el) {
      setBar(null);
      return;
    }
    setBar((prev) => {
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      return prev && prev.left === next.left && prev.width === next.width ? prev : next;
    });
  }, [activeHref]);

  // Measure on mount / active change, and re-measure whenever the strip or a
  // tab changes size (font swap, viewport resize, locale change).
  useLayoutEffect(() => {
    measure();
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(strip);
    for (const el of tabRefs.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // In the compact (md–lg) scrolling strip, keep the active tab in view.
  useEffect(() => {
    const strip = stripRef.current;
    const el = activeHref ? tabRefs.current.get(activeHref) : undefined;
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    const viewL = strip.scrollLeft;
    const viewR = viewL + strip.clientWidth;
    if (left < viewL || right > viewR) {
      strip.scrollTo({ left: left - 16, behavior: reduce ? "auto" : "smooth" });
    }
  }, [activeHref, reduce]);

  return (
    <nav aria-label={label} className="hidden md:block min-w-0 flex-1 self-stretch">
      <div
        ref={stripRef}
        className="relative flex h-16 items-center gap-0.5 lg:gap-1 px-1 overflow-x-auto lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = isActive(item, pathname);
          const Cmp = iconFor(item.icon);
          const colour = active
            ? "text-white"
            : item.tone === "accent"
              ? "text-warn hover:bg-white/10"
              : "text-white/70 hover:text-white hover:bg-white/10";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              ref={(el) => {
                if (el) tabRefs.current.set(item.href, el);
                else tabRefs.current.delete(item.href);
              }}
              className={`relative inline-flex h-9 shrink-0 items-center gap-2 rounded-control px-2.5 lg:px-3 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors duration-fast ${FOCUS_RING_INVERSE} ${colour}`}
            >
              <Cmp size={16} strokeWidth={1.75} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {bar && (
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-brand-glow ${
              reduce ? "" : "transition-[left,width] duration-med ease-out"
            }`}
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------------ */
/* Phone bottom bar                                                          */
/* ------------------------------------------------------------------------ */

const SLOT =
  "relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-control cursor-pointer select-none transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70";

function ActiveDot() {
  return <span aria-hidden className="absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-glow" />;
}

function Slot({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(item, pathname);
  const Cmp = iconFor(item.icon);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${SLOT} ${active ? "text-white" : "text-white/60 hover:text-white"}`}
    >
      {active && <ActiveDot />}
      <Cmp size={20} strokeWidth={1.75} aria-hidden />
      <span className="text-2xs font-medium leading-none">{item.label}</span>
    </Link>
  );
}

function BottomBar({
  items, newFlight, pathname, labels,
}: {
  items: NavItem[];
  newFlight: { href: string; label: string };
  pathname: string;
  labels: { nav: string; more: string; morePages: string };
}) {
  const primary = items.slice(0, 3); // Dashboard, Flights, Charts
  const more = items.slice(3);       // Documents, Import & Export, Settings, Admin
  const moreActive = more.some((i) => isActive(i, pathname));

  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }, []);

  // Route change closes the sheet.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (sheetRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Focus the first item when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const first = sheetRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  function onSheetKeys(e: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!nodes.length) return;
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (idx + 1) % nodes.length;
    else if (e.key === "ArrowUp") next = (idx - 1 + nodes.length) % nodes.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = nodes.length - 1;
    else if (e.key === "Tab") { setOpen(false); return; }
    if (next >= 0) {
      e.preventDefault();
      nodes[next].focus();
    }
  }

  return (
    <nav
      aria-label={labels.nav}
      className="fixed inset-x-0 bottom-0 z-30 md:hidden bg-surface-inverse/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      {open && (
        <div
          id={sheetId}
          ref={sheetRef}
          role="menu"
          aria-label={labels.morePages}
          onKeyDown={onSheetKeys}
          className="absolute bottom-full right-2 mb-2 w-56 rounded-card border border-white/10 bg-surface-inverse text-white p-2 shadow-pop animate-fade-up"
        >
          {more.map((item) => {
            const active = isActive(item, pathname);
            const Cmp = iconFor(item.icon);
            const colour = active
              ? "bg-white/10 text-white"
              : item.tone === "accent"
                ? "text-warn hover:bg-white/10"
                : "text-white/85 hover:bg-white/10 hover:text-white";
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:bg-white/10 focus-visible:text-white ${colour}`}
              >
                <Cmp size={16} strokeWidth={1.75} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-5 h-[var(--bottom-nav-h)]">
        {primary[0] && <Slot item={primary[0]} pathname={pathname} />}
        {primary[1] && <Slot item={primary[1]} pathname={pathname} />}

        <div className="flex items-center justify-center">
          <Link
            href={newFlight.href}
            aria-label={stripPlus(newFlight.label)}
            title={stripPlus(newFlight.label)}
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-aviation text-white shadow-glow ring-4 ring-surface-inverse cursor-pointer hover:brightness-110 active:scale-95 transition-[filter,transform] duration-fast focus-visible:outline-none focus-visible:ring-white/70"
          >
            <Icon.Plus size={24} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {primary[2] && <Slot item={primary[2]} pathname={pathname} />}

        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? sheetId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={`${SLOT} ${open || moreActive ? "text-white" : "text-white/60 hover:text-white"}`}
        >
          {moreActive && <ActiveDot />}
          <Icon.Ellipsis size={20} strokeWidth={1.75} aria-hidden />
          <span className="text-2xs font-medium leading-none">{labels.more}</span>
        </button>
      </div>
    </nav>
  );
}
