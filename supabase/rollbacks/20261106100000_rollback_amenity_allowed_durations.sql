-- Rollback for 20261106100000_amenity_allowed_durations.sql. Drops only objects that migration created.
-- Data loss: the three list columns (admin-chosen allowed durations) are discarded; the legacy cap columns are untouched.
DROP TRIGGER IF EXISTS enforce_allowed_durations_trg ON public.bookings;
DROP FUNCTION IF EXISTS public.enforce_allowed_durations();
ALTER TABLE public.amenity_rules DROP CONSTRAINT IF EXISTS amenity_rules_allowed_durations_check;
ALTER TABLE public.amenity_rules
  DROP COLUMN IF EXISTS allowed_durations,
  DROP COLUMN IF EXISTS singles_allowed_durations,
  DROP COLUMN IF EXISTS doubles_allowed_durations;
DROP FUNCTION IF EXISTS public.amenity_duration_list_valid(integer[]);
