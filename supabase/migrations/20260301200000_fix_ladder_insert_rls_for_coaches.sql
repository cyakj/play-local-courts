-- Fix: can_create_ladder was checking the coaches TABLE instead of user_roles
-- for coach role. A user with 'coach' in user_roles but no coaches profile row
-- would be denied. Now checks both user_roles and coaches table.

CREATE OR REPLACE FUNCTION public.can_create_ladder(_admin_id uuid, _hoa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _admin_id = auth.uid()
    AND (
      -- System/HOA admin via user_roles
      public.has_role(auth.uid(), 'admin'::public.app_role)
      -- Coach via user_roles
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      -- Coach via coaches profile table (legacy fallback)
      OR EXISTS (
        SELECT 1
        FROM public.coaches c
        WHERE c.user_id = auth.uid()
      )
      -- HOA admin via hoa_memberships
      OR EXISTS (
        SELECT 1
        FROM public.hoa_memberships hm
        WHERE hm.user_id = auth.uid()
          AND hm.role = 'admin'
          AND hm.status = 'approved'
          AND (_hoa_id IS NULL OR hm.hoa_id = _hoa_id)
      )
    );
$$;
