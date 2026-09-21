-- Root cause: a stale "Allow public read access to hoas" policy (USING true, role public)
-- let any authenticated (or anonymous) caller enumerate every HOA row via
-- GET /rest/v1/hoas?select=id,name, regardless of membership.
-- The legitimate pre-auth directory already goes through the SECURITY DEFINER
-- `public_hoa_directory` view (id, name, community_type only), which bypasses RLS
-- and is unaffected by this change. Authenticated access remains fully covered by
-- the existing "Users can view their HOA" and "Approved members can read full hoa
-- details" policies.
DROP POLICY IF EXISTS "Allow public read access to hoas" ON public.hoas;
