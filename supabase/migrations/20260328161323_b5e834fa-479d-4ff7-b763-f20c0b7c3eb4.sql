
-- Add new columns to maintenance_reports
ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Create report_notes table for internal admin notes
CREATE TABLE IF NOT EXISTS public.report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report notes"
  ON public.report_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.hoa_memberships hm ON hm.hoa_id = mr.hoa_id
      WHERE mr.id = report_notes.report_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.hoa_memberships hm ON hm.hoa_id = mr.hoa_id
      WHERE mr.id = report_notes.report_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  );

-- Create report_messages table for admin-resident communication
CREATE TABLE IF NOT EXISTS public.report_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report messages"
  ON public.report_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.hoa_memberships hm ON hm.hoa_id = mr.hoa_id
      WHERE mr.id = report_messages.report_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.hoa_memberships hm ON hm.hoa_id = mr.hoa_id
      WHERE mr.id = report_messages.report_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  );

CREATE POLICY "Residents can read their report messages"
  ON public.report_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      WHERE mr.id = report_messages.report_id
        AND mr.reporter_id = auth.uid()
    )
  );
