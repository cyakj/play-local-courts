-- lesson_packages: coach-defined offerings players can browse and book
CREATE TABLE public.lesson_packages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  lesson_type    TEXT        CHECK (lesson_type IN ('private', 'semi-private', 'group', 'junior')),
  duration_min   INTEGER     NOT NULL CHECK (duration_min > 0),
  price          NUMERIC     NOT NULL CHECK (price >= 0),
  num_sessions   INTEGER     NOT NULL DEFAULT 1 CHECK (num_sessions > 0),
  description    TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;

-- Coaches manage their own packages
CREATE POLICY "Coaches can manage their own packages"
  ON public.lesson_packages
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Any authenticated user can read active packages (marketplace browse)
CREATE POLICY "Anyone can view active packages"
  ON public.lesson_packages
  FOR SELECT
  USING (is_active = true);

CREATE INDEX idx_lesson_packages_coach_id ON public.lesson_packages(coach_id);
CREATE INDEX idx_lesson_packages_is_active ON public.lesson_packages(is_active);

CREATE TRIGGER update_lesson_packages_updated_at
  BEFORE UPDATE ON public.lesson_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
