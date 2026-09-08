"use client";

import {
  useEffect, useId, useRef, useState, useSyncExternalStore,
  type AnimationEvent as ReactAnimationEvent, type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { buttonClass } from "./button-class";
import { X } from "./icons";

/**
 * Modal + ConfirmDialog.
 *
 * Rendered through a portal into <body> (so header/toolbar stacking contexts
 * never clip it). While open: focus is trapped inside the panel, the rest of
 * <body> is `inert` + aria-hidden, body scroll is locked (ref-counted, so
 * nested dialogs and unmounts restore correctly), Escape / backdrop close it,
 * and focus returns to whatever had it when the dialog opened.
 *
 * Below `sm` the panel is a bottom sheet (full width, rounded top, safe-area
 * padding); from `sm` up it is a centred card whose max-width follows `size`.
 * Enter/exit animate transform + opacity only (`.modal-panel` /
 * `.overlay-backdrop` in globals.css, "Phase 3 — overlays"); reduced motion
 * skips both.
 *
 * Built-in copy (the header close label, the default Cancel label) follows
 * `locale` when given, else <html lang> (set by <HtmlLang>), else English.
 */

/* ------------------------------------------------------------------------ */
/* Locale                                                                    */
/* ------------------------------------------------------------------------ */

const UI_STRINGS: Record<Locale, { close: string; cancel: string }> = {
  en: { close: "Close", cancel: "Cancel" },
  ko: { close: "닫기", cancel: "취소" },
  zh: { close: "关闭", cancel: "取消" },
  es: { close: "Cerrar", cancel: "Cancelar" },
};
const LOCALE_SET: ReadonlySet<string> = new Set<string>(["en", "ko", "zh", "es"]);
const isLocale = (v: string): v is Locale => LOCALE_SET.has(v);

/** `override`, else <html lang> (kept in sync via a MutationObserver), else "en". */
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

/* ------------------------------------------------------------------------ */
/* Shared client-only helpers                                                */
/* ------------------------------------------------------------------------ */

const subscribeNoop = () => () => {};
/** False on the server and during hydration, true afterwards (no mismatch, no extra effect). */
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Tabbable descendants, in DOM order, skipping anything hidden or inert. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getClientRects().length > 0,
  );
}

/* ---- module-level bookkeeping shared by every open dialog ---- */

/** Ids of open dialogs, bottom → top. Only the top one owns Escape and the focus guard. */
const openStack: string[] = [];
const isTop = (id: string) => openStack[openStack.length - 1] === id;

