-- Correct the 0016 backfill. last_sign_in_at is stale for pilots with a
-- persistent session (they never re-authenticate), which made active users look
-- inactive. Use the most recent of sign-in AND session / refresh-token activity
-- (updated whenever the app silently refreshes) — a true "last used" signal.
--
-- greatest() ignores NULLs and never moves a value backward, so this is
-- idempotent and safe to run after the app has started writing last_seen_at
-- live (it will not override a more recent app-open write).
update public.profiles p
set last_seen_at = greatest(
  p.last_seen_at,
  u.last_sign_in_at,
  (select max(s.updated_at)  from auth.sessions s        where s.user_id  = p.id),
  (select max(rt.updated_at) from auth.refresh_tokens rt where rt.user_id = p.id::text)
)
from auth.users u
where u.id = p.id;
