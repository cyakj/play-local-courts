CREATE TABLE IF NOT EXISTS public.coach_teaching_blocks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week          INT         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time           TIME        NOT NULL,
  end_time             TIME        NOT NULL,
  location_type        TEXT        NOT NULL CHECK (location_type IN ('facility', 'travel', 'either')),
  facility_name        TEXT,
  court_type           TEXT,
  travel_radius_miles  INT         CHECK (travel_radius_miles IS NULL OR travel_radius_miles > 0),
  areas_served         TEXT[]      NOT NULL DEFAULT '{}',
  travel_notes         TEXT,
  publicly_bookable    BOOLEAN     NOT NULL DEFAULT true,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (
    (location_type = 'facility' AND facility_name IS NOT NULL)
    OR (location_type = 'travel' AND travel_radius_miles IS NOT NULL)
    OR (
      location_type = 'either'
      AND facility_name IS NOT NULL
      AND travel_radius_miles IS NOT NULL
    )
  )
);

ALTER TABLE public.coach_teaching_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coach_teaching_blocks_coach_day_idx
  ON public.coach_teaching_blocks (coach_id, day_of_week, start_time);

DROP POLICY IF EXISTS "Coaches select own teaching blocks"
  ON public.coach_teaching_blocks;
CREATE POLICY "Coaches select own teaching blocks"
  ON public.coach_teaching_blocks
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches insert own teaching blocks"
  ON public.coach_teaching_blocks;
CREATE POLICY "Coaches insert own teaching blocks"
  ON public.coach_teaching_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches update own teaching blocks"
  ON public.coach_teaching_blocks;
CREATE POLICY "Coaches update own teaching blocks"
  ON public.coach_teaching_blocks
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches delete own teaching blocks"
  ON public.coach_teaching_blocks;
CREATE POLICY "Coaches delete own teaching blocks"
  ON public.coach_teaching_blocks
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_overlapping_coach_teaching_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1
    FROM public.coach_teaching_blocks existing
    WHERE existing.coach_id = NEW.coach_id
      AND existing.day_of_week = NEW.day_of_week
      AND existing.is_active
      AND existing.id <> NEW.id
      AND NEW.start_time < existing.end_time
      AND existing.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'Teaching blocks cannot overlap on the same day.'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_coach_teaching_block_overlap
  ON public.coach_teaching_blocks;

CREATE TRIGGER prevent_coach_teaching_block_overlap
  BEFORE INSERT OR UPDATE OF coach_id, day_of_week, start_time, end_time, is_active
  ON public.coach_teaching_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_overlapping_coach_teaching_blocks();

WITH facility_rows AS (
  SELECT
    facility.id,
    facility.coach_id,
    day_of_week,
    facility.start_time,
    facility.end_time,
    facility.facility_name,
    facility.court_type,
    facility.publicly_bookable,
    facility.created_at,
    facility.updated_at
  FROM public.coach_facility_hours facility
  CROSS JOIN LATERAL unnest(facility.days_of_week) AS day_of_week
  WHERE facility.is_active
    AND NULLIF(trim(facility.facility_name), '') IS NOT NULL
),
travel_rows AS (
  SELECT
    travel.id,
    travel.coach_id,
    day_of_week,
    travel.start_time,
    travel.end_time,
    travel.travel_radius_miles,
    travel.areas_served,
    travel.travel_notes,
    travel.publicly_bookable,
    travel.created_at,
    travel.updated_at
  FROM public.coach_travel_hours travel
  CROSS JOIN LATERAL unnest(travel.days_of_week) AS day_of_week
  WHERE travel.is_active
),
matched AS (
  SELECT DISTINCT ON (
    facility.coach_id,
    facility.day_of_week,
    facility.start_time,
    facility.end_time
  )
    facility.coach_id,
    facility.day_of_week,
    facility.start_time,
    facility.end_time,
    facility.facility_name,
    facility.court_type,
    travel.travel_radius_miles,
    COALESCE(travel.areas_served, '{}') AS areas_served,
    travel.travel_notes,
    facility.publicly_bookable AND travel.publicly_bookable AS publicly_bookable,
    LEAST(facility.created_at, travel.created_at) AS created_at,
    GREATEST(facility.updated_at, travel.updated_at) AS updated_at
  FROM facility_rows facility
  JOIN travel_rows travel
    ON travel.coach_id = facility.coach_id
   AND travel.day_of_week = facility.day_of_week
   AND travel.start_time = facility.start_time
   AND travel.end_time = facility.end_time
   AND travel.travel_radius_miles IS NOT NULL
  ORDER BY
    facility.coach_id,
    facility.day_of_week,
    facility.start_time,
    facility.end_time,
    facility.id,
    travel.id
),
backfill AS (
  SELECT
    matched.coach_id,
    matched.day_of_week,
    matched.start_time,
    matched.end_time,
    'either'::TEXT AS location_type,
    matched.facility_name,
    matched.court_type,
    matched.travel_radius_miles,
    matched.areas_served,
    matched.travel_notes,
    matched.publicly_bookable,
    matched.created_at,
    matched.updated_at,
    0 AS source_priority,
    concat('either:', matched.facility_name, ':', matched.start_time) AS source_key
  FROM matched

  UNION ALL

  SELECT
    facility.coach_id,
    facility.day_of_week,
    facility.start_time,
    facility.end_time,
    'facility'::TEXT,
    facility.facility_name,
    facility.court_type,
    NULL::INT,
    '{}'::TEXT[],
    NULL::TEXT,
    facility.publicly_bookable,
    facility.created_at,
    facility.updated_at,
    1 AS source_priority,
    concat('facility:', facility.id) AS source_key
  FROM facility_rows facility
  WHERE NOT EXISTS (
    SELECT 1
    FROM matched
    WHERE matched.coach_id = facility.coach_id
      AND matched.day_of_week = facility.day_of_week
      AND matched.start_time = facility.start_time
      AND matched.end_time = facility.end_time
  )

  UNION ALL

  SELECT
    travel.coach_id,
    travel.day_of_week,
    travel.start_time,
    travel.end_time,
    'travel'::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    travel.travel_radius_miles,
    COALESCE(travel.areas_served, '{}'),
    travel.travel_notes,
    travel.publicly_bookable,
    travel.created_at,
    travel.updated_at,
    2 AS source_priority,
    concat('travel:', travel.id) AS source_key
  FROM travel_rows travel
  WHERE travel.travel_radius_miles IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM matched
      WHERE matched.coach_id = travel.coach_id
        AND matched.day_of_week = travel.day_of_week
        AND matched.start_time = travel.start_time
        AND matched.end_time = travel.end_time
    )
)
INSERT INTO public.coach_teaching_blocks (
  coach_id,
  day_of_week,
  start_time,
  end_time,
  location_type,
  facility_name,
  court_type,
  travel_radius_miles,
  areas_served,
  travel_notes,
  publicly_bookable,
  created_at,
  updated_at
)
SELECT
  backfill.coach_id,
  backfill.day_of_week,
  backfill.start_time,
  backfill.end_time,
  backfill.location_type,
  backfill.facility_name,
  backfill.court_type,
  backfill.travel_radius_miles,
  backfill.areas_served,
  backfill.travel_notes,
  backfill.publicly_bookable,
  COALESCE(backfill.created_at, now()),
  COALESCE(backfill.updated_at, now())
