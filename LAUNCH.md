# Launch checklist — Pilot Logbook HQ

End-to-end steps to get from local dev to a live, paying-customer-ready
deployment. Each box should be checked before pointing real users at it.

## 1. Production Supabase project

A fresh project, not your dev one — keeps user PII separated and lets you
break things in dev without scaring real users.

- [ ] **Create new project** at <https://supabase.com/dashboard>
  - Region: pick the one nearest your largest user base
  - Choose a strong DB password and **save it in a password manager**
- [ ] **Run every migration** in `supabase/migrations/` in order:
  `0001` → `0002` → ... → `0008`. Use the SQL editor; paste each file's
  contents and Run.
- [ ] **Create storage buckets**: `documents` (private), `avatars` (public).
- [ ] **Apply storage RLS** — paste `supabase/migrations/0006_storage_policies.sql`
  into the SQL editor (must run via dashboard, not migrations).
- [ ] **Copy keys** from Project Settings → API:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Configure Auth → URL Configuration**:
  - Site URL: `https://YOUR_DOMAIN`
  - Redirect URLs: add `https://YOUR_DOMAIN/**`

## 2. Stripe live mode

See [STRIPE.md](./STRIPE.md) for the full walkthrough. In summary:

- [ ] Activate Stripe account (live mode)
- [ ] Create the three products (Monthly $3, Annual $30, Lifetime $119) —
  these are **separate** Price IDs from your test-mode prices
- [ ] Add a webhook endpoint pointing at `https://YOUR_DOMAIN/api/stripe/webhook`
  with events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- [ ] Copy the **live** keys + price IDs + webhook secret

## 3. Vercel project

- [ ] `npm install -g vercel` (if not already)
- [ ] `vercel link` from project root → links to a new Vercel project
- [ ] **Add environment variables** — Vercel Dashboard → Project → Settings
  → Environment Variables. Add each from `.env.example` for the
  **Production** environment:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY` (live)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live)
  - `STRIPE_WEBHOOK_SECRET` (live)
  - `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME` (live)
  - `NEXT_PUBLIC_APP_URL` = `https://YOUR_DOMAIN`
- [ ] (Optional) For Preview environment, use Stripe **test** keys so PR
  deploys don't hit production billing.
- [ ] **Deploy**: `vercel --prod` (or push to `main` if connected to GitHub).

## 4. Custom domain

- [ ] Vercel Dashboard → Domains → Add `yourdomain.com` and `www.yourdomain.com`
- [ ] In your DNS provider, add the records Vercel shows you (A or CNAME)
- [ ] Wait for SSL cert (a few minutes); verify HTTPS works
- [ ] Update `NEXT_PUBLIC_APP_URL` env var to the custom domain and
  re-deploy
- [ ] Update Supabase Auth URLs to the custom domain (step 1 above)
- [ ] Update the Stripe webhook URL to the custom domain

## 5. Pre-flight smoke tests

Run through these on the deployed site:

- [ ] **Sign up** with a fresh email → confirmation email arrives → click
  through → land on `/app`
- [ ] **Add a flight** → appears in Flights list and updates Dashboard totals
- [ ] **Import CSV** (use one of the formats in `app/app/transfer`) →
  flights appear
- [ ] **Generate PDF** in Transfer → opens, looks right
- [ ] **Backup ZIP** from Settings → downloads, contains CSV + PDF
- [ ] **Buy Pro (monthly)** using Stripe live mode → redirected to Stripe
  Checkout → pay with **a real card you control** → land on
  `/app/billing/success`
- [ ] Within ~10 seconds, **Settings shows tier = pro** and **Manage
  billing →** button is visible
- [ ] Click **Manage billing →** → Stripe Customer Portal opens
- [ ] **Cancel subscription** from the portal → after the period ends,
  tier flips back to `free` (test next cycle, or use Stripe Dashboard to
  manually expire)
- [ ] **Switch locale** to KO/ZH/ES and confirm UI translates
- [ ] **Change regime** to a non-CA option (e.g. UKCAA, FAA) and confirm
  the Dashboard recomputes against that regime's rules
- [ ] **Share link** — create one in Settings, open it in an Incognito
  window → renders read-only snapshot without auth

## 6. Marketing prerequisites

- [ ] **Privacy Policy** — required by Stripe and most jurisdictions.
  Generate one at <https://www.iubenda.com/> or write a minimal page
  covering: what data you store, how you use it, retention, deletion
  request flow.
- [ ] **Terms of Service** — required by Stripe before live mode is enabled.
- [ ] Link both in the footer of `app/page.tsx`.
- [ ] **Refund policy** — Stripe expects one. Your pricing page says "30-day
  refund on annual & lifetime" — make sure that's a real policy you
  honor.
- [ ] **Contact email** — set up `support@yourdomain.com` or similar; show
  it in the footer.

## 7. Analytics / monitoring (optional but recommended)

- [ ] **Vercel Analytics** — one click in Vercel dashboard, free up to a
  generous limit
- [ ] **Sentry** for error tracking — `npx @sentry/wizard@latest -i nextjs`
- [ ] **Stripe Radar** — already on by default in live mode; review
  flagged transactions weekly for the first month

## 8. Day-1 launch

- [ ] Soft launch: 3-5 friends-as-users to find rough edges
- [ ] Watch the Stripe Dashboard + Vercel logs for the first 48 hours
- [ ] If a webhook fails (Stripe Dashboard → Webhooks → endpoint → Recent
  events), check Vercel function logs for the route `/api/stripe/webhook`

## 9. Post-launch

- [ ] Set up a weekly cron to remind you to back up your Supabase DB
  (Project Settings → Database → Backups; the free tier keeps 7 days)
- [ ] Set up email alerts for failed Stripe payments (Stripe Dashboard →
  Subscriptions → Failure notifications)
- [ ] Refresh the TC + FAA aircraft registry every 1-3 months
  (`npx tsx scripts/build-aircraft-registry.ts`)

---

When all boxes are checked, you're live. Most issues you hit will come
from missing env vars or skipped migrations — both are easy to recover
from after the fact, so prioritize getting *something* live over a perfect
launch.
