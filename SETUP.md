# Pilot Logbook HQ — Setup

Week 1 scaffold of the SaaS at `~/logbookhq`. This is the cloud-hosted multi-tenant version of the personal app at `~/pilot-logbook`. Follow the steps below to get it running locally.

## What's in this scaffold

- **Next.js 15** (App Router, RSC, Turbo dev)
- **Supabase** for Postgres + Auth + Row-Level Security (RLS)
- **Tailwind** + the design system ported from the personal app
- **Pages:**
  - `/` — landing page (positioning + CTA)
  - `/pricing` — 4-tier pricing page (Free / $1 mo / $10 yr / $99 lifetime)
  - `/login`, `/signup` — Supabase Auth (email + password)
  - `/app` — protected dashboard
  - `/app/flights` — protected flights list
- **Schema** — `supabase/migrations/0001_init.sql`. Multi-tenant with RLS so users only see their own data. `flight_field_values` + `field_definitions` tables ready for regime-specific extensibility.

## What's NOT in this scaffold yet

- Add/edit flight forms (Week 2)
- Charts page (Week 2 — port from personal app)
- PDF export (Week 2 — port from personal app)
- Stripe billing (Week 2)
- Multi-regime currency rules (Week 3)
- Email confirmation flow polish (Week 3)
- Deployment to Vercel (Week 4)

## Prerequisites

1. **Node 18.18+** (you have 24, ✓)
2. **A Supabase account** — free tier is fine. https://app.supabase.com
3. **The Supabase CLI** (optional, for local dev) — `brew install supabase/tap/supabase`

## Steps

### 1. Install dependencies

```sh
cd ~/logbookhq
npm install
```

### 2. Create a Supabase project

1. Go to https://app.supabase.com → **New project**
2. Name: `logbookhq` (or whatever)
3. Set a strong database password (save it somewhere — you won't need it day-to-day, but it's required for direct DB access)
4. Pick a region close to your users (`us-west-1` if your wedge is North American international pilots)
5. Wait ~2 min for it to provision

### 3. Get your API credentials

Inside your new project:
- **Settings → API** → copy:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

Create `.env.local`:

```sh
cp .env.example .env.local
# then edit .env.local with your values
```

⚠️ Never commit `.env.local`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

### 4. Run the schema migration

In Supabase, go to **SQL Editor → New query**. Paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click Run. You should see "Success. No rows returned."

This creates:
- `profiles` — one row per signed-up user (auto-created on signup via trigger)
- `flights` — flight log rows, scoped to `user_id`
- `field_definitions` + `flight_field_values` — regime-specific extensibility (empty for now)
- RLS policies — every user sees only their own data

### 5. Configure email auth

In Supabase **Authentication → Providers**:
- **Email** → keep enabled
- **Confirm email** → enable for production. For local dev, you can disable it to skip the email verification step.

### 6. Run dev server

```sh
npm run dev
```

Open http://localhost:3000. You should see the landing page.

- Click **Start free** → signup form → fill in name/email/password
- (If email confirmation is enabled, click the link in your inbox)
- Should redirect to `/app` (the protected dashboard, currently empty)

### 7. Verify multi-tenancy

Sign up a second user (different email). Confirm that user 2's `/app` is empty even if user 1 has flights — RLS is doing its job.

### 8. (Optional) Seed a master / admin account

Once Supabase is wired up properly, you can create or promote an admin
user with the lifetime tier:

```sh
npm run seed:admin -- appwired@gmail.com
# Will prompt for password (input is hidden, never written to disk).
```

Or non-interactive (less safe — your shell may log it):

```sh
ADMIN_PASSWORD='your-strong-pw' npm run seed:admin -- appwired@gmail.com
```

The script:
- Creates the auth user (or updates the existing one's password if email already exists)
- Sets `email_confirm: true` so they can sign in immediately without clicking the email link
- Sets `is_admin = true` and `tier = 'lifetime'` on the profile

Sign in at `/login` with the email/password you just set.

## Architecture notes

- **Schema invariant:** base facts only on `flights`. Never add per-role or per-regime columns. Use `flight_field_values` for regime-specific extras.
- **Auth flow:** middleware (`middleware.ts`) refreshes the session on every request and gates `/app/*` routes. Login/signup redirect to `/app` on success.
- **Server-side data fetching:** all dashboard pages are React Server Components and use `lib/supabase/server.ts`. RLS makes this safe — no manual `where user_id = auth.uid()` filters needed.
- **Brand:** "Pilot Logbook HQ" with sky-300 "HQ" accent, matches the personal-app branding.

## Migrating data from the personal app

When ready, you'll be able to:
1. Export your `~/pilot-logbook/data/logbook.db` flights as CSV (use the Import / Export page in the personal app)
2. Sign in to Pilot Logbook HQ
3. Use the (Week 2) Import flow to load the CSV

The personal app stays running for daily use until the cloud version is solid.

## Where to go next

Week 2 priorities, ordered:
1. **Add/edit flight form** (port from `~/pilot-logbook/src/pages/FlightForm.tsx`)
2. **CSV import** (port from `~/pilot-logbook/server/csv.ts`)
3. **Stripe checkout** + webhook handler for tier upgrades
4. **PDF export** (port `~/pilot-logbook/src/pdf/LogbookPDF.tsx`)
5. **Charts** (port `~/pilot-logbook/src/pages/Charts.tsx`)

Week 3:
- Multi-regime currency rules (CARs 700.15 + ICAO equivalent)
- Per-regime PDF templates
- Regime selector at signup

Week 4:
- Deploy to Vercel
- Custom domain (you have logbookhq.com or similar)
- Marketing copy polish
- Open beta with 5-10 international pilots

Good luck. Ship it.
