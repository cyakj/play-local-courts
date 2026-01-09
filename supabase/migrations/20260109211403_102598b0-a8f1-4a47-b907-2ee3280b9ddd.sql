-- Allow HOA admins to view profiles of users who have pending join requests to their HOA
CREATE POLICY "Admins can view profiles of join request applicants"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM community_join_requests cjr
    JOIN profiles admin_profile ON admin_profile.id = auth.uid()
    WHERE cjr.user_id = profiles.id
    AND cjr.hoa_id = admin_profile.hoa_id
    AND cjr.status = 'pending'
  )
);