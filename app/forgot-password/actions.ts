"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { looksLikeEmail } from "@/app/auth/recovery";

/**
 * Ask Supabase to email a recovery link.
 *
 * The whole point of this action is what it does NOT tell the caller:
 *
 *  - **No enumeration.** `sent` comes back whether or not the address has an
 *    account, and every path is padded to a fixed deadline grid, so a fast
 *    local rejection and a slow SMTP hand-off land on the same clock reading.
 *  - **The throttle notice is browser-state driven, not account-state driven.**
 *    Supabase's per-address send throttle only trips for addresses it actually
 *    mailed, so surfacing its 429 verbatim would itself be an oracle ("this
 *    email is registered"). Instead a short HttpOnly cookie records that *this
 *    browser* just asked, and only that produces `cooldown`; a 429 coming back
 *    from Supabase is swallowed into the ordinary `sent` confirmation.
 *  - **No raw Supabase messages** ever reach the browser.
 *
 * The recovery link points at /auth/callback (PKCE code exchange), which then
 * forwards to /reset-password.
 */

/** Matches Supabase's own per-address recovery throttle (60s default). */
const COOLDOWN_MS = 60_000;
const COOLDOWN_COOKIE = "logbookhq.pwreset";
/** Responses are quantised to a multiple of this, so timing leaks nothing. */
const MIN_RESPONSE_MS = 700;

export type ForgotPasswordResult =
  /** A link was requested. Shown identically for known and unknown addresses. */
  | { status: "sent" }
  /** This browser asked moments ago — say "try again in a few minutes". */
  | { status: "cooldown" }
  /** The address isn't a valid email at all (format only — no lookup). */
  | { status: "invalid" }
  /** Something broke on our side. Generic copy, details stay in the logs. */
  | { status: "error" };

/**
 * Resolve at a fixed deadline, not a floor.
 *
 * A floor only hides the FAST path. Supabase answers almost instantly for an
 * address it has no user for, but for a registered one it mints a token and
 * hands off to SMTP on the request path — so anything slower than the floor
 * sails straight through and the slow responses are themselves the oracle.
 * Quantising to a fixed grid means a send that overruns costs a whole extra
 * slot rather than leaking its true duration.
 */
async function settle(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const slots = Math.max(1, Math.ceil(elapsed / MIN_RESPONSE_MS));
  const wait = slots * MIN_RESPONSE_MS - elapsed;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * Absolute base for the emailed link. `NEXT_PUBLIC_APP_URL` is authoritative;
 * There is no header fallback: the emailed link is an auth landing URL, and
 * deriving its host from the request would let a crafted request point it
 * elsewhere. Missing config is an error, not a guess.
 */
function appOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // Fail closed rather than trusting a request header. x-forwarded-host rides
  // in with the attacker's own request, so building the emailed link from it
  // aims the recovery URL at a host they chose; Supabase's allow-list is the
  // only thing standing in the way, and one wildcard entry removes even that.
  console.error("[forgot-password] NEXT_PUBLIC_APP_URL is not set at build time");
  return null;
}

/** Supabase's "you're sending too many emails" shapes, across versions. */
function isRateLimited(error: { status?: number; code?: string; message?: string }): boolean {
  if (error.status === 429) return true;
  const code = error.code ?? "";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return true;
  return /rate limit|you can only request this after/i.test(error.message ?? "");
}

export async function requestPasswordReset(formData: FormData): Promise<ForgotPasswordResult> {
  const startedAt = Date.now();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!looksLikeEmail(email)) {
    await settle(startedAt);
    return { status: "invalid" };
  }

  const store = await cookies();
  const lastAsk = Number(store.get(COOLDOWN_COOKIE)?.value ?? "");
  if (Number.isFinite(lastAsk) && lastAsk > 0 && Date.now() - lastAsk < COOLDOWN_MS) {
    await settle(startedAt);
    return { status: "cooldown" };
  }

  // Recorded before the send so a failed attempt still spends the cooldown —
  // that keeps the notice tied to this browser's behaviour, never to whether
  // the address exists.
  store.set(COOLDOWN_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/forgot-password",
    maxAge: Math.ceil(COOLDOWN_MS / 1000),
  });

  const origin = appOrigin();
  if (!origin) {
    await settle(startedAt);
    return { status: "error" };
  }
  const supabase = await createClient();
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
    captchaToken,
  });

  if (error && !isRateLimited(error)) {
    console.error("[forgot-password] resetPasswordForEmail failed:", error.message);
    await settle(startedAt);
    return { status: "error" };
  }

  // A rate-limit error falls through to `sent` on purpose: see the note above.
  await settle(startedAt);
  return { status: "sent" };
}
