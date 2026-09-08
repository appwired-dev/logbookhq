-- In-app support inbox — the free support channel (no third-party help desk).
--
-- A signed-in pilot submits a message from Settings → it lands here. The
-- founder reads open requests in the admin area (or Supabase Studio) and
-- replies by email. Storage is one Postgres table we already run — no new
-- infra, no per-seat SaaS.
--
-- Idempotent: safe to re-run.

create table if not exists public.support_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  email       text,
  subject     text,
  message     text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

create index if not exists support_requests_status_created_idx
  on public.support_requests (status, created_at desc);

alter table public.support_requests enable row level security;

-- Base grants (RLS still gates every row).
grant insert, select on public.support_requests to authenticated;

-- A pilot may file a request as themselves…
drop policy if exists support_insert_own on public.support_requests;
create policy support_insert_own on public.support_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- …and read their own, while admins can read every request.
drop policy if exists support_select_own_or_admin on public.support_requests;
create policy support_select_own_or_admin on public.support_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Admins can update status (open → closed) on any request.
drop policy if exists support_update_admin on public.support_requests;
create policy support_update_admin on public.support_requests
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
grant update (status) on public.support_requests to authenticated;
