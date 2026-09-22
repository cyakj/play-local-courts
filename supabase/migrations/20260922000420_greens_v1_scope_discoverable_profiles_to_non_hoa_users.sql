-- Root cause: "Discoverable profiles visible to authenticated users" (USING
-- location_visible = true) has no HOA scoping at all, and is OR'd with the
-- correctly-scoped "Members can view profiles in same HOA" policy. Since
-- location_visible defaults true, this let ANY authenticated user read every
-- HOA member's full profile row platform-wide (phone_number, date_of_birth,
-- gender, zip_code, unit_number, latitude/longitude, hoa_id/hoa_role/
-- hoa_status included) via GET /rest/v1/profiles, regardless of HOA
-- membership. Live-proven with the resident test account: 7/7 profiles
-- returned, including another HOA's admin with their phone number.
--
-- This policy is also a real, live feature: Tennis mode's cross-community
-- "Find a Partner / Find a Coach" discovery (src/components/locker/
-- FindPartner.tsx et al.) intentionally shows opted-in, non-HOA tennis
-- players to any authenticated user. That must keep working.
--
-- Fix: a profile is only reachable through the discovery policy if its
-- owner has no *approved* HOA membership anywhere. Any HOA-affiliated user
-- (resident or admin) is no longer discoverable platform-wide and falls
-- back to being visible only via "Members can view profiles in same HOA"
-- (own profile / same-HOA member / admin of a shared HOA) — the existing,
-- already-correctly-scoped policy, left untouched.
--
-- is_hoa_affiliated() is SECURITY DEFINER (matching the existing
-- check_hoa_admin/is_in_same_hoa/is_admin_in_same_hoa pattern) because
-- hoa_memberships' own RLS ("Users can view their own memberships" /
-- "hoa_memberships_select_admin") would otherwise make a plain subquery
-- here invisible for every user except the caller themselves, silently
-- defeating this check for anyone else's membership.
CREATE OR REPLACE FUNCTION public.is_hoa_affiliated(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = _user_id
    AND status = 'approved'
  )
$function$;

ALTER POLICY "Discoverable profiles visible to authenticated users" ON public.profiles
USING (location_visible = true AND NOT public.is_hoa_affiliated(id));
