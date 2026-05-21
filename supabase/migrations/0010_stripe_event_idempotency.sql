-- Stripe webhook idempotency.
--
-- Stripe retries any webhook delivery that doesn't return 2xx, and can also
-- redeliver events manually from the dashboard. Without idempotency, a
-- redelivered `customer.subscription.deleted` for an old cancelled monthly
-- sub could downgrade a user who has since upgraded to lifetime.
--
-- The webhook handler INSERTs the event id BEFORE processing. A duplicate
-- delivery hits the unique constraint and we short-circuit with 200 OK so
-- Stripe stops retrying.
--
-- Idempotent: safe to re-run.

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Only the service-role client (used by /api/stripe/webhook) writes here;
-- regular users have no business reading it. Enable RLS with no policies
-- so authenticated/anon clients see an empty table.
alter table public.stripe_processed_events enable row level security;
