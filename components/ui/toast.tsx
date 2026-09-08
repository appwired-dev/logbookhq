"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type AnimationEvent as ReactAnimationEvent, type FocusEvent as ReactFocusEvent, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { buttonClass } from "./button-class";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "./icons";

/**
 * Toasts.
 *
 *   const toast = useToast();
 *   toast.push({ tone: "good", title: "Flight saved" });
 *
 * <ToastProvider> (mounted once, in app/app/layout.tsx) owns the queue and
 * portals a viewport into <body>:
 *   - at most 3 visible; a 4th pushes the oldest out;
 *   - `sm+`: fixed bottom-right, newest at the BOTTOM (nearest the corner);
 *     the bottom offset clears the tablet bottom nav until `md`;
 *   - phones (< sm): top-centre under the header, newest at the TOP, the
 *     stack capped so it never reaches the bottom nav;
 *   - auto-dismiss 5 s (8 s for `bad`; `durationMs` overrides, 0/Infinity =
 *     sticky), paused while hovered or focused;
 *   - announced through two persistent visually-hidden live regions (polite,
 *     assertive for `bad`) so screen readers hear every push, however the
 *     visual card is animated in.
 *
 * `useToast()` outside a provider logs once and no-ops instead of throwing.
 * The only built-in string (the dismiss label) follows `locale` if given,
 * else <html lang>, else English.
 */

export type ToastTone = "good" | "warn" | "bad" | "info";

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. Default 5000 (8000 for `bad`); 0 or Infinity keeps it until dismissed. */
  durationMs?: number;
  /** Optional inline action (e.g. Undo). Clicking it also dismisses the toast. */
  action?: { label: string; onClick: () => void };
}

