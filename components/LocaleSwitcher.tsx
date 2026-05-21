"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/actions/set-locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

/**
 * Dropdown locale picker. Trigger shows the current language as a flag +
 * short code; the menu lists all locales with full names so the user always
 * recognises their language.
 *
 * Click flow:
 *   1. Set the `logbookhq.locale` cookie via a Server Action.
 *   2. router.refresh() re-renders every Server Component with the new
 *      cookie value, keeping any in-progress form state intact (a full
 *      window.location.reload would drop unsaved input).
 */
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside + Escape to close, same UX as UserMenu.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(code: Locale) {
    setOpen(false);
    if (code === current) return;
    startTransition(async () => {
      await setLocaleAction(code);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-sky-100/80 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-all border border-white/10 hover:border-white/20"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language"
      >
        <span className="text-sm leading-none">{FLAG[current]}</span>
        <span className="font-medium">{SHORT_LABEL[current]}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-xl ring-1 ring-slate-900/10 overflow-hidden py-1 z-50 animate-fade-up"
        >
          {LOCALES.map((code) => {
            const isActive = code === current;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => pick(code)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? "bg-sky-50 text-sky-700 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-base leading-none">{FLAG[code]}</span>
                <span className="flex-1">{LOCALE_LABELS[code]}</span>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Compact label shown on the trigger after the flag. */
const SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  ko: "KO",
  zh: "ZH",
  es: "ES",
};

/** Country-flag emoji for each locale. Picks the most-recognisable flag for
 *  the language's largest user base (US for English, mainland China for
 *  Simplified Chinese, Spain for Spanish, Korea for Korean). */
const FLAG: Record<Locale, string> = {
  en: "🇺🇸",
  ko: "🇰🇷",
  zh: "🇨🇳",
  es: "🇪🇸",
};
