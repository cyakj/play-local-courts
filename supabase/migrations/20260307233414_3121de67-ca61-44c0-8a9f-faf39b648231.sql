-- Allow authenticated users to insert new HOAs (for Add Community)
CREATE POLICY "Authenticated users can create communities"
ON public.hoas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow admin to update their HOA
CREATE POLICY "Admins can update their HOA"
ON public.hoas
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid());
