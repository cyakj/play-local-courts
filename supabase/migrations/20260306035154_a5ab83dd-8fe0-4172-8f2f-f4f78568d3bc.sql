
-- Drop all worker-related policies on maintenance_reports
DROP POLICY IF EXISTS "Workers can view assigned reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Workers can update assigned reports" ON public.maintenance_reports;

-- Drop all worker-related policies on maintenance_status_history
DROP POLICY IF EXISTS "Workers can view assigned status history" ON public.maintenance_status_history;
DROP POLICY IF EXISTS "Workers can insert status history" ON public.maintenance_status_history;
DROP POLICY IF EXISTS "Admins can view all status history" ON public.maintenance_status_history;
DROP POLICY IF EXISTS "Admins can insert status history" ON public.maintenance_status_history;
DROP POLICY IF EXISTS "Reporters can view own report history" ON public.maintenance_status_history;
DROP POLICY IF EXISTS "Authenticated can insert history" ON public.maintenance_status_history;

-- Now drop worker_id with CASCADE to catch any remaining deps
ALTER TABLE public.maintenance_reports DROP COLUMN IF EXISTS worker_id CASCADE;
ALTER TABLE public.maintenance_reports DROP COLUMN IF EXISTS cannot_complete_reason;
ALTER TABLE public.maintenance_reports DROP COLUMN IF EXISTS completion_photo_url;

-- Drop worker tables
DROP TABLE IF EXISTS public.maintenance_worker_communities CASCADE;
DROP TABLE IF EXISTS public.maintenance_workers CASCADE;

-- Drop status history table
DROP TABLE IF EXISTS public.maintenance_status_history CASCADE;
