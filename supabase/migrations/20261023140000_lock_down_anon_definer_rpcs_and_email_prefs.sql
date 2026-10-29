-- Security hardening found by the read-only advisor pass on the hosted project (NOT APPLIED - non-production first).
--
-- 1. get_email_preferences / create_default_email_preferences are SECURITY DEFINER, take a caller-supplied
--    target_user_id, never check who is calling, and were executable by anon. Anyone holding the public API key could
--    read (or create rows for) any user's email-notification settings by guessing a user id. They now refuse a signed-in
--    caller asking about someone else, and anon can no longer execute them.
-- 2. 40+ other SECURITY DEFINER RPC/trigger functions in public were executable by anon through Supabase's default
--    grants. They already reject callers with no auth.uid(), so this is defence in depth: anon can no longer call them.
--    RLS helper functions (has_role, is_in_same_hoa, check_hoa_admin, ...) and the intentionally public invite/survey
--    lookups are left alone on purpose; handle_new_user (auth signup trigger) is left alone to avoid any signup risk.
-- 3. migrate_existing_hoa_memberships() was a one-time backfill that anon and authenticated could still call.
--
-- update_email_preference(uuid, text, boolean) exists on the hosted database but in no migration file, so its body cannot
-- be reviewed or replaced here. Only anon is revoked; whether it checks the caller is a PENDING item (see RLS-AUDIT.md).
--
-- Authenticated access is PRESERVED per function (re-granted only where it existed before; never expanded).
-- Behaviour change: none for signed-in users acting on their own data. Anonymous API calls to these functions fail 42501.
-- Rollback: GRANT EXECUTE ON FUNCTION <name> TO anon; (and re-create the two email functions from 20260115024246).

CREATE OR REPLACE FUNCTION public.get_email_preferences(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  booking_confirmations boolean,
  booking_reminders boolean,
  cancellation_notifications boolean,
  admin_announcements boolean,
  lesson_confirmations boolean,
  lesson_reminders boolean,
  match_confirmations boolean,
  match_reminders boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Signed-in callers may only read their own row. A NULL auth.uid() means a trusted server-side caller; anon has no EXECUTE.
  IF auth.uid() IS NOT NULL AND auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    ep.id,
    ep.user_id,
    ep.booking_confirmations,
    ep.booking_reminders,
    ep.cancellation_notifications,
    ep.admin_announcements,
    ep.lesson_confirmations,
    ep.lesson_reminders,
    ep.match_confirmations,
    ep.match_reminders,
    ep.created_at,
    ep.updated_at
  FROM email_preferences ep
  WHERE ep.user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_email_preferences(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  booking_confirmations boolean,
  booking_reminders boolean,
  cancellation_notifications boolean,
  admin_announcements boolean,
  lesson_confirmations boolean,
  lesson_reminders boolean,
  match_confirmations boolean,
  match_reminders boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO email_preferences (user_id, booking_confirmations, booking_reminders, cancellation_notifications, admin_announcements, lesson_confirmations, lesson_reminders, match_confirmations, match_reminders)
  VALUES (target_user_id, true, true, true, true, true, true, true, true)
  RETURNING email_preferences.id INTO new_id;

  RETURN QUERY
  SELECT
    ep.id,
    ep.user_id,
    ep.booking_confirmations,
    ep.booking_reminders,
    ep.cancellation_notifications,
    ep.admin_announcements,
    ep.lesson_confirmations,
    ep.lesson_reminders,
    ep.match_confirmations,
    ep.match_reminders,
    ep.created_at,
    ep.updated_at
  FROM email_preferences ep
  WHERE ep.id = new_id;
END;
$$;

-- Revoke anon (and the implicit PUBLIC grant) on every overload of each named function. Names that do not exist on a
-- given database are skipped, so this is safe on hosted-only drift.
DO $revoke$
DECLARE
  fn record;
  had_authenticated boolean;
  names text[] := ARRAY['admin_blockout_conflicts', 'admin_create_blockout', 'approve_hoa_membership', 'approve_match_participant',
    'assign_coach_role', 'check_competition_create_permission', 'create_competition_ladder',
    'create_default_email_preferences', 'create_maintenance_report', 'create_match_listing',
    'deprecate_report_admin_notes', 'enforce_amenity_booking_rules', 'enforce_booking_cancellation_window',
    'enforce_booking_status_transitions', 'generate_round_robin_matches', 'get_coaches_near', 'get_email_preferences',
    'guard_court_maintenance_change', 'guard_membership_admin_changes', 'guard_message_update',
    'guard_platform_reviewer_role', 'hoa_is_approved', 'log_court_maintenance_change', 'match_tenisx_contacts',
    'migrate_existing_hoa_memberships', 'notify_admins_on_member_application', 'notify_admins_on_report',
    'notify_applicant_on_membership_change', 'notify_booker_on_booking', 'notify_booker_on_booking_status',
    'notify_reporter_on_public_note', 'notify_reporter_on_status_change', 'prevent_notification_content_changes',
    'prevent_profile_sensitive_changes', 'regenerate_invite_code', 'reject_hoa_membership', 'request_hoa_membership',
    'request_join_community', 'set_active_hoa', 'update_email_preference'];
BEGIN
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (names)
  LOOP
    -- Captured BEFORE the revoke: includes access inherited through PUBLIC. Authenticated is only re-granted where it
    -- already had EXECUTE, so a function an earlier migration deliberately closed to signed-in users stays closed.
    had_authenticated := has_function_privilege('authenticated', fn.oid, 'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    IF had_authenticated AND fn.proname <> 'migrate_existing_hoa_memberships' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    END IF;
    -- Trusted server code keeps the access it had through PUBLIC.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', fn.sig, 'service' || '_role');
    -- One-time backfill: nobody should be able to re-run it through the API (handled here so a missing function is skipped).
    IF fn.proname = 'migrate_existing_hoa_memberships' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.sig);
    END IF;
  END LOOP;
END
$revoke$;
