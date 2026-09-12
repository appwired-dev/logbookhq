-- Perf: wrap auth.<fn>() in a scalar subselect so RLS evaluates it ONCE per
-- query (as an initplan) instead of once per row. Semantically identical, so
-- row isolation is unchanged. Resolves the auth_rls_initplan advisor and cuts
-- the dashboard's whole-logbook scan cost (a 2,600+ flight user was
-- re-evaluating auth.uid() per row). ALTER (not drop) so there is never a
-- window without the policy. Already applied to production.

alter policy "users delete own documents" on public.documents using (((select auth.uid()) = user_id));
alter policy "users insert own documents" on public.documents with check (((select auth.uid()) = user_id));
alter policy "users see own documents" on public.documents using (((select auth.uid()) = user_id));
alter policy "users update own documents" on public.documents using (((select auth.uid()) = user_id));

alter policy "all users read field defs" on public.field_definitions using (((select auth.role()) = 'authenticated'::text));

alter policy "users delete own field values" on public.flight_field_values using (((select auth.uid()) = user_id));
alter policy "users insert own field values" on public.flight_field_values with check (((select auth.uid()) = user_id));
alter policy "users see own field values" on public.flight_field_values using (((select auth.uid()) = user_id));
alter policy "users update own field values" on public.flight_field_values using (((select auth.uid()) = user_id));

alter policy "users delete own flights" on public.flights using (((select auth.uid()) = user_id));
alter policy "users insert own flights" on public.flights with check (((select auth.uid()) = user_id));
alter policy "users see own flights" on public.flights using (((select auth.uid()) = user_id));
alter policy "users update own flights" on public.flights using (((select auth.uid()) = user_id));

alter policy "users delete own templates" on public.import_templates using (((select auth.uid()) = user_id));
alter policy "users insert own templates" on public.import_templates with check (((select auth.uid()) = user_id));
alter policy "users see own or system templates" on public.import_templates using ((((select auth.uid()) = user_id) OR (user_id IS NULL)));
alter policy "users update own templates" on public.import_templates using (((select auth.uid()) = user_id));

alter policy "users see own profile" on public.profiles using (((select auth.uid()) = id));
alter policy "users update own profile" on public.profiles using (((select auth.uid()) = id)) with check (((select auth.uid()) = id));

alter policy "support_insert_own" on public.support_requests with check ((user_id = (select auth.uid())));
alter policy "support_select_own_or_admin" on public.support_requests using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND p.is_admin)))));
alter policy "support_update_admin" on public.support_requests using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND p.is_admin)))) with check ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND p.is_admin))));

create index if not exists idx_flight_field_values_field_id on public.flight_field_values (field_id);
create index if not exists idx_support_requests_user_id on public.support_requests (user_id);
