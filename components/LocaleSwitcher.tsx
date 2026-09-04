"use client";

import {
  useCallback, useEffect, useId, useRef, useState, useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/actions/set-locale";
import { Icon } from "@/components/ui";
import { LOCALES, LOCALE_LABELS, makeT, type Locale } from "@/lib/i18n";

/**
 * Dropdown locale picker. Trigger shows a Languages icon + two-letter code
 * chip; the menu lists all locales as code chip + full name so the user
 * always recognises their language.
 *
 * Click flow:
 *   1. Set the `logbookhq.locale` cookie via a Server Action.
 *   2. router.refresh() re-renders every Server Component with the new
 *      cookie value, keeping any in-progress form state intact (a full
 *      window.location.reload would drop unsaved input).
 */
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const t = makeT(current);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }, []);

  // Click-outside + Escape to close, same UX as UserMenu.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Focus the active locale when the menu opens (falls back to the first).
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const target =
      menu?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ??
      menu?.querySelector<HTMLElement>('[role="menuitemradio"]');
    target?.focus();
  }, [open]);

  function onMenuKeys(e: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
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

  function onTriggerKeys(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function pick(code: Locale) {
    close(true);
    if (code === current) return;
    startTransition(async () => {
      await setLocaleAction(code);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeys}
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-xs text-white/85 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-inverse"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t("common.language")}: ${LOCALE_LABELS[current]}`}
      >
        <Icon.Languages size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
        <span className="mono text-2xs font-semibold">{SHORT_LABEL[current]}</span>
        <Icon.ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 transition-transform duration-fast ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={t("common.language")}
          onKeyDown={onMenuKeys}
          className="absolute right-0 mt-2 w-48 bg-surface text-ink-1 rounded-card shadow-pop border border-border py-1 z-50 animate-fade-up overflow-hidden"
        >
          {LOCALES.map((code) => {
            const isActive = code === current;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={-1}
                lang={code}
                onClick={() => pick(code)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer transition-colors duration-fast focus-visible:outline-none ${
                  isActive
                    ? "bg-brand/10 text-brand font-medium focus-visible:bg-brand/15"
                    : "text-ink-1 hover:bg-surface-2 focus-visible:bg-surface-2"
                }`}
              >
                <span
                  className={`mono text-2xs font-semibold w-7 shrink-0 rounded-pill border px-1 py-0.5 text-center ${
                    isActive ? "border-brand/30 bg-brand/10 text-brand" : "border-border bg-surface-2 text-ink-2"
                  }`}
                >
                  {SHORT_LABEL[code]}
                </span>
                <span className="flex-1">{LOCALE_LABELS[code]}</span>
                {isActive && <Icon.Check size={16} strokeWidth={2.25} aria-hidden className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Two-letter code chip shown on the trigger and in the menu. */
const SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  ko: "KO",
  zh: "ZH",
  es: "ES",
};
