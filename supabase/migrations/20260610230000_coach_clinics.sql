-- ─── coach_clinics ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_clinics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  date             DATE NOT NULL,
  start_time       TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  location         TEXT NOT NULL,
  skill_min        NUMERIC(3,1),
  skill_max        NUMERIC(3,1),
  age_group        TEXT NOT NULL DEFAULT 'all'
                     CHECK (age_group IN ('junior', 'adult', 'all')),
  max_players      INTEGER NOT NULL CHECK (max_players > 0),
  price            NUMERIC(8,2),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'canceled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── clinic_enrollments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_enrollments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES public.coach_clinics(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'enrolled'
               CHECK (status IN ('enrolled', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, player_id)
);

CREATE INDEX IF NOT EXISTS clinic_enrollments_clinic_idx ON public.clinic_enrollments(clinic_id);
CREATE INDEX IF NOT EXISTS coach_clinics_coach_date_idx   ON public.coach_clinics(coach_id, date);
CREATE INDEX IF NOT EXISTS coach_clinics_status_date_idx  ON public.coach_clinics(status, date);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.coach_clinics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_enrollments  ENABLE ROW LEVEL SECURITY;

-- coach_clinics: public read of published rows
CREATE POLICY "published clinics are publicly readable"
  ON public.coach_clinics FOR SELECT
  USING (status = 'published');

-- coach_clinics: coaches can read ALL their own rows (any status)
CREATE POLICY "coaches read own clinics"
  ON public.coach_clinics FOR SELECT
  USING (coach_id = auth.uid());

-- coach_clinics: coaches can create
CREATE POLICY "coaches insert own clinics"
  ON public.coach_clinics FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- coach_clinics: coaches can update their own rows
CREATE POLICY "coaches update own clinics"
  ON public.coach_clinics FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- clinic_enrollments: players read their own enrollments
CREATE POLICY "players read own enrollments"
  ON public.clinic_enrollments FOR SELECT
  USING (player_id = auth.uid());

-- clinic_enrollments: coaches read all enrollments for their clinics (roster)
CREATE POLICY "coaches read clinic rosters"
  ON public.clinic_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clinics
      WHERE id = clinic_enrollments.clinic_id AND coach_id = auth.uid()
    )
  );

-- clinic_enrollments: players enroll themselves
CREATE POLICY "players enroll in clinics"
  ON public.clinic_enrollments FOR INSERT
  WITH CHECK (player_id = auth.uid());

-- clinic_enrollments: players cancel their own enrollment
CREATE POLICY "players cancel own enrollment"
  ON public.clinic_enrollments FOR UPDATE
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

-- ─── RPC: batch enrollment counts (no roster data exposed) ───────────────────
-- Returns (clinic_id, enrolled_count) for a list of clinic IDs.
-- SECURITY DEFINER so any authenticated caller can get counts
-- without reading clinic_enrollments directly (which would expose player_ids).
CREATE OR REPLACE FUNCTION public.clinic_enrollment_counts(clinic_ids UUID[])
RETURNS TABLE(clinic_id UUID, enrolled_count INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ce.clinic_id,
    COUNT(*)::INTEGER AS enrolled_count
  FROM clinic_enrollments ce
  WHERE ce.clinic_id = ANY(clinic_ids)
    AND ce.status = 'enrolled'
  GROUP BY ce.clinic_id;
$$;

GRANT EXECUTE ON FUNCTION public.clinic_enrollment_counts TO authenticated;

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER coach_clinics_updated_at
  BEFORE UPDATE ON public.coach_clinics
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER clinic_enrollments_updated_at
  BEFORE UPDATE ON public.clinic_enrollments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
