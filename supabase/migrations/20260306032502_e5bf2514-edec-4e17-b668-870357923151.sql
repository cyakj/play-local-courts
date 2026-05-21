-- Phase 2: Maintenance Worker System Database Schema

-- 1. Add maintenance_worker to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'maintenance_worker';

-- 2. Create maintenance_workers table
CREATE TABLE public.maintenance_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  worker_type text NOT NULL CHECK (worker_type IN ('hoa_employee', 'independent_contractor')),
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  photo_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_workers ENABLE ROW LEVEL SECURITY;

-- Workers can view/update their own profile
CREATE POLICY "Workers can view own profile"
  ON public.maintenance_workers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Workers can update own profile"
  ON public.maintenance_workers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Workers can insert own profile"
  ON public.maintenance_workers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Create maintenance_worker_communities join table
CREATE TABLE public.maintenance_worker_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.maintenance_workers(id) ON DELETE CASCADE NOT NULL,
  hoa_id uuid REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, hoa_id)
);

ALTER TABLE public.maintenance_worker_communities ENABLE ROW LEVEL SECURITY;

-- Workers can view their own community memberships
CREATE POLICY "Workers can view own communities"
  ON public.maintenance_worker_communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_workers mw
      WHERE mw.id = maintenance_worker_communities.worker_id
        AND mw.user_id = auth.uid()
    )
  );

-- Workers can insert their own community memberships
CREATE POLICY "Workers can insert own communities"
  ON public.maintenance_worker_communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_workers mw
      WHERE mw.id = maintenance_worker_communities.worker_id
        AND mw.user_id = auth.uid()
    )
  );

-- HOA admins can view/update worker communities for their HOA
CREATE POLICY "Admins can view worker communities"
  ON public.maintenance_worker_communities FOR SELECT
  TO authenticated
  USING (check_hoa_admin(auth.uid(), hoa_id));

CREATE POLICY "Admins can update worker communities"
  ON public.maintenance_worker_communities FOR UPDATE
  TO authenticated
  USING (check_hoa_admin(auth.uid(), hoa_id));

-- 4. Add new columns to maintenance_reports
ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.maintenance_workers(id),
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_photo_url text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cannot_complete_reason text;

-- Workers can view reports assigned to them
CREATE POLICY "Workers can view assigned reports"
  ON public.maintenance_reports FOR SELECT
  TO authenticated
  USING (
    worker_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.maintenance_workers mw
      WHERE mw.id = maintenance_reports.worker_id
        AND mw.user_id = auth.uid()
    )
  );

-- Workers can update reports assigned to them (status changes)
CREATE POLICY "Workers can update assigned reports"
  ON public.maintenance_reports FOR UPDATE
  TO authenticated
  USING (
    worker_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.maintenance_workers mw
      WHERE mw.id = maintenance_reports.worker_id
        AND mw.user_id = auth.uid()
    )
  );

-- 5. Create maintenance_status_history table
CREATE TABLE public.maintenance_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.maintenance_reports(id) ON DELETE CASCADE NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_status_history ENABLE ROW LEVEL SECURITY;

-- Users can view status history for their own reports
CREATE POLICY "Reporters can view status history"
  ON public.maintenance_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      WHERE mr.id = maintenance_status_history.report_id
        AND mr.reporter_id = auth.uid()
    )
  );

-- Admins can view/insert status history for their HOA
CREATE POLICY "Admins can view status history"
  ON public.maintenance_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      WHERE mr.id = maintenance_status_history.report_id
        AND has_role(auth.uid(), 'admin'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.hoa_id = mr.hoa_id
        )
    )
  );

CREATE POLICY "Admins can insert status history"
  ON public.maintenance_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      WHERE mr.id = maintenance_status_history.report_id
        AND has_role(auth.uid(), 'admin'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.hoa_id = mr.hoa_id
        )
    )
  );

-- Workers can view/insert status history for their assigned reports
CREATE POLICY "Workers can view assigned status history"
  ON public.maintenance_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.maintenance_workers mw ON mw.id = mr.worker_id
      WHERE mr.id = maintenance_status_history.report_id
        AND mw.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can insert status history"
  ON public.maintenance_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      JOIN public.maintenance_workers mw ON mw.id = mr.worker_id
      WHERE mr.id = maintenance_status_history.report_id
        AND mw.user_id = auth.uid()
    )
  );

-- Admins can view workers in their communities
CREATE POLICY "Admins can view workers"
  ON public.maintenance_workers FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.maintenance_worker_communities mwc
      JOIN public.hoa_memberships hm ON hm.hoa_id = mwc.hoa_id
      WHERE mwc.worker_id = maintenance_workers.id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  );

-- Admins can update workers in their communities
CREATE POLICY "Admins can update workers"
  ON public.maintenance_workers FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.maintenance_worker_communities mwc
      JOIN public.hoa_memberships hm ON hm.hoa_id = mwc.hoa_id
      WHERE mwc.worker_id = maintenance_workers.id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  );

-- 6. Add updated_at trigger for maintenance_workers
CREATE TRIGGER update_maintenance_workers_updated_at
  BEFORE UPDATE ON public.maintenance_workers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();