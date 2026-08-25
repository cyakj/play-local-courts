-- Greens V1 functional audit fix: hoa_notifications had no ownership/admin
-- check on INSERT at all (with_check was the literal `true`), so any
-- authenticated resident could write an hoa_notifications row for any other
-- user_id in any HOA -- including ones they don't belong to -- with an
-- arbitrary title/body and any of the allowed `type` values (e.g.
-- 'announcement', 'booking_cancelled', 'health_score_alert'). That's a
-- notification-spoofing / cross-HOA isolation hole.
--
-- Verified live: as the plain resident test account (28-027@sanignacio.pr,
-- not an admin anywhere), an INSERT of a fake 'announcement' row targeting
-- the admin test account's user_id succeeded with the pre-fix policy
-- (rolled back, not persisted).
--
-- All 10 current call sites (BlockoutSheet, SetMaintenanceSheet,
-- CMReportDetail, CM calendar/community/survey screens) are admin-only
-- broadcasts and always set hoa_id, so scoping INSERT to
-- check_hoa_admin(auth.uid(), hoa_id) matches real usage with no
-- behavior change for legitimate callers.

DROP POLICY IF EXISTS "System can insert notifications" ON public.hoa_notifications;
CREATE POLICY "HOA admins can insert notifications for their HOA"
  ON public.hoa_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    hoa_id IS NOT NULL
    AND public.check_hoa_admin(auth.uid(), hoa_id)
  );
