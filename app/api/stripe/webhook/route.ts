import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, tierForPlan, PAID_SUB_STATUSES, type Plan } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook receiver. Configured in Stripe Dashboard → Developers →
 * Webhooks → Add endpoint pointing at /api/stripe/webhook with these events:
 *
 *   checkout.session.completed      — promote tier on first payment; a
 *                                     Lifetime purchase also stops any running
 *                                     subscription from renewing
 *   customer.subscription.updated   — track plan changes
 *   customer.subscription.deleted   — downgrade back to free on cancel, unless
 *                                     another subscription is still paid
 *
 * The signing secret must be in STRIPE_WEBHOOK_SECRET. Without it we
 * reject every request to prevent spoofing.
 *
 * Idempotency: every processed event id is recorded in
 * stripe_processed_events (migration 0010). A redelivery hits the unique
 * constraint and we ack with 200 so Stripe stops retrying — without this,
 * a redelivered `subscription.deleted` could clobber a since-upgraded tier.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `signature: ${msg}` }, { status: 400 });
  }

  // Service-role client — webhook isn't authenticated as the user, so RLS
  // would block it. The Stripe signature check above is our auth.
  const admin = createAdminClient();

  // Idempotency gate. Insert first; if duplicate, ack and return.
  const { error: dupErr } = await admin
    .from("stripe_processed_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (dupErr) {
    // 23505 = unique_violation in Postgres. Any other DB error and we should
    // 500 so Stripe retries (better to double-process than to silently lose).
    if (dupErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error(`[stripe webhook] dedup insert failed: ${dupErr.message}`);
    return NextResponse.json({ error: dupErr.message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const plan = (session.metadata?.plan ?? "monthly") as Plan;
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (!userId) {
          // Should never happen — startCheckout always sets client_reference_id.
          // Log so we notice if Stripe ever drops it (manual session creation,
          // dashboard test events, etc.) instead of silently losing revenue.
          console.error(`[stripe webhook] checkout.session.completed missing client_reference_id (event ${event.id})`);
          break;
        }
        const { error, count } = await admin
          .from("profiles")
          .update(
            { tier: tierForPlan(plan), stripe_customer_id: stripeCustomerId ?? null },
            { count: "exact" },
          )
          .eq("id", userId);
        // Throw so the catch deletes the dedup row and 500s → Stripe retries.
        // A swallowed error (or 0 rows) would leave a paid user un-upgraded.
        if (error) throw new Error(`checkout upgrade: ${error.message}`);
        if (!count) throw new Error(`checkout upgrade: no profile row for ${userId}`);
        // Lifetime replaces any subscription: stop it renewing so the customer
        // is never billed again for a plan they've outgrown. cancel_at_period_end
        // keeps the period they already paid for; the eventual
        // subscription.deleted is ignored for lifetime profiles below. Any
        // refund of that remaining period is a manual decision. A failure here
        // throws, so Stripe retries the whole (idempotent) handler.
        if (plan === "lifetime" && stripeCustomerId) {
          const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 20 });
          for (const s of subs.data) {
            if (PAID_SUB_STATUSES.has(s.status) && !s.cancel_at_period_end) {
              await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
            }
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = (sub.metadata?.plan ?? "monthly") as Plan;
        const userId = sub.metadata?.user_id;
        if (!userId) {
          console.error(`[stripe webhook] subscription.updated missing user_id metadata (event ${event.id})`);
          break;
        }
        // Lifetime users never get downgraded by a subscription event — they
        // bought one-off and any subscription record is from a prior plan or
        // an unrelated checkout. Skip the write to protect their tier.
        const { data: current } = await admin
          .from("profiles")
          .select("tier")
          .eq("id", userId)
          .single();
        if (current?.tier === "lifetime") break;
        // Keep the paid tier through the dunning grace period: Stripe emits
        // subscription.updated with status "past_due" the instant a renewal
        // charge fails, while automatic card retries are still running and the
        // subscription is usually recovered. Downgrading on the first past_due
        // yanks access (and re-applies the 100-flight cap) from a customer who
        // is still effectively subscribed. Downgrade only on terminal states;
        // a true cancel arrives as customer.subscription.deleted.
        const tier = PAID_SUB_STATUSES.has(sub.status) ? tierForPlan(plan) : "free";
        const { error, count } = await admin.from("profiles").update({ tier }, { count: "exact" }).eq("id", userId);
        if (error) throw new Error(`subscription update: ${error.message}`);
        if (!count) throw new Error(`subscription update: no profile row for ${userId}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) {
          console.error(`[stripe webhook] subscription.deleted missing user_id metadata (event ${event.id})`);
          break;
        }
        const { data: current } = await admin
          .from("profiles")
          .select("tier")
          .eq("id", userId)
          .single();
        if (current?.tier === "lifetime") break;
        // A customer can end up with two subscriptions (e.g. one started before
        // the checkout guard existed). Ending one must not drop a customer who
        // is still paying for the other.
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        let stillPaid: Stripe.Subscription | undefined;
        if (customerId) {
          const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
          stillPaid = subs.data.find((s) => s.id !== sub.id && PAID_SUB_STATUSES.has(s.status));
        }
        const nextTier = stillPaid ? tierForPlan((stillPaid.metadata?.plan ?? "monthly") as Plan) : "free";
        const { error, count } = await admin.from("profiles").update({ tier: nextTier }, { count: "exact" }).eq("id", userId);
        if (error) throw new Error(`subscription cancel: ${error.message}`);
        if (!count) throw new Error(`subscription cancel: no profile row for ${userId}`);
        break;
      }
      default:
        // Other event types — acknowledge without action.
        break;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[stripe webhook] handler error: ${msg}`);
    // The dedup row was inserted before we tried to process. If we 500 here,
    // Stripe will retry with the same event id and hit the dedup short-circuit
    // on the next attempt without ever running the handler again. Delete the
    // dedup row so the retry can actually re-attempt processing.
    await admin
      .from("stripe_processed_events")
      .delete()
      .eq("event_id", event.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
