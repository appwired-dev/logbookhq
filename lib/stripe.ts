import Stripe from "stripe";

/**
 * Lazily-constructed singleton Stripe SDK client. Pinned API version so a
 * Stripe-side upgrade doesn't silently change webhook payload shapes.
 *
 * Lazy on purpose: `next build` imports every route module while collecting
 * page data, and an eager `new Stripe(undefined)` throws — which broke every
 * build in an environment without STRIPE_SECRET_KEY (local, Vercel previews).
 * The client is created on first use, so a missing key only fails the request
 * that actually needs Stripe. Call sites keep using `stripe.<api>` unchanged.
 *
 * Server-side only — never import from a Client Component.
 */
let client: Stripe | null = null;
function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured for this environment");
    client = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return client;
}
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const c = getStripe();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
});

/** Map our internal plan codes to the Stripe Price IDs from env. */
export const PRICE_IDS = {
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
  annual:   process.env.STRIPE_PRICE_ANNUAL,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
} as const;

export type Plan = keyof typeof PRICE_IDS;

/** Which plans use Stripe's "subscription" mode vs one-off "payment" mode. */
export function checkoutMode(plan: Plan): "subscription" | "payment" {
  return plan === "lifetime" ? "payment" : "subscription";
}

/** Returns the tier value to set on profiles.tier when this plan is paid. */
export function tierForPlan(plan: Plan): "pro" | "lifetime" {
  return plan === "lifetime" ? "lifetime" : "pro";
}
