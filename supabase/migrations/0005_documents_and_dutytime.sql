-- Tier 1 additions:
--   1. duty_time on flights — for airline duty-time tracking (CARs 700.16, FAR 117)
--   2. documents table  — medical, license, type ratings, IPC, recurrent with expiry
--   3. avatar_url on profiles — profile photo for PDF cover + UI
--
-- All ALTER/CREATE are idempotent — safe to re-run.

-- 1. Duty time
alter table public.flights add column if not exists duty_time numeric(5,1) not null default 0 check (duty_time >= 0);

-- 2. Documents
create table if not exists public.documents (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'MEDICAL','LICENSE','TYPE_RATING','IPC','RECURRENT','PASSPORT','VISA','OTHER'
  )),
  name text not null,
  reference text,                -- e.g. license number, medical class
  issued_on date,
  expires_on date,
  storage_path text not null,    -- key in Supabase Storage bucket "documents"
  mime_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_user_expires on public.documents(user_id, expires_on);

alter table public.documents enable row level security;

drop policy if exists "users see own documents" on public.documents;
drop policy if exists "users insert own documents" on public.documents;
drop policy if exists "users update own documents" on public.documents;
drop policy if exists "users delete own documents" on public.documents;

create policy "users see own documents"
  on public.documents for select using (auth.uid() = user_id);
create policy "users insert own documents"
  on public.documents for insert with check (auth.uid() = user_id);
create policy "users update own documents"
  on public.documents for update using (auth.uid() = user_id);
create policy "users delete own documents"
  on public.documents for delete using (auth.uid() = user_id);

-- 3. Profile photo
alter table public.profiles add column if not exists avatar_url text;

-- Run this AFTER the SQL above succeeds — creates the storage buckets the
-- documents + avatars UI write to. Cannot be in this migration because
-- storage admin runs via a separate API path; instead, do it in the dashboard:
--
--   Supabase → Storage → Create bucket
--     Bucket: "documents"   (private)
--     Bucket: "avatars"     (public)
--
-- The app's RLS already restricts who can read/write each row in `documents`;
-- the bucket being private means signed URLs are required to fetch files.
