-- Explicit grants for the id sequences, completing 0022.
--
-- 0022 restated the table grants, but the sequences behind the id columns were still granted
-- only by Supabase's old default privileges. A database rebuilt from these migrations after
-- 2026-10-30 (preview branch, `supabase db reset`, a new project) would create them without
-- grants, and every insert into flights, documents or field_definitions — whose bigserial ids
-- call nextval() as the inserting role — would fail with "permission denied for sequence".
-- Supabase's published opt-in happens to leave UPDATE on sequences, which nextval() accepts;
-- this file stops relying on that.
--
-- As in 0022: exactly the grants production holds today (read from pg_class on 2026-10-20),
-- so applying this to production changes nothing. Identity columns (support_requests,
-- admin_audit_log) don't need sequence grants; theirs are restated so a rebuild matches.
-- A NEW SEQUENCE (or serial column) needs its grants in the migration that creates it.

grant usage, select, update
  on sequence public.flights_id_seq, public.documents_id_seq, public.field_definitions_id_seq,
              public.support_requests_id_seq
  to anon, authenticated, service_role;

grant usage, select, update on sequence public.admin_audit_log_id_seq to service_role;
