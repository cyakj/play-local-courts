-- Root fix: make ladders SELECT policy row-based so INSERT ... RETURNING works reliably.
-- Keep can_view_ladder for related-table policies, but delegate to a row-based helper.

CREATE OR REPLACE FUNCTION public.can_view_ladder_row(_ladder_id uuid, _admin_id uuid, _hoa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      _admin_id = auth.uid()
      OR (
        _hoa_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.hoa_id = _hoa_id
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.ladder_teams lt
        WHERE lt.ladder_id = _ladder_id
          AND (lt.player1_id = auth.uid() OR lt.player2_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.ladder_registration_requests lrr
        WHERE lrr.ladder_id = _ladder_id
          AND lrr.player_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.ladder_invitations li
        WHERE li.ladder_id = _ladder_id
          AND li.invited_user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_ladder(_ladder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ladders l
    WHERE l.id = _ladder_id
      AND public.can_view_ladder_row(l.id, l.admin_id, l.hoa_id)
  );
$$;

DROP POLICY IF EXISTS "Users can view accessible ladders" ON public.ladders;

CREATE POLICY "Users can view accessible ladders"
ON public.ladders
FOR SELECT
TO authenticated
USING (public.can_view_ladder_row(id, admin_id, hoa_id));

GRANT EXECUTE ON FUNCTION public.can_view_ladder_row(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_ladder(uuid) TO authenticated;