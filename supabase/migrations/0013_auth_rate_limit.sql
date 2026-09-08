-- Server-side rate limiting for the auth endpoints.
--
-- Replaces the rejected CAPTCHA experiment. Turnstile locked out privacy-
-- conscious users (VPNs, blockers) behind Supabase's server-side enforcement;
-- this limiter stops the same abuse it was there for — password-reset
-- mailbombing and login brute-force — WITHOUT ever hard-blocking a legitimate
-- user's environment. It is defense-in-depth: the application layer fails OPEN
-- if this function is unavailable (see lib/rate-limit.ts), so a DB hiccup can
-- never lock a pilot out of their own login.
--
-- Storage is fixed-window counters in Postgres — no new infra, we already run
-- Supabase.
--
-- Design:
--   * `auth_rate_limit` holds one counter row per (bucket, window_start).
--     RLS is ON with NO policies, so neither anon nor authenticated can read
--     or write it directly. The ONLY access is through check_rate_limit()
--     below — a SECURITY DEFINER function owned by postgres that bypasses RLS.
--   * A "bucket" is an opaque, server-chosen string, e.g. "login:ip:1.2.3.4"
--     or "pwreset:email:pilot@example.com". The client never supplies it.
--   * Windows are fixed: the current window start is floor(epoch / W) * W, so
--     every attempt inside a window increments the same row. Old windows are
--     self-expiring — they are simply never queried again — and the function
--     also trims this bucket's stale windows so the table cannot grow without
--     bound. No cron needed.
--
-- Idempotent: safe to re-run.

create table if not exists public.auth_rate_limit (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

-- RLS on + zero policies = the table is invisible to anon and authenticated.
-- Only the SECURITY DEFINER function (owned by postgres) reaches it.
alter table public.auth_rate_limit enable row level security;

-- Atomically bump the counter for `p_bucket` in the current fixed window and
-- report whether the caller is still under the limit.
--
--   returns true  = allowed (count after this attempt <= p_max)
--   returns false = blocked (count after this attempt >  p_max)
--
-- SECURITY DEFINER + owned by postgres so the body bypasses the table's RLS;
-- the pinned search_path stops `auth_rate_limit` resolving anywhere but
-- `public`. Callers get EXECUTE on the function; the table itself stays
-- private.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  -- Start of the current fixed window: floor(epoch / W) * W.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Bound table growth: drop this bucket's windows older than 4 windows back.
  -- Those are never read again, so this is pure cleanup; it touches only rows
  -- for this bucket and is covered by the primary-key index, so it is cheap.
  delete from public.auth_rate_limit
   where bucket = p_bucket
     and window_start < v_window_start - make_interval(secs => p_window_seconds * 4);
  -- A bucket hit once and never again would never be reaped by the line above,
  -- so ~1% of calls also sweep every window older than a day, table-wide. Cheap
  -- in aggregate, no cron/extension needed. (SQL random(), not JS.)
  if random() < 0.01 then
    delete from public.auth_rate_limit where window_start < now() - interval '1 day';
  end if;

  -- Increment (or create) the counter for this window, atomically.
  insert into public.auth_rate_limit (bucket, window_start, count)
    values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = auth_rate_limit.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- Own the function by postgres so SECURITY DEFINER bypasses RLS on the table.
alter function public.check_rate_limit(text, int, int) owner to postgres;

-- The function is the ONLY exposed surface; the counter table stays private.
-- Not callable by anon/authenticated: only the server actions, via the
-- service-role key, may increment a counter. Exposing this to anon would let
-- anyone with the public anon key forge a p_bucket and exhaust a chosen
-- victim's login/reset counter (targeted lockout).
revoke all on function public.check_rate_limit(text, int, int) from public;
revoke all on function public.check_rate_limit(text, int, int) from anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
