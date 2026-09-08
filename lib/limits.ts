/**
 * Plan entitlements enforced server-side. The free tier caps the logbook at
 * FREE_FLIGHT_LIMIT flights; every paid tier is unlimited. Marketing copy
 * repeats the number in a few places (landing, pricing, terms) — this is the
 * single source the server actually enforces against.
 */
export const FREE_FLIGHT_LIMIT = 100;

/**
 * The cap applies only to accounts created on or after this cutoff. Pilots who
 * signed up before enforcement shipped are grandfathered — they keep adding
 * freely — so nobody is retroactively blocked from their own logbook.
 */
export const FREE_CAP_FROM = new Date("2026-09-09T00:00:00Z");

/** Free accounts (tier `free`, or unset for a brand-new profile) are capped;
 *  any other tier value is a paid plan and is unlimited. */
export function isFreeTier(tier: string | null | undefined): boolean {
  return !tier || tier === "free";
}

/**
 * Whether the 100-flight cap applies to this account: free tier AND created
 * on/after the cutoff. Unknown creation date → not applied (never wrongly
 * block), and any paid tier → not applied.
 */
export function freeCapApplies(
  tier: string | null | undefined,
  createdAt: string | null | undefined,
): boolean {
  if (!isFreeTier(tier)) return false;
  if (!createdAt) return false;
  return new Date(createdAt).getTime() >= FREE_CAP_FROM.getTime();
}
