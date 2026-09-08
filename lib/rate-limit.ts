/**
 * Server-side rate limiting for the auth endpoints (login, signup, password
 * reset request, password update).
 *
 * Fixed-window counters stored in Postgres (migration 0013). This module is
 * the only caller of the `check_rate_limit` SQL function; the counter table
 * itself is private (RLS on, no policies).
 *
 * The defining property is **fail-open**: rate limiting is defense-in-depth
 * against mailbombing and brute force, NOT an authentication control. If the
 * RPC is missing (migration not applied yet), the database is unreachable, or
 * anything else goes wrong, `underLimit` returns `true` (allowed) and logs
 * once. A DB hiccup must never lock a legitimate pilot out of their own login
 * — that is exactly the CAPTCHA failure mode this replaces.
 *
 * Server-only: never import from a Client Component. The pure, testable core
 * lives in lib/rate-limit-core.ts (no server-only marker).
 */
import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { underLimitWith, type RateLimitClient } from "@/lib/rate-limit-core";

export { bucketKey, normalizeEmailForBucket } from "@/lib/rate-limit-core";

/**
 * True if `bucket` is still under `max` attempts within the current
 * `windowSeconds` fixed window. Fails OPEN: any error — including the server
 * client itself being unavailable — returns `true` (allowed).
 *
 * `bucket` is an opaque, server-chosen key (e.g. `login:ip:1.2.3.4`); build it
 * with `bucketKey` so email casing can't split the counter.
 */
export async function underLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    // Service-role client, NOT the anon client: check_rate_limit is not granted
    // to anon, so it cannot be called with a forged p_bucket via PostgREST to
    // exhaust a chosen victim's counter. The key is always built server-side.
    const supabase = createAdminClient();
    return await underLimitWith(supabase as unknown as RateLimitClient, bucket, max, windowSeconds);
  } catch (e) {
    console.warn("[rate-limit] admin client unavailable, allowing:", e instanceof Error ? e.message : String(e));
    return true; // fail open
  }
}

/**
 * Best-effort client IP for keying per-IP limits. Prefers `x-real-ip` (set and
 * overwritten by Vercel), then the leftmost `x-forwarded-for` hop.
 * Falls back to the constant `"unknown"`, so a missing header collapses those
 * callers into one shared bucket rather than throwing. Never trust this for
 * anything but coarse rate-limiting — the header is client-supplied and only
 * the platform-appended hop is trustworthy.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Prefer x-real-ip: on Vercel the platform sets it and overwrites any inbound
  // value, so it is harder to spoof than the leftmost x-forwarded-for hop.
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}
