"use client";

import { useEffect, useRef, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";

/**
 * Header user-account dropdown. Click the chip → menu opens with Sign Out.
 *
 * The sign-out action is passed in as a prop (server action ref) so we can
 * keep this component "use client" without importing server-only modules.
 * Click-outside + Escape close the menu, matching standard dropdown UX.
 */
export default function UserMenu({
  email, locale, signOutAction,
}: {
  email: string;
  locale: Locale;
  signOutAction: () => Promise<void>;
}) {
  const t = makeT(locale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape so the menu feels native.
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

  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-sky-100/80 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-all border border-white/10 hover:border-white/20"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-violet-400 text-[10px] font-bold text-white flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden sm:inline max-w-[180px] truncate font-medium">{email}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl ring-1 ring-slate-900/10 overflow-hidden py-1 z-50 animate-fade-up"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Account</div>
            <div className="text-xs text-slate-700 font-medium truncate mt-0.5">{email}</div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
