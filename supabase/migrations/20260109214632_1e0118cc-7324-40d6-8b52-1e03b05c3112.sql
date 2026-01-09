-- Fix community_join_requests RLS policies to use hoa_memberships instead of profiles
DROP POLICY IF EXISTS "HOA admins can view requests for their communities" ON public.community_join_requests;
DROP POLICY IF EXISTS "HOA admins can update requests for their communities" ON public.community_join_requests;

-- Create new policies using check_hoa_admin function
CREATE POLICY "HOA admins can view requests for their communities v2"
ON public.community_join_requests
FOR SELECT
USING (check_hoa_admin(auth.uid(), hoa_id));

CREATE POLICY "HOA admins can update requests for their communities v2"
ON public.community_join_requests
FOR UPDATE
USING (check_hoa_admin(auth.uid(), hoa_id));