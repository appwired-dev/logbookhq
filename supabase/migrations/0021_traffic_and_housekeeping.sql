-- 0021_traffic_and_housekeeping.sql
-- Admin "Traffic" + "Maintenance".
--  * traffic_daily: first-party, cookieless page-view counters stored ONLY as
--    per-UTC-day totals of single dimensions, plus one source→landing-page pair
--    ("flow", arrivals only) for the admin flow diagram. No per-visit rows, IP,
--    user-agent, visitor hash or user id. Written by /api/view via record_page_view().
--  * admin_audit_log: who changed what (ids and counts only). Also the heartbeat of
--    the nightly housekeeping run.
--  * support_requests.resolved_at: retention keys on resolution, not submission.
--  * traffic_report / run_housekeeping / admin_purge: service-role only.
--  * pg_cron: nightly retention at 03:15 UTC, cron-log prune at 03:20 UTC.
-- Tables follow 0010/0013 (RLS on, zero policies) and also revoke the default
-- anon/authenticated grants. Functions follow 0013 (owner postgres, revoke from
-- public/anon/authenticated, execute for service_role). No SECURITY DEFINER.
-- Apply to remote only with MCP apply_migration (never `supabase db push`).
-- Idempotent: safe to re-run.

-- 1) Daily counters ------------------------------------------------------------
create table if not exists public.traffic_daily (
  day      date    not null,                          -- UTC day
  dim      text    not null check (dim in ('page','source','campaign','country','device','flow')),
  value    text    not null check (char_length(value) between 1 and 220),
  views    integer not null default 0 check (views >= 0),
  landings integer not null default 0 check (landings >= 0),
  primary key (day, dim, value)
);
alter table public.traffic_daily enable row level security;          -- zero policies
revoke all on table public.traffic_daily from anon, authenticated;

-- 2) Admin audit log -------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id   uuid references auth.users(id) on delete set null,   -- null = scheduled job or deleted admin
  action     text not null check (char_length(action) <= 64 and action ~ '^[a-z_]+\.[a-z_]+$'),
  target     text check (target is null or char_length(target) <= 128),  -- uuid / support id; NEVER an email
  detail     jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 4096)
);
create index if not exists admin_audit_log_created_idx        on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_action_created_idx on public.admin_audit_log (action, created_at desc);
create index if not exists admin_audit_log_actor_idx          on public.admin_audit_log (actor_id);  -- FK index
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from anon, authenticated;

-- 3) Support resolution timestamp ------------------------------------------------
alter table public.support_requests add column if not exists resolved_at timestamptz;
update public.support_requests set resolved_at = created_at
 where status = 'resolved' and resolved_at is null;

-- 4) Ingest: exactly one RPC per counted page view (service role) ----------------
create or replace function public.record_page_view(
  p_page text, p_landing boolean, p_source text, p_campaign text, p_country text, p_device text
) returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_landing boolean := coalesce(p_landing, false);
  v_l int := case when coalesce(p_landing, false) then 1 else 0 end;
  v_flow text;
begin
  -- Defence in depth; the route already normalised everything.
  if p_page is null or char_length(p_page) > 100
     or p_page !~ '^(/[-a-z0-9/_\[\]]*|\(not found\))$' then return; end if;
  if p_device is null or p_device not in ('mobile','tablet','desktop') then p_device := 'desktop'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then p_country := 'XX'; end if;
  if v_landing then
    p_source   := coalesce(nullif(left(p_source, 100), ''), '(direct)');
    p_campaign := nullif(left(p_campaign, 100), '');
  else
    p_source := null; p_campaign := null;        -- per-visit dims recorded on arrivals only
  end if;
  -- Flood ceiling: stop counting for the rest of the UTC day at 20 000 views.
  if (select coalesce(sum(views), 0) from traffic_daily where day = v_day and dim = 'page') >= 20000 then return; end if;
  -- Cardinality caps: a spoofed beacon cannot mint unbounded rows.
  if p_source is not null
     and not exists (select 1 from traffic_daily where day = v_day and dim = 'source' and value = p_source)
     and (select count(*) from traffic_daily where day = v_day and dim = 'source') >= 100 then p_source := '(other)'; end if;
  if p_campaign is not null
     and not exists (select 1 from traffic_daily where day = v_day and dim = 'campaign' and value = p_campaign)
     and (select count(*) from traffic_daily where day = v_day and dim = 'campaign') >= 50 then p_campaign := '(other)'; end if;
  if p_source is not null then
    v_flow := p_source || ' → ' || p_page;
    if not exists (select 1 from traffic_daily where day = v_day and dim = 'flow' and value = v_flow)
       and (select count(*) from traffic_daily where day = v_day and dim = 'flow') >= 200 then
      v_flow := '(other) → ' || p_page;
    end if;
  end if;
  insert into traffic_daily as t (day, dim, value, views, landings)
  select v_day, d.dim, d.value, 1, v_l
    from (values ('page', p_page), ('country', p_country), ('device', p_device),
                 ('source', p_source), ('campaign', p_campaign), ('flow', v_flow)) as d(dim, value)
   where d.value is not null
  on conflict (day, dim, value)
  do update set views = t.views + 1, landings = t.landings + excluded.landings;
