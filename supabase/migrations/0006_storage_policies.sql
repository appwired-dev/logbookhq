-- Storage RLS for "documents" and "avatars" buckets.
--
-- Migration 0005 created the public.documents table with row-level policies
-- but the actual file objects live in storage.objects, which has its own RLS.
-- Without these policies, uploads fail with:
--   "new row violates row-level security policy"
--
-- Path convention used by the app (documents/actions.ts, settings/actions.ts):
--   <bucket>/<user_id>/<filename>
-- So we authorize based on the first folder of the object's `name`.
--
-- IMPORTANT: storage.objects RLS policies must usually be applied via the
-- Supabase SQL editor (the storage schema is owned by supabase_storage_admin).
-- Paste this file into Supabase → SQL Editor → New Query → Run.

-- ============================================================
-- documents bucket — private, owner-only access
-- ============================================================
drop policy if exists "doc owner insert" on storage.objects;
drop policy if exists "doc owner select" on storage.objects;
drop policy if exists "doc owner update" on storage.objects;
drop policy if exists "doc owner delete" on storage.objects;

create policy "doc owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doc owner select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doc owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doc owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- avatars bucket — public read, owner-only write
-- ============================================================
drop policy if exists "avatar public read" on storage.objects;
drop policy if exists "avatar owner insert" on storage.objects;
drop policy if exists "avatar owner update" on storage.objects;
drop policy if exists "avatar owner delete" on storage.objects;

-- Public read so <img src> from the browser works without signing each URL.
create policy "avatar public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatar owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
