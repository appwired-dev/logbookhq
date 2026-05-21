# Deploying Pilot Logbook HQ to Vercel

After the local dev setup in [SETUP.md](SETUP.md), here's how to push to production.

## Pre-flight

1. **Build passes locally:**

   ```sh
   cd ~/logbookhq
   npm run build
   ```

   Should end with a route table and no errors. If it fails, fix before deploying.

2. **`.env.local` is in `.gitignore`** ✓ (already done — your Supabase keys are not in git)

3. **Buy `logbookhq.com`** (or your domain of choice) if you haven't.

## Step 1 — Push to GitHub

Vercel deploys from a Git repo.

```sh
cd ~/logbookhq
git init
git add .
git commit -m "Initial commit"
gh repo create logbookhq --private --source=. --push
```

(Or create the repo via github.com UI and push manually.)

## Step 2 — Create Vercel project

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → pick your `logbookhq` repo
3. Framework Preset auto-detects as **Next.js** — keep it
4. **Root Directory:** `.` (default)
5. **Build Command:** `npm run build` (default)
6. **Output Directory:** `.next` (default)

## Step 3 — Set environment variables

Before deploying, click **Environment Variables** in the Vercel project setup and add:

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env.local` | Production, Preview |

⚠️ Do NOT prefix the service-role key with `NEXT_PUBLIC_` — that would expose it to browsers.

## Step 4 — Deploy

Click **Deploy**. Wait ~1-2 minutes. You'll get a `logbookhq-xxxx.vercel.app` URL.

Visit it. Sign in with your account (same Supabase project = same users). Verify your 2,644 flights show up.

## Step 5 — Hook up your custom domain

In Vercel project → **Settings → Domains**:
1. Add `logbookhq.com` (or whatever you bought)
2. Vercel shows DNS records to configure at your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.):
   - **A** record `@` → `76.76.21.21`
   - **CNAME** `www` → `cname.vercel-dns.com`
3. Wait for DNS propagation (a few minutes to a few hours)
4. Vercel auto-issues a Let's Encrypt SSL cert

## Step 6 — Update Supabase Auth redirect URLs

So your production app can complete the auth flow:

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://logbookhq.com`
- **Redirect URLs:** add `https://logbookhq.com/**` and `https://*.vercel.app/**`

## Step 7 — Re-enable email confirmation (production)

In Supabase → **Authentication → Providers → Email**, turn **Confirm email** back ON.
(You disabled it for local dev in SETUP.md step 4. For real users, you want confirmation.)

Configure your SMTP in Supabase Settings → Auth → SMTP, or use Supabase's built-in
email (low daily limit — fine for early beta, upgrade later).

## Step 8 — Smoke test

- Sign up with a fresh email at `https://logbookhq.com/signup`
- Confirm via email
- Sign in → land in `/app`
- Add a flight → it shows up
- Sign out → can't reach `/app` anymore

## Ongoing

- **Push to `main`** auto-deploys to production
- **Push to any other branch** deploys to a preview URL (great for trying features without breaking prod)
- **Database migrations** still run via Supabase SQL Editor — not auto-deployed by Vercel

## What's NOT deployed-ready yet

- **Stripe billing** — endpoint stubs only; need to wire checkout sessions + webhooks before charging anyone.
- **Email confirmation flow polish** — works but the confirmation email is plain.
- **Rate limiting** — RLS gives you tenancy isolation, but no per-user rate limits. Vercel's edge functions have generous defaults; add `@upstash/ratelimit` if abuse appears.
- **Backups** — Supabase Free tier does daily backups (retained 7 days). Pro tier adds PITR.
- **Custom email sender domain** — `noreply@logbookhq.com` requires SMTP setup. Worth doing before launch so emails don't go to spam.