end;
$$;

-- 5) Report: one jsonb for the Traffic tab (no PostgREST 1000-row cap) ----------
--    series/prev_series: daily page views + arrivals for the window and the one before.
--    top: up to 25 rows per dimension, every country (globe), up to 500 flows (Sankey + its
--    cross-filtered lists, so focused totals match the Sources list; ≤ 101 sources × 17 pages a day).
create or replace function public.traffic_report(p_days int)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$
  with b as (select (now() at time zone 'utc')::date as today,
                    greatest(1, least(coalesce(p_days, 30), 366)) as n),
  cur  as (select t.* from traffic_daily t, b where t.day >  b.today - b.n),
  prev as (select t.* from traffic_daily t, b where t.day >  b.today - 2 * b.n and t.day <= b.today - b.n),
  ranked as (
    select dim, value, sum(views)::int as views, sum(landings)::int as landings,
           row_number() over (partition by dim order by sum(landings) desc, sum(views) desc, value) as rn
      from cur group by dim, value)
  select jsonb_build_object(
    'days',  (select n from b),
    'today', (select today from b),
    'series', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', v, 'landings', l) order by day)
                          from (select day, sum(views)::int v, sum(landings)::int l
                                  from cur where dim = 'page' group by day) s), '[]'::jsonb),
    'prev_series', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', v, 'landings', l) order by day)
                               from (select day, sum(views)::int v, sum(landings)::int l
                                       from prev where dim = 'page' group by day) s), '[]'::jsonb),
    'totals',   (select jsonb_build_object('views', coalesce(sum(views),0), 'landings', coalesce(sum(landings),0)) from cur  where dim = 'page'),
    'previous', (select jsonb_build_object('views', coalesce(sum(views),0), 'landings', coalesce(sum(landings),0)) from prev where dim = 'page'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('dim', dim, 'value', value, 'views', views, 'landings', landings) order by dim, rn)
                       from ranked
                      where dim = 'country' or (dim = 'flow' and rn <= 500) or (dim not in ('country','flow') and rn <= 25)), '[]'::jsonb),
    'capped_days', coalesce((select jsonb_agg(day order by day)
                               from (select day from cur where dim = 'page' group by day having sum(views) >= 20000) c), '[]'::jsonb));
$$;

-- 6) Housekeeping: one rule list shared by dry-run (preview) and the real run ----
create or replace function public.run_housekeeping(p_actor uuid default null, p_dry_run boolean default false)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_today  date  := (now() at time zone 'utc')::date;
  v_counts jsonb := '{}'::jsonb;
  v_errors jsonb := '{}'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  t record;
  n bigint;
begin
  -- Each rule runs in its own sub-transaction: a failure is recorded and the rest still run.
  begin  -- rate_limit: longest window in use is 3600 s; check_rate_limit reads only the current window
    if p_dry_run then select count(*) into n from auth_rate_limit where window_start < now() - interval '1 day';
    else delete from auth_rate_limit where window_start < now() - interval '1 day'; get diagnostics n = row_count; end if;
    v_counts := v_counts || jsonb_build_object('rate_limit', n);
  exception when others then v_errors := v_errors || jsonb_build_object('rate_limit', left(sqlerrm, 200)); end;
  begin  -- traffic: 13 months (395 days)
    if p_dry_run then select count(*) into n from traffic_daily where day < v_today - 395;
    else delete from traffic_daily where day < v_today - 395; get diagnostics n = row_count; end if;
    v_counts := v_counts || jsonb_build_object('traffic', n);
  exception when others then v_errors := v_errors || jsonb_build_object('traffic', left(sqlerrm, 200)); end;
  begin  -- stripe_events: 90 days. NEVER below 30 (Stripe CLI resend reaches 30 d; 0010 idempotency)
    if p_dry_run then select count(*) into n from stripe_processed_events where processed_at < now() - interval '90 days';
    else delete from stripe_processed_events where processed_at < now() - interval '90 days'; get diagnostics n = row_count; end if;
    v_counts := v_counts || jsonb_build_object('stripe_events', n);
  exception when others then v_errors := v_errors || jsonb_build_object('stripe_events', left(sqlerrm, 200)); end;
  begin  -- support_resolved: 365 days after resolution; literal 'resolved' only; open is never touched
    if p_dry_run then select count(*) into n from support_requests
       where status = 'resolved' and coalesce(resolved_at, created_at) < now() - interval '365 days';
    else delete from support_requests
       where status = 'resolved' and coalesce(resolved_at, created_at) < now() - interval '365 days';
       get diagnostics n = row_count; end if;
    v_counts := v_counts || jsonb_build_object('support_resolved', n);
  exception when others then v_errors := v_errors || jsonb_build_object('support_resolved', left(sqlerrm, 200)); end;
  begin  -- audit: 13 months (395 days)
    if p_dry_run then select count(*) into n from admin_audit_log where created_at < now() - interval '395 days';
    else delete from admin_audit_log where created_at < now() - interval '395 days'; get diagnostics n = row_count; end if;
    v_counts := v_counts || jsonb_build_object('audit', n);
  exception when others then v_errors := v_errors || jsonb_build_object('audit', left(sqlerrm, 200)); end;

  if not p_dry_run then   -- heartbeat (unwrapped on purpose: if it fails, cron.job_run_details shows the failure)
    insert into admin_audit_log (actor_id, action, detail)
    values (p_actor,
            case when p_actor is null then 'housekeeping.scheduled' else 'housekeeping.manual' end,
            v_counts || case when v_errors = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('errors', v_errors) end);
  end if;
  -- Storage readout (dry run only): the planner's row estimate where it has one; a table never
  -- sampled reports reltuples = -1, so count it exactly (only small/new tables are unsampled).
  if p_dry_run then
    for t in select c.oid, c.relname, c.reltuples
               from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              where ns.nspname = 'public' and c.relkind = 'r'
              order by pg_total_relation_size(c.oid) desc loop
      if t.reltuples >= 0 then n := t.reltuples::bigint;
      else execute format('select count(*) from public.%I', t.relname) into n; end if;
      v_tables := v_tables || jsonb_build_array(jsonb_build_object(
        'name', t.relname, 'bytes', pg_total_relation_size(t.oid), 'est_rows', n));
    end loop;
  end if;
  return jsonb_build_object(
    'counts', v_counts, 'errors', v_errors,
    'db_bytes', pg_database_size(current_database()),
    'tables', case when p_dry_run then v_tables end);
