import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, RECOVERY_WINDOW_SECONDS, safeNext } from "@/app/auth/recovery";

/**
 * Landing point for every emailed auth link (today: password recovery).
 *
 * `@supabase/ssr` v0.5.2 pins `flowType: "pkce"` in both createBrowserClient
 * and createServerClient, so the recovery mail lands here as `?code=<uuid>`,
 * and the session only materialises once `exchangeCodeForSession()` trades
 * that code plus the `-code-verifier` cookie (written by the server action
 * that sent the mail) for real auth cookies.
 *
 * There is deliberately NO `?token_hash=&type=` branch. `verifyOtp` on a bare
 * GET mints a session for whoever opens the link, with nothing binding it to
 * the browser that asked for the reset — an attacker can request a reset for
 * their OWN account, lift the token from their own inbox, and send the victim
 * a link on this real domain that signs the victim into the attacker's
 * session (or, with `next`, bounces them onward). PKCE's code-verifier cookie
 * IS that binding, so the flow stays PKCE-only. The cost is that the link must
 * be opened in the browser that requested it; making it cross-device needs a
 * server-side nonce, not verifyOtp on a GET.
 *
 * Security notes:
 *  - The redirect we hand the browser is rebuilt from scratch (base + a
 *    validated relative `next`). The `code` / `token_hash` never survive into
 *    it, so nothing sensitive lands in history, the Referer header, or a
 *    bookmark.
 *  - `next` goes through the same relative-path check as /login's `safeNext`.
 *  - Failures never echo Supabase's message back to the browser; they all end
 *    on the same "this link has expired" screen.
 */

export const dynamic = "force-dynamic";

/** Email OTP types GoTrue can send us. Structurally assignable to EmailOtpType. */
/**
 * Absolute base for the redirect. `NEXT_PUBLIC_APP_URL` is authoritative (it
 * is what the recovery mail was built with); the request's own host is only a
 * fallback for environments where it isn't set — never a user-supplied field.
 */
function appOrigin(request: NextRequest): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // Fail closed. x-forwarded-host is attacker-controlled, and building an auth
  // landing URL from it lets a crafted request point the flow at another host.
  console.error("[auth/callback] NEXT_PUBLIC_APP_URL is not set at build time");
  return null;
}

/** Redirect with no-store so an intermediary never replays an auth landing. */
function go(to: URL): NextResponse {
  const res = NextResponse.redirect(to);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const base = appOrigin(request);
  if (!base) return new NextResponse("Auth is misconfigured on this deployment.", { status: 500 });
  const failed = new URL("/auth/auth-code-error", base);
  const destination = new URL(safeNext(params.get("next") ?? "/app"), base);

  // GoTrue rejected the link before it ever reached us (expired OTP, reused
  // link, disabled signup…). It appends ?error=&error_code=&error_description=.
  const gotrueError = params.get("error") ?? params.get("error_code");
  if (gotrueError) {
    // Truncated: this is attacker-shaped text arriving in a query string.
    // Control characters stripped: this lands in a log an incident responder reads.
    console.warn("[auth/callback] provider error:", gotrueError.replace(/[^\x20-\x7e]/g, ".").slice(0, 80));
    return go(failed);
  }

  const code = params.get("code");
  if (!code) return go(failed);

  const supabase = await createClient();

  // Route-handler cookies() is writable, so the session cookies set by this
  // call ride out on the redirect response below.
  const result = await supabase.auth.exchangeCodeForSession(code);

  if (result.error) {
    // Message is logged, never rendered: it can distinguish "expired" from
    // "already used", which is not the browser's business.
    console.warn("[auth/callback] exchange failed:", result.error.message);
    return go(failed);
  }

  // Mark this session as recovery-minted so /reset-password will accept it.
  // Any other authenticated session lacks the cookie and cannot change a
  // password without knowing the current one. Gate it on the recovery
  // destination (next=/reset-password): other exchanges that land here — e.g. a
  // Google OAuth sign-in — must NOT inherit password-reset privilege.
  const res = go(destination);
  if (destination.pathname === "/reset-password") {
    res.cookies.set(RECOVERY_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(base).protocol === "https:",
      path: "/",
      maxAge: RECOVERY_WINDOW_SECONDS,
    });
  }
  return res;
}
