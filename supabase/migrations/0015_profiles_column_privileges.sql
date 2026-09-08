-- SECURITY FIX (critical). The only UPDATE policy on public.profiles was
--   create policy "users update own profile" ... for update using (auth.uid() = id);
-- with NO column restriction and NO with check. Supabase grants column UPDATE to
-- the `authenticated` role by default, and the anon key + a user JWT are exposed
-- in the browser — so any signed-in user could run, from devtools:
--   supabase.from('profiles').update({ tier:'lifetime', is_admin:true }).eq('id', uid)
-- self-granting a paid tier (paywall bypass) AND admin (full account takeover of
-- every user, since admin actions and page gate on profiles.is_admin).
--
-- Fix: column-level privileges. A pilot may only UPDATE the columns they
-- legitimately edit in Settings; tier, is_admin and stripe_customer_id are
-- written solely by the service-role client (Stripe webhook + admin actions),
-- which bypasses these grants. Row scope is re-asserted with a WITH CHECK.
--
-- Idempotent: safe to re-run.

-- Neither role should hold blanket UPDATE on this table.
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- Exactly the user-editable columns (see app/app/settings/actions.ts +
-- share-actions.ts). Anything not listed — tier, is_admin, stripe_customer_id,
-- id, email, created_at — stays service-role only.
grant update (full_name, license_number, primary_regime, aug_half_credit, avatar_url, share_token)
  on public.profiles to authenticated;

-- Re-create the row policy WITH CHECK so the target row can't be retargeted.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
