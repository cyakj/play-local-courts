-- coach_global_hours: per-day outer boundary for coaching
CREATE TABLE IF NOT EXISTS public.coach_global_hours (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week     INT         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME        NOT NULL DEFAULT '07:00',
  end_time        TIME        NOT NULL DEFAULT '20:00',
  is_closed       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, day_of_week)
);

ALTER TABLE public.coach_global_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own global hours"
  ON public.coach_global_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view global hours"
  ON public.coach_global_hours FOR SELECT
  USING (true);

-- coach_facility_hours: fixed facility teaching windows
CREATE TABLE IF NOT EXISTS public.coach_facility_hours (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_name     TEXT        NOT NULL,
  facility_address  TEXT,
  court_type        TEXT,
  days_of_week      INT[]       NOT NULL DEFAULT '{}',
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  publicly_bookable BOOLEAN     NOT NULL DEFAULT true,
  notes             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_facility_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own facility hours"
  ON public.coach_facility_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view public facility hours"
  ON public.coach_facility_hours FOR SELECT
  USING (publicly_bookable = true OR coach_id = auth.uid());

-- coach_travel_hours: travel availability windows
-- travel_base_address is intentionally NOT stored here (privacy);
-- use coaches.home_base or a private field on profiles instead.
CREATE TABLE IF NOT EXISTS public.coach_travel_hours (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_radius_miles INT,
  areas_served      TEXT[]      DEFAULT '{}',
  days_of_week      INT[]       NOT NULL DEFAULT '{}',
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  publicly_bookable BOOLEAN     NOT NULL DEFAULT true,
  travel_notes      TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_travel_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own travel hours"
  ON public.coach_travel_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view public travel hours"
  ON public.coach_travel_hours FOR SELECT
  USING (publicly_bookable = true OR coach_id = auth.uid());

-- coach_blockouts: time-based blockouts (lunch, personal, etc.)
-- Separate from coach_unavailability which handles date-range vacation/tournament blocks.
-- Recurring: set days_of_week + start_time + end_time, leave specific_date null.
-- Date-specific: set specific_date + start_time + end_time, leave days_of_week null.
CREATE TABLE IF NOT EXISTS public.coach_blockouts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN (
                   'lunch','personal','tournament','vacation',
                   'facility_unavailable','travel_time','other')),
  title          TEXT,
  days_of_week   INT[]       DEFAULT NULL,
  start_time     TIME,
  end_time       TIME,
  specific_date  DATE        DEFAULT NULL,
  visibility     TEXT        NOT NULL DEFAULT 'private'
                   CHECK (visibility IN ('private','show_as_unavailable')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_blockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own blockouts"
  ON public.coach_blockouts FOR ALL
  USING (coach_id = auth.uid());