end;
$$;

-- 7) Manual purges: floors in SQL, audit row in the SAME transaction ------------
create or replace function public.admin_purge(p_kind text, p_days int, p_dry_run boolean, p_actor uuid default null)
returns bigint language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_today date := (now() at time zone 'utc')::date; n bigint;
begin
  if p_kind = 'support_resolved' then                -- returns number of requests
    if p_days is null or p_days < 30 or p_days > 3650 then raise exception 'below_floor' using errcode = '22023'; end if;
    if p_dry_run then
      select count(*) into n from support_requests
       where status = 'resolved' and coalesce(resolved_at, created_at) < now() - make_interval(days => p_days);
    else
      delete from support_requests
       where status = 'resolved' and coalesce(resolved_at, created_at) < now() - make_interval(days => p_days);
      get diagnostics n = row_count;
    end if;
  elsif p_kind = 'traffic' then                      -- returns number of DAYS; p_days = 0 means all
    if p_days is null or p_days < 0 or p_days > 3650 then raise exception 'below_floor' using errcode = '22023'; end if;
    if p_dry_run then
      select count(distinct day) into n from traffic_daily where p_days = 0 or day < v_today - p_days;
    else
      with d as (delete from traffic_daily where p_days = 0 or day < v_today - p_days returning day)
      select count(distinct day) into n from d;
    end if;
  else
    raise exception 'unknown_kind' using errcode = '22023';
  end if;
  if not p_dry_run then
    insert into admin_audit_log (actor_id, action, detail)
    values (p_actor, case p_kind when 'support_resolved' then 'support.purge' else 'traffic.purge' end,
            jsonb_build_object('days', p_days, 'deleted', n));
  end if;
  return n;
end;
$$;

-- 8) Function security (0013 pattern) --------------------------------------------
alter function public.record_page_view(text, boolean, text, text, text, text) owner to postgres;
revoke all on function public.record_page_view(text, boolean, text, text, text, text) from public;
revoke all on function public.record_page_view(text, boolean, text, text, text, text) from anon, authenticated;
grant execute on function public.record_page_view(text, boolean, text, text, text, text) to service_role;

alter function public.traffic_report(int) owner to postgres;
revoke all on function public.traffic_report(int) from public;
revoke all on function public.traffic_report(int) from anon, authenticated;
grant execute on function public.traffic_report(int) to service_role;

alter function public.run_housekeeping(uuid, boolean) owner to postgres;
revoke all on function public.run_housekeeping(uuid, boolean) from public;
revoke all on function public.run_housekeeping(uuid, boolean) from anon, authenticated;
grant execute on function public.run_housekeeping(uuid, boolean) to service_role;

alter function public.admin_purge(text, int, boolean, uuid) owner to postgres;
revoke all on function public.admin_purge(text, int, boolean, uuid) from public;
revoke all on function public.admin_purge(text, int, boolean, uuid) from anon, authenticated;
grant execute on function public.admin_purge(text, int, boolean, uuid) to service_role;

-- 9) Scheduling. cron.schedule upserts by job name, so this block is re-runnable.
--    Never call cron.unschedule unguarded (it raises when the job is missing).
--    Guarded rollback: select cron.unschedule(jobid) from cron.job where jobname like 'logbookhq-%';
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('logbookhq-housekeeping',   '15 3 * * *', $$select public.run_housekeeping(null, false)$$);
select cron.schedule('logbookhq-cron-log-prune', '20 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$);
-- Jobs run as postgres (current_user when the migration is applied); cron.timezone = GMT.
-- The second job exists because service_role has no privileges on schema cron.
