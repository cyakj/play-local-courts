CREATE TABLE IF NOT EXISTS public.coach_schedule_private_settings (
  coach_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_base_address TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_schedule_private_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches select own private schedule settings"
  ON public.coach_schedule_private_settings;
CREATE POLICY "Coaches select own private schedule settings"
  ON public.coach_schedule_private_settings
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches insert own private schedule settings"
  ON public.coach_schedule_private_settings;
CREATE POLICY "Coaches insert own private schedule settings"
  ON public.coach_schedule_private_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches update own private schedule settings"
  ON public.coach_schedule_private_settings;
CREATE POLICY "Coaches update own private schedule settings"
  ON public.coach_schedule_private_settings
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches delete own private schedule settings"
  ON public.coach_schedule_private_settings;
CREATE POLICY "Coaches delete own private schedule settings"
  ON public.coach_schedule_private_settings
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());
