import Stripe from "stripe";

/**
 * Singleton Stripe SDK client. Pinned API version so a Stripe-side upgrade
 * doesn't silently change webhook payload shapes.
 *
 * Server-side only — never import from a Client Component.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
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
