import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, tierForPlan, type Plan } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook receiver. Configured in Stripe Dashboard → Developers →
 * Webhooks → Add endpoint pointing at /api/stripe/webhook with these events:
 *
 *   checkout.session.completed      — promote tier on first payment
 *   customer.subscription.updated   — track plan changes
 *   customer.subscription.deleted   — downgrade back to free on cancel
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
        await admin
          .from("profiles")
          .update({
            tier: tierForPlan(plan),
            stripe_customer_id: stripeCustomerId ?? null,
          })
          .eq("id", userId);
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
        // Active subscription stays Pro; past_due / unpaid get downgraded.
        const tier = ["active", "trialing"].includes(sub.status) ? tierForPlan(plan) : "free";
        await admin.from("profiles").update({ tier }).eq("id", userId);
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
        await admin.from("profiles").update({ tier: "free" }).eq("id", userId);
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
