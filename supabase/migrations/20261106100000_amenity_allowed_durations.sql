-- Amenity-specific allowed reservation durations.   NOT APPLIED to hosted (TENISX REAL).
--
-- Until now the server only enforced a CAP (tennis: singles/doubles minutes; everything else: max_duration_minutes), so an HOA
-- could not say "Pool A: 60 only, Pool C: 60 or 90, Clubhouse: 120/180/240" or give Singles and Doubles independent lists.
-- This adds three OPTIONAL explicit lists. NULL (the default for every existing row) = not configured = the existing cap
-- behaviour is unchanged. Nothing is back-filled and no existing configuration is replaced.
--
--   allowed_durations           non-racquet amenities (pool, clubhouse, meeting room ...)
--   singles_allowed_durations   tennis / pickleball, Singles
--   doubles_allowed_durations   tennis / pickleball, Doubles
--
-- Enforcement is a separate BEFORE INSERT trigger so enforce_amenity_booking_rules (redefined by several migrations, last by
-- hoa_timezones) is NOT copied or touched. It runs in addition to the cap, never instead of it. The admin app also keeps the
-- legacy cap columns in step with the longest listed value so both checks agree.
-- Depends on: public.amenity_rules, public.courts, public.bookings (play_type). No dependency on any other pending migration.
-- Existing amenity_rules RLS (admin write, member read) is column-agnostic and is not changed.

ALTER TABLE public.amenity_rules
  ADD COLUMN IF NOT EXISTS allowed_durations integer[],
  ADD COLUMN IF NOT EXISTS singles_allowed_durations integer[],
  ADD COLUMN IF NOT EXISTS doubles_allowed_durations integer[];

CREATE OR REPLACE FUNCTION public.amenity_duration_list_valid(p integer[])
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT p IS NULL OR (
    cardinality(p) BETWEEN 1 AND 12
    AND array_ndims(p) = 1
    AND NOT EXISTS (SELECT 1 FROM unnest(p) AS d WHERE d IS NULL OR d < 15 OR d > 480 OR d % 15 <> 0)
  );
$$;

ALTER TABLE public.amenity_rules DROP CONSTRAINT IF EXISTS amenity_rules_allowed_durations_check;
ALTER TABLE public.amenity_rules
  ADD CONSTRAINT amenity_rules_allowed_durations_check CHECK (
    public.amenity_duration_list_valid(allowed_durations)
    AND public.amenity_duration_list_valid(singles_allowed_durations)
    AND public.amenity_duration_list_valid(doubles_allowed_durations)
  );

CREATE OR REPLACE FUNCTION public.enforce_allowed_durations()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  r public.amenity_rules%ROWTYPE;
  ctype text;
  minutes integer;
  allowed integer[];
BEGIN
  SELECT * INTO r FROM public.amenity_rules WHERE amenity_id = NEW.court_id LIMIT 1;
  IF r.id IS NULL THEN RETURN NEW; END IF;

  SELECT lower(court_type::text) INTO ctype FROM public.courts WHERE id = NEW.court_id;
  IF ctype IN ('tennis', 'pickleball') THEN
    allowed := CASE WHEN NEW.play_type = 'doubles' THEN r.doubles_allowed_durations ELSE r.singles_allowed_durations END;
  ELSE
    allowed := r.allowed_durations;
  END IF;
  IF allowed IS NULL THEN RETURN NEW; END IF;   -- not configured: the existing cap alone applies

  minutes := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::integer;
  IF NOT (minutes = ANY (allowed)) THEN
    RAISE EXCEPTION 'This amenity only allows reservations of % minutes', array_to_string(allowed, ' or ')
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger functions are not callable through the API.
REVOKE ALL ON FUNCTION public.enforce_allowed_durations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_allowed_durations_trg ON public.bookings;
CREATE TRIGGER enforce_allowed_durations_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_allowed_durations();
