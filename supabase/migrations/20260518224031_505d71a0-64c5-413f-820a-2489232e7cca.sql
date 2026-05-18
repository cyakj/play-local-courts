CREATE POLICY "Residents can view maintenance in their HOA"
ON public.court_maintenance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    JOIN courts ON courts.id = court_maintenance.court_id
    WHERE profiles.id = auth.uid()
      AND profiles.hoa_id = courts.hoa_id
  )
);