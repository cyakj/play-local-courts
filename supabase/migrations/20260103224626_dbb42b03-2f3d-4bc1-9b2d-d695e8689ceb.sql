-- Allow applicants to read notes on their own HOA applications
CREATE POLICY "Applicants can view notes on their own applications"
ON public.hoa_application_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_applications a
    WHERE a.id = hoa_application_notes.application_id
      AND a.applicant_id = auth.uid()
  )
);