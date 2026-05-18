CREATE OR REPLACE FUNCTION public.is_admin_in_same_hoa(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm_admin
    JOIN public.hoa_memberships hm_target
      ON hm_target.hoa_id = hm_admin.hoa_id
    WHERE hm_admin.user_id = _user_id
      AND hm_admin.role = 'admin'
      AND hm_admin.status = 'approved'
      AND hm_target.user_id = _target_user_id
      AND hm_target.status = 'approved'
  )
$function$;