"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRICE_IDS, checkoutMode, type Plan } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3030";

/**
 * Form-action variant: reads the plan from FormData. Used by `<form action={...}>`
 * elements where we want a `<button type="submit">` instead of client JS.
 */
export async function startCheckoutFromForm(formData: FormData) {
  const plan = String(formData.get("plan") ?? "") as Plan;
  if (!plan || !["monthly", "annual", "lifetime"].includes(plan)) {
    throw new Error("Invalid plan");
  }
  await startCheckout(plan);
}

/**
 * Start a Stripe Checkout session for the given plan and redirect the user
 * to Stripe's hosted checkout. On success Stripe redirects back to
 * /app/billing/success; on cancel back to /pricing.
 *
 * We pass the Supabase user id in `client_reference_id` so the webhook can
 * promote the right profile after payment. The session also creates a
 * Stripe Customer linked to the user's email so we can later open a
 * billing portal session.
 */
export async function startCheckout(plan: Plan) {
  const priceId = PRICE_IDS[plan];
  if (!priceId) throw new Error(`Stripe price ID for "${plan}" is not configured.`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/pricing")}`);

  // Reuse an existing Stripe customer if the user has one, otherwise create.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: checkoutMode(plan),
    line_items: [{ price: priceId, quantity: 1 }],
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : (profile?.email ?? user.email ?? undefined),
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${APP_URL}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pricing`,
    metadata: { plan, user_id: user.id },
    subscription_data: checkoutMode(plan) === "subscription"
      ? { metadata: { plan, user_id: user.id } }
      : undefined,
  });

  if (!session.url) throw new Error("Stripe didn't return a checkout URL.");
  redirect(session.url);
}

/**
 * Open the Stripe-hosted billing portal so the user can update card / cancel.
 * Requires an existing stripe_customer_id on the profile (i.e. they've
 * checked out at least once).
 */
export async function openBillingPortal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (!profile?.stripe_customer_id) {
    redirect("/pricing");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${APP_URL}/app/settings`,
  });
  redirect(session.url);
}
