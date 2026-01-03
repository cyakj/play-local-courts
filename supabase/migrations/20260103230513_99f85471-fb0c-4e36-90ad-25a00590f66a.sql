-- Fix the trigger to allow platform_reviewers to approve applications
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow backend/service role operations
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow admins
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Allow platform reviewers (they need to approve HOA applications)
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- For regular users, block changes to sensitive fields
  IF NEW.hoa_id IS DISTINCT FROM OLD.hoa_id
     OR NEW.hoa_role IS DISTINCT FROM OLD.hoa_role
     OR NEW.hoa_status IS DISTINCT FROM OLD.hoa_status
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change HOA membership/status/role fields';
  END IF;

  RETURN NEW;
END;
$function$;