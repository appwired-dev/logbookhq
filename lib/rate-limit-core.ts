/**
 * Pure, dependency-free core of the auth rate limiter.
 *
 * Split out from lib/rate-limit.ts on purpose: that module carries
 * `import "server-only"` (and `next/headers`), which cannot be imported from a
 * plain Node/tsx context — so the pieces worth unit-testing without a database
 * live here, where scripts/rate-limit.test.ts can reach them. Nothing in this
 * file touches Supabase, headers, or any server-only API; the DB call is
 * injected as a client.
 */

/** The one method of the Supabase client this limiter uses. */
export interface RateLimitClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

/** Normalise an email for bucket keying so casing/whitespace can't split it. */
export function normalizeEmailForBucket(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Build an opaque, server-side-only bucket key. Emails are normalised so
 * `Foo@Bar.com` and `foo@bar.com ` land in the same bucket; IPs are used
 * verbatim. The value is never shown to a client, so no hashing is needed.
 */
export function bucketKey(scope: string, dimension: "ip" | "email", value: string): string {
  const v = dimension === "email" ? normalizeEmailForBucket(value) : value;
  return `${scope}:${dimension}:${v}`;
}

/**
 * Core of `underLimit`: run the `check_rate_limit` RPC through an injected
 * client and return whether the caller is still allowed.
 *
 * Fails OPEN. Rate limiting is defense-in-depth, not an auth control: if the
 * RPC is missing (migration not applied), errors, or throws, this returns
 * `true` (allowed) after logging once. The only way it returns `false` is an
 * explicit `false` from the function — an actual over-limit verdict.
 */
export async function underLimitWith(
  client: RateLimitClient,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
      console.warn("[rate-limit] check_rate_limit errored, allowing:", message);
      return true; // fail open
    }
    // Only an explicit `false` blocks; anything else (true, null, undefined)
    // is treated as allowed so a surprising shape never locks a user out.
    return data !== false;
  } catch (e) {
    console.warn("[rate-limit] check_rate_limit threw, allowing:", e instanceof Error ? e.message : String(e));
    return true; // fail open
  }
}
