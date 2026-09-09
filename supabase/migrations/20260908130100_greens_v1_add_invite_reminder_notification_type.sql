-- community/[hoaId].tsx resendInvite() inserts type='invite_reminder' into hoa_notifications,
-- which was rejected by hoa_notifications_type_check (not in the allowed enum), breaking
-- Resend Invite for every admin. Widening the CHECK is additive/safe: no existing row uses
-- a value being removed, only a new value is being permitted.
alter table public.hoa_notifications drop constraint hoa_notifications_type_check;

alter table public.hoa_notifications add constraint hoa_notifications_type_check
  check (type = ANY (ARRAY[
    'report_submitted','report_status_changed','report_unresolved',
    'member_application','member_approved','member_rejected',
    'booking_confirmed','booking_cancelled','booking_reminder',
    'health_score_alert','announcement','survey_published','survey_reminder',
    'event_created','event_reminder','invite_reminder'
  ]::text[]));
