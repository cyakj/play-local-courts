
DROP POLICY IF EXISTS "HOA admins can update reports for their HOA" ON maintenance_reports;

CREATE POLICY "HOA admins can update reports for their HOA"
ON maintenance_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hoa_memberships
    WHERE hoa_memberships.user_id = auth.uid()
      AND hoa_memberships.hoa_id = maintenance_reports.hoa_id
      AND hoa_memberships.role = 'admin'
      AND hoa_memberships.status = 'approved'
  )
);
