"use client";

import Link from "next/link";
import {
  useCallback, useEffect, useId, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Icon } from "@/components/ui";
import { makeT, type Locale } from "@/lib/i18n";

/**
 * Header user-account dropdown: avatar/initial chip → menu with Settings,
 * Billing and Sign out.
 *
 * The sign-out action is passed in as a prop (server action ref) so we can
 * keep this component "use client" without importing server-only modules.
 * Click-outside + Escape close the menu; ArrowUp/Down/Home/End move focus
 * between items; focus returns to the trigger when the menu closes via the
 * keyboard.
 */

type Strings = { en: string; ko: string; zh: string; es: string };
const STR: Record<"account" | "accountMenu" | "billing", Strings> = {
  account:     { en: "Account",      ko: "계정",      zh: "账户",     es: "Cuenta" },
  accountMenu: { en: "Account menu", ko: "계정 메뉴", zh: "账户菜单", es: "Menú de cuenta" },
  billing:     { en: "Billing",      ko: "결제",      zh: "账单",     es: "Facturación" },
};

const TRIGGER =
  "inline-flex h-9 items-center gap-2 rounded-control px-2.5 text-xs text-white/85 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-inverse";

const ITEM =
  "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-1 text-left cursor-pointer transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2";

export default function UserMenu({
  email, avatarUrl = null, locale, signOutAction,
}: {
  email: string;
  avatarUrl?: string | null;
  locale: Locale;
  signOutAction: () => Promise<void>;
}) {
  const t = makeT(locale);
  const s = (k: keyof typeof STR) => STR[k][locale] ?? STR[k].en;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }, []);

  // Close on outside click + Escape so the menu feels native.
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

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function onMenuKeys(e: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
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

  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeys}
        className={TRIGGER}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={s("accountMenu")}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
        ) : (
          <span
            aria-hidden
            className="w-6 h-6 rounded-full bg-gradient-cyan text-2xs font-bold text-white grid place-items-center shrink-0"
          >
            {initial}
          </span>
        )}
        <span className="hidden sm:inline max-w-[180px] truncate font-medium">{email}</span>
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
          aria-label={s("accountMenu")}
          onKeyDown={onMenuKeys}
          className="absolute right-0 mt-2 w-56 bg-surface text-ink-1 rounded-card shadow-pop border border-border py-1 z-50 animate-fade-up overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <div className="text-2xs uppercase tracking-[0.08em] text-ink-3 font-semibold">{s("account")}</div>
            <div className="text-xs text-ink-1 font-medium truncate mt-0.5">{email}</div>
          </div>

          <Link href="/app/settings" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
            <Icon.Settings size={16} strokeWidth={1.75} aria-hidden className="text-ink-2" />
            {t("nav.settings")}
          </Link>
          <Link href="/app/billing" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={ITEM}>
            <Icon.CreditCard size={16} strokeWidth={1.75} aria-hidden className="text-ink-2" />
            {s("billing")}
          </Link>

          <div role="separator" className="my-1 border-t border-border" />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              tabIndex={-1}
              className={`${ITEM} hover:bg-bad/10 hover:text-bad focus-visible:bg-bad/10 focus-visible:text-bad`}
            >
              <Icon.LogOut size={16} strokeWidth={1.75} aria-hidden />
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
