"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/app/auth/recovery";
import { bucketKey, clientIp, underLimit } from "@/lib/rate-limit";

/** Absolute base for OAuth redirect URLs. Authoritative in prod; the Google
 *  button only renders where this is set (NEXT_PUBLIC_GOOGLE_AUTH_ENABLED). */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";

/**
 * Shown when a rate-limit bucket trips. Deliberately vague and identical
 * across dimensions (IP vs email) and endpoints — it must not become an
 * oracle for which limit fired or whether an address is registered.
 */
const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";

/**
 * Turn a Supabase auth error into something a user can act on. The captcha
 * case matters here: if the security check didn't complete (widget still
 * solving, blocked, or expired) Supabase rejects the whole request, and the
 * raw "captcha verification process failed" reads like a server fault. Tell
 * the user to complete the check and retry instead.
 */
function friendlyAuthError(error: { message: string; code?: string }): string {
  const m = error.message.toLowerCase();
  if (error.code === "captcha_failed" || m.includes("captcha")) {
    return "Please complete the security check and try again.";
  }
  return error.message;
}

/**
 * Accept only same-origin relative paths.
 *
 * The URL parser strips ASCII tab/LF/CR before parsing, so a raw
 * `startsWith("//")` test is bypassable with `/\t/evil.com` — which resolved
 * to https://evil.com and made `?next=` on this page an open redirect. Strip
 * those characters, then parse and keep the result only if it stayed on the
 * throwaway base. Shared implementation lives in `app/auth/recovery.ts`.
 */

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/app"));
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  // Brute-force defense, BEFORE touching Supabase. Two independent dimensions:
  // Per-IP ONLY, deliberately. A per-EMAIL login limit keyed on an
  // attacker-supplied address is a targeted account-lockout weapon — the same
  // deny-the-real-user failure that got CAPTCHA pulled — so it is not used.
  // Brute force from one host is caught here; GoTrue keeps its own per-account
  // backoff. Fails open (see lib/rate-limit) so a DB hiccup never blocks login.
  const ip = await clientIp();
  if (!(await underLimit(bucketKey("login", "ip", ip), 20, 900))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) return { error: friendlyAuthError(error) };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  // Abuse defense: cap new-account creation per source IP. Fails open.
  const ip = await clientIp();
  if (!(await underLimit(bucketKey("signup", "ip", ip), 10, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, captchaToken },
  });
  if (error) return { error: friendlyAuthError(error) };

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/app");
  }

  // Email confirmation required — show a success message instead of redirecting.
  return { ok: true, message: "Check your email to confirm your account." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}


/**
 * Start Google OAuth from the SERVER (not the browser). This mirrors the
 * password-recovery flow, which works precisely because the same server client
 * that INITIATES the PKCE flow also COMPLETES it: signInWithOAuth here writes
 * the `-code-verifier` cookie through the server cookie store, and
 * /auth/callback reads that same cookie at exchange time.
 *
 * The previous client-initiated version (createBrowserClient in
 * GoogleSignInButton) wrote the verifier in the browser, and the server
 * exchange couldn't reliably match it across the OAuth round-trip / repeat
 * clicks — GoTrue returned `flow_state_not_found` and the user was bounced to
 * the "link expired" screen despite a valid Google login.
 *
 * signInWithOAuth on the server does not redirect; it returns the provider URL,
 * which we redirect to (with the freshly-set verifier cookie riding along).
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "/app"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data?.url) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=google`);
  }
  // Redirect carries the Set-Cookie for the PKCE verifier written just above.
  redirect(data.url);
}
