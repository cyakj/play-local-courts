
-- Allow newly registered users to insert their own maintenance_workers record
CREATE POLICY "Users can insert their own worker profile"
ON public.maintenance_workers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow newly registered users to insert their own maintenance_worker_communities
CREATE POLICY "Users can insert their own worker community links"
ON public.maintenance_worker_communities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.maintenance_workers mw
    WHERE mw.id = worker_id AND mw.user_id = auth.uid()
  )
);

-- Allow users to insert their own maintenance_worker role
CREATE POLICY "Users can insert own maintenance_worker role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'maintenance_worker');

-- Allow workers to view their own worker profile
CREATE POLICY "Workers can view own worker profile"
ON public.maintenance_workers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow workers to view their own community links
CREATE POLICY "Workers can view own community links"
ON public.maintenance_worker_communities
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.maintenance_workers mw
    WHERE mw.id = worker_id AND mw.user_id = auth.uid()
  )
);

-- Allow HOA admins to view and manage worker community links for their HOA
CREATE POLICY "HOA admins can manage worker communities"
ON public.maintenance_worker_communities
FOR ALL
TO authenticated
USING (check_hoa_admin(auth.uid(), hoa_id))
WITH CHECK (check_hoa_admin(auth.uid(), hoa_id));

-- Allow HOA admins to view workers linked to their communities
CREATE POLICY "HOA admins can view workers in their community"
ON public.maintenance_workers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.maintenance_worker_communities mwc
    WHERE mwc.worker_id = id AND check_hoa_admin(auth.uid(), mwc.hoa_id)
  )
);

-- Allow HOA admins to update worker status
CREATE POLICY "HOA admins can update workers in their community"
ON public.maintenance_workers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.maintenance_worker_communities mwc
    WHERE mwc.worker_id = id AND check_hoa_admin(auth.uid(), mwc.hoa_id)
  )
);
