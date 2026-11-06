-- Defence in depth (NOT APPLIED to hosted). Ten SECURITY DEFINER helpers that exist only for RLS policies / signed-in flows are
-- executable by anon through Supabase's default grants. Five of them take a caller-supplied user id and answer "is this user an
-- admin / in the same community / affiliated / holding role X", so an anonymous holder of the public API key could probe
-- membership and role relationships for any user id they know (UUIDs are not guessable, so this is low severity).
-- None of these is referenced by a policy that anon can reach (verified on a restore: supabase/tests/anon_helper_execute.sql
-- compares anon reads of every public table before and after). Signed-in (authenticated) access is unchanged; the policies keep working.
-- Deliberately NOT touched: check_hoa_admin, can_view_ladder, is_ladder_admin (referenced by policies granted to PUBLIC on tables anon can
-- read, so revoking would turn an empty anon result into a permission error), get_public_hoa_invite_by_code (anonymous invite landing),
-- get_public_survey_results / get_survey_member_count (guarded by auth.uid(), return nothing to anon), clinic_enrollment_counts
-- (aggregate counts only), handle_new_user and sweep_expired_before_booking_insert (trigger functions, cannot be called as RPC).
-- Rollback: GRANT EXECUTE ON FUNCTION <name> TO anon;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.is_admin_in_same_hoa(uuid, uuid)',
    'public.is_hoa_affiliated(uuid)',
    'public.is_in_same_hoa(uuid, uuid)',
    'public.can_create_ladder(uuid, uuid)',
    'public.can_view_ladder_row(uuid, uuid, uuid)',
    'public._is_listing_creator(uuid)',
    'public._is_listing_participant(uuid)',
    'public._listing_open_for_join(uuid)',
    'public._listing_readable(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
