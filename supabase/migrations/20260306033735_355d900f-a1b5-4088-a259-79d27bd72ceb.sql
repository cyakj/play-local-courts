
-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "HOA admins can view workers in their community" ON public.maintenance_workers;
DROP POLICY IF EXISTS "HOA admins can update workers in their community" ON public.maintenance_workers;
DROP POLICY IF EXISTS "Workers can view own community links" ON public.maintenance_worker_communities;

-- Create a security definer function to check if a user is a worker
CREATE OR REPLACE FUNCTION public.is_own_worker(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_workers
    WHERE id = _worker_id AND user_id = auth.uid()
  )
$$;

-- Create a security definer function to check if admin has workers in their HOA
CREATE OR REPLACE FUNCTION public.is_worker_in_admin_hoa(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_worker_communities mwc
    WHERE mwc.worker_id = _worker_id
    AND public.check_hoa_admin(auth.uid(), mwc.hoa_id)
  )
$$;

-- Recreate worker community links policy using security definer
CREATE POLICY "Workers can view own community links"
ON public.maintenance_worker_communities
FOR SELECT
TO authenticated
USING (public.is_own_worker(worker_id));

-- Recreate admin policies for maintenance_workers using security definer
CREATE POLICY "HOA admins can view workers in their community"
ON public.maintenance_workers
FOR SELECT
TO authenticated
USING (public.is_worker_in_admin_hoa(id));

CREATE POLICY "HOA admins can update workers in their community"
ON public.maintenance_workers
FOR UPDATE
TO authenticated
USING (public.is_worker_in_admin_hoa(id));
