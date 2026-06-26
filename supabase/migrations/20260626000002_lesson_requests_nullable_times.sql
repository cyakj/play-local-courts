-- preferred_time_start/end are optional in the lesson booking flow:
-- step 3 is best-effort and the UI tells users "the coach will coordinate a time."
-- NOT NULL on these columns caused a silent "Could not send request" error.
ALTER TABLE public.lesson_requests
  ALTER COLUMN preferred_time_start DROP NOT NULL,
  ALTER COLUMN preferred_time_end   DROP NOT NULL;
