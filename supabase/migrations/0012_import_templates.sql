-- Import templates: a remembered column mapping keyed by the fingerprint of
-- the workbook's header paths. When a user uploads a file whose header
-- fingerprint matches one of their templates (or a system template), the
-- import wizard applies the saved mapping and skips the review step.
--
--   user_id null  = system template (seeded by admins, readable by everyone)
--   user_id set   = the user's own template (private)
--
-- Idempotent: safe to re-run.

create table if not exists public.import_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,   -- null = system template
  fingerprint text not null,
  name text not null,
  mapping jsonb not null,
  header_paths jsonb not null,
  uses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One system template per fingerprint; one template per (user, fingerprint).
create unique index if not exists idx_import_templates_system_fingerprint
  on public.import_templates (fingerprint) where user_id is null;
create unique index if not exists idx_import_templates_user_fingerprint
  on public.import_templates (user_id, fingerprint) where user_id is not null;

-- Reuse the shared updated_at trigger function from 0001_init.sql.
drop trigger if exists trg_import_templates_updated on public.import_templates;
create trigger trg_import_templates_updated
  before update on public.import_templates
  for each row execute procedure public.set_updated_at();

alter table public.import_templates enable row level security;

drop policy if exists "users see own or system templates" on public.import_templates;
drop policy if exists "users insert own templates" on public.import_templates;
drop policy if exists "users update own templates" on public.import_templates;
drop policy if exists "users delete own templates" on public.import_templates;

-- select: own rows or system rows; insert/update/delete: own rows only.
create policy "users see own or system templates"
  on public.import_templates for select using (auth.uid() = user_id or user_id is null);
create policy "users insert own templates"
  on public.import_templates for insert with check (auth.uid() = user_id);
create policy "users update own templates"
  on public.import_templates for update using (auth.uid() = user_id);
create policy "users delete own templates"
  on public.import_templates for delete using (auth.uid() = user_id);
