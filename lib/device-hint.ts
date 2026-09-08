import { headers } from "next/headers";

/**
 * Server-side device hint, so the first paint matches the client's breakpoint
 * instead of assuming desktop and swapping after hydration.
 *
 * Chromium sends the low-entropy client hint `sec-ch-ua-mobile: ?1` on every
 * request from a phone; Safari and Firefox do not, so the user-agent is the
 * fallback. Both are hints, not truth: the client's `matchMedia` corrects the
 * layout after hydration either way (see lib/use-media-query.ts). iPads
 * identify as Macintosh by default — they are ≥ 768 px anyway.
 */
export function isMobileHint(get: (name: string) => string | null | undefined): boolean {
  const ch = get("sec-ch-ua-mobile");
  if (ch === "?1") return true;
  if (ch === "?0") return false;
  return /Mobi|Android|iPhone/i.test(get("user-agent") ?? "");
}

/** `true` when the request looks like it comes from a ≥ md viewport (the table layout). */
export async function getServerIsDesktop(): Promise<boolean> {
  const h = await headers();
  return !isMobileHint((name) => h.get(name));
}
