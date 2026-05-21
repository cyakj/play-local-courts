-- Allow platform reviewers to view profiles of HOA applicants
CREATE POLICY "Platform reviewers can view HOA applicant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'platform_reviewer'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.hoa_applications a
    WHERE a.applicant_id = profiles.id
  )
);