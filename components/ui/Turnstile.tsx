"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget for the auth forms.
 *
 * Bot / abuse protection on sign-in, sign-up and password-reset. The widget
 * produces a short-lived, single-use token; Supabase verifies it server-side
 * (Authentication → Attack Protection → CAPTCHA, provider Turnstile) using the
 * SECRET key, which never touches this code. The token rides to the server in
 * the `cf-turnstile-response` field Turnstile injects, so a `<Turnstile />`
 * placed inside a `<form>` needs no extra wiring on the happy path.
 *
 * Graceful degradation is deliberate: with no `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * this renders nothing and the forms submit exactly as before. That is what
 * lets the code ship BEFORE the key is set and BEFORE Supabase CAPTCHA is
 * switched on, so neither step breaks live login. Order of operations:
 *   1. merge this code            (widget hidden, nothing changes)
 *   2. set the site key in Vercel (widget appears)
 *   3. enable CAPTCHA in Supabase (tokens now required and verified)
 *
 * Tokens are single-use: after a rejected submit the parent bumps a `key` to
 * remount the widget and mint a fresh one — see the auth forms.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const RESPONSE_FIELD = "cf-turnstile-response";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      "refresh-expired"?: "auto" | "manual" | "never";
      "response-field-name"?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** One shared script load across every widget instance on the page. */
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile load failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error("turnstile load failed")), { once: true });
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * @param onReady called with true once a token exists, false while the widget
 *   is solving, errored or expired — so a form can keep submit disabled until
 *   the challenge is solved. Never called when Turnstile is not configured.
 */
export function Turnstile({ onReady }: { onReady?: (ready: boolean) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;
    const el = holder.current;
    if (!el) return;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || !el) return;
        widgetId.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          theme: "light",
          "refresh-expired": "auto",
          "response-field-name": RESPONSE_FIELD,
          callback: () => onReady?.(true),
          "error-callback": () => onReady?.(false),
          "expired-callback": () => onReady?.(false),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      const id = widgetId.current;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* already gone */
        }
      }
      widgetId.current = null;
    };
    // Mount-only: the parent remounts (via key) to reset, so re-running here
    // would double-render. onReady is read fresh through the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className="min-h-[65px]">
      <div ref={holder} />
      {failed && (
        <p className="text-2xs text-ink-3">
          Couldn&apos;t load the security check. Disable any content blocker and reload.
        </p>
      )}
    </div>
  );
}

/** True when Turnstile is configured for this build — forms gate submit on it. */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);
