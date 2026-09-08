/**
 * Shared, dependency-free helpers for the password-recovery flow.
 *
 * Lives outside the `"use server"` action files on purpose: a "use server"
 * module may only export async functions, so `safeNext` and the password
 * policy constant cannot be exported from `app/login/actions.ts` (where the
 * original `safeNext` lives) or from the recovery actions. This module is
 * safe to import from Server Components, Server Actions, Route Handlers and
 * Client Components alike — it has no imports at all.
 */

/**
 * Accept only same-origin relative paths.
 *
 * Pattern-matching the raw string is not enough: the WHATWG URL parser strips
 * ASCII tab, LF and CR from input BEFORE parsing, so `/\t/evil.com` slips past
 * a `startsWith("//")` test and then resolves to a different origin. So strip
 * those first, then parse against a throwaway base and keep the result only if
 * it stayed on that base. Falls back to `/app`.
 */
export function safeNext(next: string): string {
  const cleaned = next.replace(/[\t\n\r]/g, "");
  if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\")) return "/app";
  try {
    const base = "https://safe-next.invalid";
    const u = new URL(cleaned, base);
    if (u.origin !== base) return "/app";
    const out = `${u.pathname}${u.search}${u.hash}`;
    // Re-check the OUTPUT, not just the input: the parser normalises
    // `/..//evil.com` down to `//evil.com`, which stays on the throwaway base
    // here but goes protocol-relative — and off-origin — at the next hop.
    if (out.startsWith("//") || out.startsWith("/\\")) return "/app";
    return out;
  } catch {
    return "/app";
  }
}

/**
 * Minimum password length enforced by the UI and by the reset action.
 *
 * ASSUMPTION: the hosted Supabase project uses 8. `supabase/config.toml`
 * (local dev stack) still carries GoTrue's default of 6, and the signup form
 * already enforces 8 client-side — so 8 is the stricter of the two and keeps
 * signup and reset consistent. If the production project's
 * Authentication → Policies minimum is raised above 8, bump this constant to
 * match; Supabase rejects a too-short password server-side regardless, and
 * the reset form surfaces that as the "too weak" message.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Cheap format check. Registration state is never revealed — this is shape only. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/**
 * Name of the HttpOnly marker cookie that proves the current session was
 * minted by /auth/callback from a recovery link in THIS browser.
 *
 * Without it, /reset-password would change a password for any authenticated
 * session — a stolen cookie, a shared laptop or an unlocked kiosk could set a
 * new password without knowing the old one. The cookie is set only by the
 * callback, is unreadable and unforgeable from script, is scoped to the reset
 * path, and is cleared the moment the password actually changes.
 */
export const RECOVERY_COOKIE = "logbookhq.recovery";

/** How long a recovery link stays usable once exchanged. */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;
