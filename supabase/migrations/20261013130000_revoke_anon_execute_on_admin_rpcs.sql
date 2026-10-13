-- Follow-up hardening (NOT APPLIED — needs approval).
--
-- Found by checking has_function_privilege('anon', ...) after applying 20261013110000 / 20261013120000:
-- Supabase grants EXECUTE on new public functions to its API roles (including anon) explicitly, so
-- `REVOKE ALL ... FROM PUBLIC` in 20261013110000 did not remove anon's grant. These functions already refuse a
-- caller with no auth.uid() ('Sign in required' / 'Not authorized'), so nothing is exploitable, but anonymous
-- users should not be able to call them at all. (20261013120000 revoked anon explicitly; its functions are fine.)
--
-- Behaviour change: none for signed-in users. Anonymous API calls to these three functions now fail with 42501.
-- Rollback: GRANT EXECUTE ON FUNCTION <same signatures> TO anon;

REVOKE EXECUTE ON FUNCTION public.admin_blockout_conflicts(uuid, date, date, time, time) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text) FROM anon;
-- Used inside RLS policies evaluated for signed-in users only; anon never needs it.
REVOKE EXECUTE ON FUNCTION public.hoa_is_approved(uuid) FROM anon;
