-- Explicit Data API grants for every public table.
--
-- From 2026-10-30 Supabase no longer grants anon/authenticated/service_role access to tables
-- created in "public" automatically. Production keeps the grants it has, but a database rebuilt
-- from these migrations (a preview branch, `supabase db reset`, a new project) would leave the
-- tables unreachable through supabase-js. This states, table by table, exactly the grants
-- production holds today (read from information_schema on 2026-10-20), so a rebuild matches it.
-- Row-level security still decides which rows each role sees; these grants change nothing in
-- production.
--
-- profiles: no table-wide UPDATE for anon/authenticated — 0015 grants authenticated UPDATE on
-- the editable columns only. admin_audit_log and traffic_daily: service_role only (0021).
-- A NEW TABLE needs its own grants in the migration that creates it.

grant select, insert, update, delete, truncate, references, trigger
  on table public.airports, public.auth_rate_limit, public.documents, public.field_definitions,
           public.flight_field_values, public.flights, public.import_templates,
           public.stripe_processed_events, public.support_requests
  to anon, authenticated, service_role;

grant select, insert, delete, truncate, references, trigger on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger on table public.profiles to service_role;

grant select, insert, update, delete, truncate, references, trigger
  on table public.admin_audit_log, public.traffic_daily
  to service_role;
