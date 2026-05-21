-- Public read-only share link for a pilot's logbook.
--
-- When a user opts in, we generate a random `share_token` and add it to
-- their profile. Anyone with the URL `/share/<token>` can view a read-only
-- snapshot — totals, charts, hour-per-type breakdown. No flight-level
-- pilot/route detail by default (PII concern), unless we extend later.
--
-- The token is the entire access secret. Rotating it invalidates the old
-- URL — useful when the recipient (examiner, employer, insurance) no
-- longer needs access.

alter table public.profiles
  add column if not exists share_token text unique;

create index if not exists idx_profiles_share_token
  on public.profiles(share_token) where share_token is not null;
