-- Add scheduling and expiry fields to match_requests
ALTER TABLE public.match_requests
  ADD COLUMN IF NOT EXISTS duration          integer,
  ADD COLUMN IF NOT EXISTS message           text,
  ADD COLUMN IF NOT EXISTS availability_type text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS expires_at        timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '72 hours');
