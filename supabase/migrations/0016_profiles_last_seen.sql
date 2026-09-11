-- Admin-only "last active" signal: when each pilot last opened the app.
-- Written best-effort (service-role) from the app shell on load; surfaced only
-- in /app/admin. Backfilled from auth.users.last_sign_in_at so the column is
-- not empty for existing users on first deploy.
--
-- No grant/RLS changes: the write and the admin read both go through the
-- service-role client, which bypasses the column privileges set in 0015.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

update public.profiles p
set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and p.last_seen_at is null
  and u.last_sign_in_at is not null;
