-- Onboarding Phase 1: Resident signup -> community discovery -> membership request -> pending status.
-- NOT APPLIED to any hosted project. Review + apply deliberately (see docs/onboarding/PLAN.md).
--
-- Findings fixed here:
--  1. public_hoa_directory exposed EVERY hoas row (including pending/unapproved communities) to anon + authenticated.
--  2. request_hoa_membership / request_join_community are SECURITY DEFINER and ignored approval + email
--     verification, so they bypassed the (tightened) INSERT policies.
--  3. Direct resident writes to hoa_memberships / community_join_requests could desynchronize the two tables the
--     admin approval queue relies on (request visible in one, not the other). Request + withdraw are now RPC-only.
-- Admin policies (admin-creator insert, admin update/delete, admin select) are intentionally untouched.

-- 1. Discoverable communities = approved communities only (same columns as before).
CREATE OR REPLACE VIEW public.public_hoa_directory AS
SELECT id, name, community_type
FROM public.hoas
WHERE approval_status = 'approved';

GRANT SELECT ON public.public_hoa_directory TO anon;
GRANT SELECT ON public.public_hoa_directory TO authenticated;

-- 2. Verified-email helper (SECURITY DEFINER so it can read auth.users).
CREATE OR REPLACE FUNCTION public.user_email_verified()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT u.email_confirmed_at IS NOT NULL FROM auth.users u WHERE u.id = auth.uid()),
    false
  )
$$;
REVOKE ALL ON FUNCTION public.user_email_verified() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_email_verified() TO authenticated;

-- 3. The ONE supported way to request membership: guards first, then both rows atomically.
CREATE OR REPLACE FUNCTION public.request_hoa_membership(target_hoa_id UUID, join_message TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_membership_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_email_verified() THEN
    RAISE EXCEPTION 'Verify your email before requesting to join a community' USING ERRCODE = '42501';
  END IF;
  IF NOT public.hoa_is_approved(target_hoa_id) THEN
    RAISE EXCEPTION 'Community not found' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid() AND hoa_id = target_hoa_id
  ) THEN
    RAISE EXCEPTION 'Membership already exists for this HOA';
  END IF;

  -- A join request that was already reviewed (legacy rows can exist without a membership) must not be silently
  -- re-opened: community_join_requests is UNIQUE(user_id, hoa_id), so a new pending membership would be invisible to
  -- the admin queue. Re-requesting after a decision is a deferred product policy (see PLAN.md).
  IF EXISTS (
    SELECT 1 FROM public.community_join_requests
    WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Membership already exists for this HOA (previous request already reviewed)';
  END IF;

  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
  VALUES (auth.uid(), target_hoa_id, 'resident', 'pending')
  RETURNING id INTO new_membership_id;

  -- The admin approval queue (pending-requests.tsx) reads community_join_requests.
  INSERT INTO public.community_join_requests (user_id, hoa_id, message, status)
  VALUES (auth.uid(), target_hoa_id, left(join_message, 500), 'pending')
  ON CONFLICT DO NOTHING;

  RETURN new_membership_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_hoa_membership(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_hoa_membership(uuid, text) TO authenticated;

-- 4. Legacy entry point: same guards, both tables, returns the join-request id (legacy contract).
CREATE OR REPLACE FUNCTION public.request_join_community(target_hoa_id uuid, join_message text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_email_verified() THEN
    RAISE EXCEPTION 'Verify your email before requesting to join a community' USING ERRCODE = '42501';
  END IF;
  IF NOT public.hoa_is_approved(target_hoa_id) THEN
    RAISE EXCEPTION 'Community not found' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_join_requests
    WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Membership already exists for this HOA (previous request already reviewed)';
  END IF;

  -- A decided (approved / rejected) membership must not be re-opened through a fresh join request: the admin queue
  -- finds no PENDING membership for it and would only flip the request, leaving the resident stuck (review R10).
  IF EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Membership already exists for this HOA';
  END IF;

  SELECT id INTO request_id FROM public.community_join_requests
  WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status = 'pending'
  LIMIT 1;
  IF request_id IS NOT NULL THEN
    -- Already requested: idempotent. Legacy requests may lack the membership row; repair it so the
    -- status screen and the admin approve/reject RPCs (which act on memberships) both see the request.
    INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
    VALUES (auth.uid(), target_hoa_id, 'resident', 'pending')
    ON CONFLICT (user_id, hoa_id) DO NOTHING;
    RETURN request_id;
  END IF;

  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
  VALUES (auth.uid(), target_hoa_id, 'resident', 'pending')
  ON CONFLICT (user_id, hoa_id) DO NOTHING;

  INSERT INTO public.community_join_requests (user_id, hoa_id, message, status)
  VALUES (auth.uid(), target_hoa_id, left(join_message, 500), 'pending')
  RETURNING id INTO request_id;

  RETURN request_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.request_join_community(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_join_community(uuid, text) TO authenticated;

-- 5. Withdraw: only the caller's OWN *pending* request, in BOTH tables (no stale admin-queue row).
CREATE OR REPLACE FUNCTION public.withdraw_membership_request(target_hoa_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  removed integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.hoa_memberships
  WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status = 'pending' AND role = 'resident';
  GET DIAGNOSTICS removed = ROW_COUNT;

  DELETE FROM public.community_join_requests
  WHERE user_id = auth.uid() AND hoa_id = target_hoa_id AND status = 'pending';

  RETURN removed > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_membership_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_membership_request(uuid) TO authenticated;

-- 6. RPC-only lifecycle: remove resident direct write paths.
DROP POLICY IF EXISTS "Users can request to join communities" ON public.hoa_memberships;
DROP POLICY IF EXISTS "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships;
DROP POLICY IF EXISTS "hoa_memberships_insert_own" ON public.hoa_memberships;
DROP POLICY IF EXISTS "Users can cancel their own pending requests" ON public.hoa_memberships;
DROP POLICY IF EXISTS "Users can create their own join requests" ON public.community_join_requests;

-- 7. Backfill: legacy pending join requests that never got a membership row (the old request_join_community wrote
--    only community_join_requests). Approved communities only; existing memberships of any status are never touched.
INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
SELECT r.user_id, r.hoa_id, 'resident', 'pending'
FROM public.community_join_requests r
JOIN public.hoas h ON h.id = r.hoa_id AND h.approval_status = 'approved'
WHERE r.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = r.user_id AND m.hoa_id = r.hoa_id
  )
ON CONFLICT (user_id, hoa_id) DO NOTHING;

-- 7b. Legacy REJECTED requests with no membership row: record the rejection so the resident sees "Not approved"
--     (and search stops offering "Request to join"). Denial only; grants nothing. Legacy 'approved' request rows
--     without a membership are deliberately NOT converted into access here (needs an admin decision / data review).
INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
SELECT r.user_id, r.hoa_id, 'resident', 'rejected'
FROM public.community_join_requests r
JOIN public.hoas h ON h.id = r.hoa_id AND h.approval_status = 'approved'
WHERE r.status = 'rejected'
  AND NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = r.user_id AND m.hoa_id = r.hoa_id
  )
ON CONFLICT (user_id, hoa_id) DO NOTHING;

-- 8. migrate_existing_hoa_memberships() was a one-off data migration (SECURITY DEFINER, no guards, copies
--    profiles.hoa_role/hoa_status into hoa_memberships). Callable by any client it can recreate memberships that
--    bypass the guards above (and would honor a profile-supplied role/status). It has no runtime callers.
REVOKE ALL ON FUNCTION public.migrate_existing_hoa_memberships() FROM PUBLIC, anon, authenticated;
