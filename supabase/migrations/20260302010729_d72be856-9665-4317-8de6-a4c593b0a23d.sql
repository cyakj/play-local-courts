
-- Step 1: Create security-definer helper to check if current user is ladder admin
CREATE OR REPLACE FUNCTION public.is_ladder_admin(_ladder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ladders
    WHERE id = _ladder_id AND admin_id = auth.uid()
  );
$$;

-- Step 2: Create security-definer helper for ladder visibility
CREATE OR REPLACE FUNCTION public.can_view_ladder(_ladder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ladders l
    WHERE l.id = _ladder_id
    AND (
      -- Admin of this ladder
      l.admin_id = auth.uid()
      -- User is in the same HOA
      OR (l.hoa_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.hoa_id = l.hoa_id
      ))
      -- User participates in a team
      OR EXISTS (
        SELECT 1 FROM public.ladder_teams lt
        WHERE lt.ladder_id = l.id
        AND (lt.player1_id = auth.uid() OR lt.player2_id = auth.uid())
      )
      -- User has a registration request
      OR EXISTS (
        SELECT 1 FROM public.ladder_registration_requests lrr
        WHERE lrr.ladder_id = l.id AND lrr.player_id = auth.uid()
      )
      -- User was invited
      OR EXISTS (
        SELECT 1 FROM public.ladder_invitations li
        WHERE li.ladder_id = l.id AND li.invited_user_id = auth.uid()
      )
    )
  );
$$;

-- Grant execute to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_ladder_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ladder_admin TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_view_ladder FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_ladder TO authenticated;

-- Step 3: Drop recursive SELECT policies on ladders
DROP POLICY IF EXISTS "Users can view ladders they participate in" ON public.ladders;
DROP POLICY IF EXISTS "Users can view ladders they registered for" ON public.ladders;
DROP POLICY IF EXISTS "Users can view ladders they were invited to" ON public.ladders;
DROP POLICY IF EXISTS "Users can view ladders in their HOA" ON public.ladders;

-- Create single non-recursive SELECT policy on ladders
CREATE POLICY "Users can view accessible ladders"
ON public.ladders FOR SELECT
USING (public.can_view_ladder(id));

-- Step 4: Drop recursive admin policies on ladder_teams
DROP POLICY IF EXISTS "Ladder admins can manage teams" ON public.ladder_teams;
DROP POLICY IF EXISTS "Users can view teams in ladders they can see" ON public.ladder_teams;

-- Recreate with helper
CREATE POLICY "Ladder admins can manage teams"
ON public.ladder_teams FOR ALL
USING (public.is_ladder_admin(ladder_id));

CREATE POLICY "Users can view teams in accessible ladders"
ON public.ladder_teams FOR SELECT
USING (public.can_view_ladder(ladder_id));

-- Step 5: Drop recursive admin policies on ladder_matches
DROP POLICY IF EXISTS "Ladder admins can manage matches" ON public.ladder_matches;
DROP POLICY IF EXISTS "Users can view matches in ladders they can see" ON public.ladder_matches;

-- Recreate with helper
CREATE POLICY "Ladder admins can manage matches"
ON public.ladder_matches FOR ALL
USING (public.is_ladder_admin(ladder_id));

CREATE POLICY "Users can view matches in accessible ladders"
ON public.ladder_matches FOR SELECT
USING (public.can_view_ladder(ladder_id));

-- Step 6: Drop recursive admin policies on ladder_registration_requests
DROP POLICY IF EXISTS "Ladder admins can view registration requests" ON public.ladder_registration_requests;
DROP POLICY IF EXISTS "Ladder admins can update registration requests" ON public.ladder_registration_requests;

-- Recreate with helper
CREATE POLICY "Ladder admins can view registration requests"
ON public.ladder_registration_requests FOR SELECT
USING (public.is_ladder_admin(ladder_id));

CREATE POLICY "Ladder admins can update registration requests"
ON public.ladder_registration_requests FOR UPDATE
USING (public.is_ladder_admin(ladder_id));
