# Pilot Logbook HQ

Multi-regime pilot logbook SaaS. The logbook that doesn't treat international pilots as second-class.

**Status:** Week 1 of 4-6 week MVP scaffold. Auth + protected app routes + multi-tenant schema + RLS are in. Add/edit forms, charts, PDF, Stripe come in Weeks 2-3. See [SETUP.md](SETUP.md) for setup, [PLAN.md](#) for week-by-week plan (TBD).

**Pricing:** $1/mo · $10/yr · $99 lifetime · Free up to 100 flights.

**Wedge:** International pilots — FAA→ICAO converters, EASA pilots flying for Gulf carriers, third-country license holders. Multi-regime, clean UX, 1/10th the price of LogTen Pro.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Stripe (TBD) · Vercel (TBD).

## Quick start

```sh
npm install
cp .env.example .env.local
# Fill in Supabase credentials — see SETUP.md
npm run dev
```

Open http://localhost:3000.

## Sister project

[`~/pilot-logbook`](../pilot-logbook) — local-first single-user prototype. Founder dogfoods daily. Schema, PDF generator, currency widget, charts all proven there first. Reuse aggressively here.