FROM backfill
WHERE NOT EXISTS (
  SELECT 1
  FROM public.coach_teaching_blocks existing
  WHERE existing.coach_id = backfill.coach_id
    AND existing.day_of_week = backfill.day_of_week
    AND existing.start_time = backfill.start_time
    AND existing.end_time = backfill.end_time
)
AND NOT EXISTS (
  SELECT 1
  FROM backfill preferred
  WHERE preferred.coach_id = backfill.coach_id
    AND preferred.day_of_week = backfill.day_of_week
    AND preferred.start_time < backfill.end_time
    AND backfill.start_time < preferred.end_time
    AND (
      preferred.source_priority < backfill.source_priority
      OR (
        preferred.source_priority = backfill.source_priority
        AND preferred.source_key < backfill.source_key
      )
    )
);

CREATE OR REPLACE FUNCTION public.validate_coach_teaching_block_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  boundary public.coach_global_hours%ROWTYPE;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO boundary
  FROM public.coach_global_hours
  WHERE coach_id = NEW.coach_id
    AND day_of_week = NEW.day_of_week;

  IF NOT FOUND OR boundary.is_closed THEN
    RAISE EXCEPTION 'Teaching blocks require an active coaching boundary.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.start_time < boundary.start_time OR NEW.end_time > boundary.end_time THEN
    RAISE EXCEPTION 'Teaching blocks must stay inside the coaching boundary.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_coach_teaching_block_boundary
  ON public.coach_teaching_blocks;

CREATE TRIGGER validate_coach_teaching_block_boundary
  BEFORE INSERT OR UPDATE OF coach_id, day_of_week, start_time, end_time, is_active
  ON public.coach_teaching_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_coach_teaching_block_boundary();

CREATE OR REPLACE FUNCTION public.replace_own_coach_teaching_blocks(blocks JSONB)
RETURNS SETOF public.coach_teaching_blocks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  DELETE FROM public.coach_teaching_blocks
  WHERE coach_id = auth.uid();

  RETURN QUERY
  INSERT INTO public.coach_teaching_blocks (
    coach_id,
    day_of_week,
    start_time,
    end_time,
    location_type,
    facility_name,
    court_type,
    travel_radius_miles,
    areas_served,
    travel_notes,
    publicly_bookable,
    is_active
  )
  SELECT
    auth.uid(),
    (item->>'day_of_week')::INT,
    (item->>'start_time')::TIME,
    (item->>'end_time')::TIME,
    item->>'location_type',
    NULLIF(trim(item->>'facility_name'), ''),
    NULLIF(trim(item->>'court_type'), ''),
    NULLIF(item->>'travel_radius_miles', '')::INT,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'areas_served', '[]'::JSONB))),
      '{}'
    ),
    NULLIF(trim(item->>'travel_notes'), ''),
    COALESCE((item->>'publicly_bookable')::BOOLEAN, true),
    true
  FROM jsonb_array_elements(COALESCE(blocks, '[]'::JSONB)) AS item
  ORDER BY
    (item->>'day_of_week')::INT,
    (item->>'start_time')::TIME
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_own_coach_teaching_blocks(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_own_coach_teaching_blocks(JSONB) TO authenticated;