export interface ToastApi {
  /** Enqueue a toast; returns its id for `dismiss`. */
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 3;
const DEFAULT_MS = 5000;
const BAD_MS = 8000;
const RESUME_MIN_MS = 1000;
/** Safety net if `animationend` never fires. Exit keyframes are 150 ms. */
const EXIT_FALLBACK_MS = 260;
/** How long an announcement stays in the live region before it is cleaned up. */
const ANNOUNCE_MS = 3000;

const DISMISS: Record<Locale, string> = { en: "Dismiss", ko: "닫기", zh: "关闭", es: "Cerrar" };
const LOCALE_SET: ReadonlySet<string> = new Set<string>(["en", "ko", "zh", "es"]);
const isLocale = (v: string): v is Locale => LOCALE_SET.has(v);

const TONE: Record<ToastTone, { icon: LucideIcon; rail: string; iconCls: string }> = {
  good: { icon: CircleCheck, rail: "border-l-good", iconCls: "text-good-ink" },
  warn: { icon: TriangleAlert, rail: "border-l-warn", iconCls: "text-warn-ink" },
  bad: { icon: CircleAlert, rail: "border-l-bad", iconCls: "text-bad-ink" },
  info: { icon: Info, rail: "border-l-brand", iconCls: "text-brand-deep" },
};

/* ------------------------------------------------------------------------ */
/* Context                                                                   */
/* ------------------------------------------------------------------------ */

let warnedNoProvider = false;
const NO_PROVIDER: ToastApi = {
  push: (t) => {
    if (!warnedNoProvider) {
      warnedNoProvider = true;
      console.warn("[ui/toast] useToast() was called outside <ToastProvider>; toasts are dropped. First title:", t.title);
    }
    return "";
  },
  dismiss: () => {},
};

const ToastContext = createContext<ToastApi>(NO_PROVIDER);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------------ */
/* Provider                                                                  */
/* ------------------------------------------------------------------------ */

type Item = { id: string; input: ToastInput; tone: ToastTone; closing: boolean };
type Announcement = { id: string; text: string; assertive: boolean };

const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

function useUiLocale(override?: Locale): Locale {
  const [lang, setLang] = useState<Locale>("en");
  useEffect(() => {
    if (override) return;
    const read = () => {
      const l = document.documentElement.lang.slice(0, 2).toLowerCase();
      setLang(isLocale(l) ? l : "en");
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => mo.disconnect();
  }, [override]);
  return override ?? lang;
}

export function ToastProvider({ children, locale }: { children: ReactNode; locale?: Locale }): ReactElement {
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  const dismissLabel = DISMISS[useUiLocale(locale)];

  const [items, setItems] = useState<Item[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: string) => {
    setItems((xs) => (xs.some((x) => x.id === id) ? xs.filter((x) => x.id !== id) : xs));
  }, []);

  const dismiss = useCallback((id: string) => {
    if (reduceRef.current) {
      remove(id);
      return;
    }
    setItems((xs) => xs.map((x) => (x.id === id && !x.closing ? { ...x, closing: true } : x)));
  }, [remove]);

  const push = useCallback((input: ToastInput) => {
    const id = `toast-${++seq.current}`;
    const tone = input.tone ?? "info";
    setItems((xs) => {
      // Rolling window: with MAX_VISIBLE already showing, the oldest leaves.
      const open = xs.filter((x) => !x.closing);
      const overflow = open.length - (MAX_VISIBLE - 1);
      const evict = new Set(overflow > 0 ? open.slice(0, overflow).map((x) => x.id) : []);
      const kept = reduceRef.current
        ? xs.filter((x) => !evict.has(x.id))
        : xs.map((x) => (evict.has(x.id) ? { ...x, closing: true } : x));
      return [...kept, { id, input, tone, closing: false }];
    });
    const text = [input.title, input.description].filter(Boolean).join(". ");
    setAnnouncements((a) => [...a, { id, text, assertive: tone === "bad" }]);
    window.setTimeout(() => setAnnouncements((a) => a.filter((x) => x.id !== id)), ANNOUNCE_MS);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss]);

  const viewport = mounted
    ? createPortal(
        <div data-overlay-root="" className="toast-viewport">
          {items.map((it) => (
            <ToastCard key={it.id} item={it} dismissLabel={dismissLabel} dismiss={dismiss} remove={remove} />
          ))}
          {/* Persistent live regions: content is inserted a tick after the region exists, so it is announced. */}
          <div role="status" aria-live="polite" aria-relevant="additions" className="sr-only">
            {announcements.filter((a) => !a.assertive).map((a) => <Announce key={a.id} text={a.text} />)}
          </div>
          <div role="alert" aria-live="assertive" aria-relevant="additions" className="sr-only">
            {announcements.filter((a) => a.assertive).map((a) => <Announce key={a.id} text={a.text} />)}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {viewport}
    </ToastContext.Provider>
  );
}

/** Renders its text one frame after mount so the (already present) live region sees an insertion. */
function Announce({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 50);
    return () => window.clearTimeout(t);
  }, []);
  return shown ? <span>{text}</span> : null;
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function ToastCard({
  item, dismissLabel, dismiss, remove,
}: {
  item: Item;
  dismissLabel: string;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
}) {
  const { id, input, tone, closing } = item;
  const { icon: Icon, rail, iconCls } = TONE[tone];
  const duration = input.durationMs ?? (tone === "bad" ? BAD_MS : DEFAULT_MS);
  const timed = Number.isFinite(duration) && duration > 0;

  // Auto-dismiss with pause/resume: `remaining` is what is left when paused.
  const timer = useRef<number | null>(null);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);

  const stop = useCallback(() => {
    if (timer.current == null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);
  const start = useCallback(() => {
    if (!timed || timer.current != null) return;
    startedAt.current = Date.now();
    // Resuming after a long hover/focus keeps the toast up for at least a second.
    const ms = remaining.current < duration ? Math.max(remaining.current, RESUME_MIN_MS) : remaining.current;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      dismiss(id);
    }, ms);
  }, [timed, duration, dismiss, id]);

  useEffect(() => {
    if (closing) {
      stop();
      return;
    }
    start();
    return stop;
  }, [closing, start, stop]);

  // Exit: unmount once the animation ends (fallback timer in case it never does).
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => remove(id), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [closing, remove, id]);

  const resumeIfIdle = () => {
    if (!hovered.current && !focused.current) start();
  };
  function onBlur(e: ReactFocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    focused.current = false;
    resumeIfIdle();
  }
  function onAnimationEnd(e: ReactAnimationEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && closing) remove(id);
  }

  return (
    <div
      role="status"
      aria-live="off"
      aria-atomic="true"
      data-state={closing ? "closed" : "open"}
      data-tone={tone}
      onPointerEnter={() => { hovered.current = true; stop(); }}
      onPointerLeave={() => { hovered.current = false; resumeIfIdle(); }}
      onFocus={() => { focused.current = true; stop(); }}
      onBlur={onBlur}
      onAnimationEnd={onAnimationEnd}
      className={`toast-card card flex items-start gap-3 border-l-[3px] p-3 pr-2 shadow-pop ${rail}`}
    >
      <Icon size={18} strokeWidth={2} aria-hidden className={`mt-0.5 shrink-0 ${iconCls}`} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold text-ink-1">{input.title}</p>
        {input.description && <p className="mt-0.5 text-xs text-ink-2">{input.description}</p>}
        {input.action && (
          <button
            type="button"
            onClick={() => {
              input.action?.onClick();
              dismiss(id);
            }}
            className={buttonClass("ghost", "sm", "mt-1.5 -ml-2 h-11 sm:h-8 text-brand-deep hover:text-brand-deep")}
          >
            {input.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        title={dismissLabel}
        onClick={() => dismiss(id)}
        className={buttonClass("ghost", "md", "btn-icon h-11 w-11 sm:h-8 sm:w-8 -my-1 shrink-0 text-ink-3 hover:text-ink-1")}
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