let lockDepth = 0;
let savedOverflow = "";
let savedPaddingRight = "";
function lockScroll() {
  if (lockDepth++ > 0) return;
  const body = document.body;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`; // keep the layout from jumping when the scrollbar goes
}
function unlockScroll() {
  lockDepth = Math.max(0, lockDepth - 1);
  if (lockDepth > 0) return;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPaddingRight;
}

let inertDepth = 0;
const inerted = new Map<HTMLElement, string | null>();
/** Make every other <body> child inert (skipping overlays — other dialogs, the toast viewport). */
function inertSiblings() {
  if (inertDepth++ > 0) return;
  for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.hasAttribute("data-overlay-root") || /^(SCRIPT|STYLE|LINK|NEXTJS-PORTAL)$/.test(el.tagName)) continue;
    inerted.set(el, el.getAttribute("aria-hidden"));
    el.inert = true;
    el.setAttribute("aria-hidden", "true");
  }
}
function releaseSiblings() {
  inertDepth = Math.max(0, inertDepth - 1);
  if (inertDepth > 0) return;
  for (const [el, prevHidden] of inerted) {
    el.inert = false;
    if (prevHidden == null) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", prevHidden);
  }
  inerted.clear();
}

/* ------------------------------------------------------------------------ */
/* Modal                                                                     */
/* ------------------------------------------------------------------------ */

export type ModalSize = "sm" | "md" | "lg";
const SIZE: Record<ModalSize, string> = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

/** Safety net if `animationend` never fires (tab hidden, animation removed). Exit keyframes are ≤ 200 ms. */
const EXIT_FALLBACK_MS = 260;

type Phase = "open" | "closing" | "closed";

export interface ModalProps {
  open: boolean;
  /** Called for Escape, backdrop click and the header close button. The parent flips `open`. */
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  /** Actions row: stacked (primary on top) below `sm`, right-aligned row from `sm`. */
  footer?: ReactNode;
  /** Receives focus on open; defaults to the first tabbable element, then the panel itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Set false while an action is pending: Escape, the backdrop and the close button stop closing it. */
  dismissible?: boolean;
  /** Header close (X) button. ConfirmDialog turns it off — it has Cancel. */
  closeButton?: boolean;
  /** Overrides <html lang> for the built-in labels. */
  locale?: Locale;
  /** Key events from inside the panel (after the Tab trap has had its turn). */
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

export function Modal({
  open, onClose, title, description, size = "md", children, footer, initialFocusRef,
  dismissible = true, closeButton = true, locale, onKeyDown,
}: ModalProps): ReactElement | null {
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const strings = UI_STRINGS[useUiLocale(locale)];
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);

  // Presence: "open" while shown, "closing" during the exit animation, "closed"
  // = unmounted. Adjusted during render so the panel is in the DOM in the same
  // commit `open` flips true (the focus effect below relies on that).
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  if (open && phase !== "open") setPhase("open");
  else if (!open && phase === "open") setPhase(reduce ? "closed" : "closing");

  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Latest props for the document-level listeners (bound once per open).
  const latest = useRef({ onClose, dismissible, initialFocusRef });
  useEffect(() => {
    latest.current = { onClose, dismissible, initialFocusRef };
  });

  // Open: remember the opener, lock scroll, inert the page, move focus in;
  // close: undo all of that and hand focus back.
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openStack.push(id);
    lockScroll();
    inertSiblings();

    const target = latest.current.initialFocusRef?.current ?? (panel ? focusables(panel)[0] : undefined) ?? panel;
    target?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented || !isTop(id)) return;
      e.preventDefault();
      if (latest.current.dismissible) latest.current.onClose();
    }
    // Focus that lands outside the panel (browser chrome, AT cursor) is pulled back in;
    // other overlays (a toast, a dialog stacked on top) are left alone.
    function onFocusIn(e: FocusEvent) {
      if (!isTop(id) || !panel) return;
      const t = e.target;
      if (!(t instanceof Node) || panel.contains(t)) return;
      if (t instanceof Element && t.closest("[data-overlay-root]")) return;
      (focusables(panel)[0] ?? panel).focus({ preventScroll: true });
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      const i = openStack.lastIndexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      releaseSiblings(); // before restoring focus — an inert element refuses it
      unlockScroll();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, mounted, id]);

  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Tab") {
      const panel = panelRef.current;
      if (!panel) return;
      const list = focusables(panel);
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    onKeyDown?.(e);
  }

  function onPanelAnimationEnd(e: ReactAnimationEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && phase === "closing") setPhase("closed");
  }

  if (!mounted || phase === "closed") return null;

  const state = phase === "open" ? "open" : "closed";
  const hasBody = children !== null && children !== undefined && children !== false;

  return createPortal(
    <div data-overlay-root="" className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden
        data-state={state}
        onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
        onClick={(e) => {
          // Only a press that started AND ended on the backdrop closes — a drag
          // out of a text field must not.
          const ok = downOnBackdrop.current && e.target === e.currentTarget;
          downOnBackdrop.current = false;
          if (ok && dismissible) onClose();
        }}
        className="overlay-backdrop absolute inset-0 touch-none bg-ink-1/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-state={state}
        onKeyDown={onPanelKeyDown}
        onAnimationEnd={onPanelAnimationEnd}
        className={`modal-panel relative flex w-full max-h-[calc(100dvh-1.5rem)] flex-col rounded-t-card border border-border bg-surface shadow-pop outline-none
          pb-[env(safe-area-inset-bottom)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-card sm:pb-0 ${SIZE[size]}`}
      >
        {/* sheet grab handle (phones only) */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" />

        <div className="flex items-start gap-3 px-4 pt-3 sm:px-5 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-md font-semibold tracking-tight text-ink-1">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          {closeButton && (
            <button
              type="button"
              aria-label={strings.close}
              title={strings.close}
              disabled={!dismissible}
              onClick={() => onClose()}
              className={buttonClass("ghost", "md", "btn-icon h-11 w-11 sm:h-9 sm:w-9 -mr-2 -mt-1.5 shrink-0 text-ink-3 hover:text-ink-1")}
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

        {hasBody && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm text-ink-1 sm:px-5">{children}</div>
        )}

        {footer && (
          <div
            className={`flex flex-col-reverse gap-2 px-4 pb-4 sm:flex-row sm:items-center sm:justify-end sm:px-5 sm:pb-5 ${
              hasBody ? "pt-1" : "pt-4"
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------ */
/* ConfirmDialog                                                             */
/* ------------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Plain text becomes the dialog's description (aria-describedby); nodes render in the body. */
  body?: ReactNode;
  confirmLabel: string;
  /** Defaults to a localised "Cancel". */
  cancelLabel?: string;
  /** `danger` = red confirm button and initial focus on Cancel. */
  tone?: "default" | "danger";
  /** Confirm shows a spinner; Cancel, Escape and the backdrop are disabled. */
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Overrides <html lang> for the default Cancel label. */
  locale?: Locale;
}

/**
 * Yes/no dialog on top of <Modal>. Enter anywhere inside confirms, except on
 * a control that activates natively (the buttons, links, textareas) so Enter
 * on Cancel still cancels.
 */
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, tone = "default", pending = false, onConfirm, onCancel, locale,
}: ConfirmDialogProps): ReactElement | null {
  const strings = UI_STRINGS[useUiLocale(locale)];
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const bodyIsText = typeof body === "string";

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || pending) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest("button, a[href], textarea, select, [role='menuitem'], [role='option']")) return;
    e.preventDefault();
    void onConfirm();
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={bodyIsText ? body : undefined}
      size="sm"
      closeButton={false}
      dismissible={!pending}
      initialFocusRef={tone === "danger" ? cancelRef : confirmRef}
      locale={locale}
      onKeyDown={onKeyDown}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={buttonClass("ghost", "md", "h-11 sm:h-10")}
          >
            {cancelLabel ?? strings.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void onConfirm()}
            aria-busy={pending || undefined}
            disabled={pending}
            className={buttonClass(tone === "danger" ? "danger" : "primary", "md", "h-11 sm:h-10")}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {bodyIsText ? null : body}
    </Modal>
  );
}
