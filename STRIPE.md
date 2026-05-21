# Stripe setup

One-time wiring to make payments work in test and live mode.

## 1. Stripe account

Create one at <https://dashboard.stripe.com/register>. Activate the account
(needed for live mode; test mode works without).

## 2. Create the three products

Stripe Dashboard → **Products** → **Add product** — once per plan:

| Product name        | Price             | Billing       | Notes                          |
| ------------------- | ----------------- | ------------- | ------------------------------ |
| Pilot Logbook HQ — Monthly | $3.00 USD / month | Recurring     | Match `app/pricing/page.tsx`   |
| Pilot Logbook HQ — Annual  | $30.00 USD / year | Recurring     | Match `app/pricing/page.tsx`   |
| Pilot Logbook HQ — Lifetime | $119.00 USD       | One-time      | Mode: **One time payment**     |

After creating each, **click the price row** (not the product) and copy
the **Price ID** (`price_...`). Three Price IDs total.

## 3. Get the API keys

Stripe Dashboard → **Developers → API keys**. Copy:

- **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Secret key** → `STRIPE_SECRET_KEY`

Use `sk_test_*` and `pk_test_*` in dev, `sk_live_*` and `pk_live_*` in prod.

## 4. Wire the webhook

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL**: `https://YOUR_DOMAIN/api/stripe/webhook`
  (in dev, use the Stripe CLI to forward — see below)
- **Events to send**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Click **Add endpoint**, then reveal the **Signing secret** (`whsec_...`)
  and put it in `STRIPE_WEBHOOK_SECRET`.

### Local webhook testing

```bash
# Install Stripe CLI (one-time): https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3030/api/stripe/webhook
```

The CLI prints a `whsec_*` to use as your local `STRIPE_WEBHOOK_SECRET`.
Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

## 5. Final `.env.local`

After all of the above, your `.env.local` should have:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
STRIPE_PRICE_LIFETIME=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3030
```

Restart the dev server after editing `.env.local`.

## 6. Smoke test

1. Sign in to the app
2. Visit `/pricing`
3. Click any **Go Pro / Buy lifetime** button
4. Should redirect to Stripe Checkout — use test card `4242 4242 4242 4242`,
   any future expiry, any 3-digit CVC
5. After payment, Stripe redirects to `/app/billing/success`
6. Within a few seconds the webhook fires → `profiles.tier` updates → the
   "Manage billing →" button appears in Settings

If the tier doesn't update: check the webhook listing for failed deliveries
and inspect the response in Stripe Dashboard → Developers → Webhooks → your
endpoint → **Recent events**.

## Going live

Repeat steps 3–4 with `sk_live_*` / `pk_live_*` / a live webhook endpoint.
Create separate **live-mode** Price IDs (Stripe doesn't share between modes).
Set the Vercel project's environment to **Production** and use the live keys
there; keep test keys on **Preview** and **Development**.
