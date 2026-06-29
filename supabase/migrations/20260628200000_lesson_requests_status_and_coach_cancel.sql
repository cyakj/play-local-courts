-- Extend lesson_requests status constraint to include all statuses used by the app.
-- The original migration only allowed: pending, accepted, declined, completed, cancelled.
-- The app now uses: approved, confirmed, coach_cancelled, no_show, expired, counter_proposed.
-- Drop and recreate so the constraint stays coherent.

ALTER TABLE public.lesson_requests
  DROP CONSTRAINT IF EXISTS lesson_requests_status_check;

ALTER TABLE public.lesson_requests
  ADD CONSTRAINT lesson_requests_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'confirmed',
    'accepted',
    'declined',
    'completed',
    'cancelled',
    'coach_cancelled',
    'no_show',
    'expired',
    'counter_proposed'
  ));
