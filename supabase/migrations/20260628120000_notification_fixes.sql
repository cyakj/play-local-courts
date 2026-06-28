-- Fix email_reminders_sent: constraint allows only 'booking','lesson','match'
-- but send-scheduled-reminders uses 'booking_1h','booking_24h', etc.
-- This caused silent INSERT failures and duplicate reminder emails.
ALTER TABLE public.email_reminders_sent
  DROP CONSTRAINT IF EXISTS email_reminders_sent_event_type_check;

ALTER TABLE public.email_reminders_sent
  ADD CONSTRAINT email_reminders_sent_event_type_check
  CHECK (event_type IN (
    'booking','lesson','match',
    'booking_1h','booking_24h',
    'lesson_1h','lesson_24h',
    'match_1h','match_24h',
    'message'
  ));

-- Throttle table for message email notifications (30-min per conversation)
CREATE TABLE IF NOT EXISTS public.message_email_throttle (
  user1_id  UUID NOT NULL,
  user2_id  UUID NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user1_id, user2_id),
  CONSTRAINT canonical_pair CHECK (user1_id < user2_id)
);

ALTER TABLE public.message_email_throttle ENABLE ROW LEVEL SECURITY;

-- Only the edge function (service role) reads/writes this table
CREATE POLICY "Service role manages message throttle"
  ON public.message_email_throttle
  FOR ALL
  USING (true)
  WITH CHECK (true);
