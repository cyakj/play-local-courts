-- Create table to track sent email reminders (prevent duplicates)
CREATE TABLE public.email_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('booking', 'lesson', 'match')),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_type, event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.email_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Create policy - service role can insert/select (edge function uses service role)
CREATE POLICY "Service role can manage email reminders"
ON public.email_reminders_sent
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_email_reminders_event ON public.email_reminders_sent(event_type, event_id);