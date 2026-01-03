-- Allow applicants to resubmit their own HOA application after a reviewer requests more info
-- They may only update when the current status is needs_more_info or rejected, and the new status must be pending.
CREATE POLICY "Applicants can resubmit applications"
ON public.hoa_applications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = applicant_id
  AND status IN ('needs_more_info', 'rejected')
)
WITH CHECK (
  auth.uid() = applicant_id
  AND status = 'pending'
);