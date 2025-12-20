-- Fix profiles UPDATE policy recursion and protect sensitive columns

-- 1) Replace the recursive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile (excluding roles)" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2) Prevent non-admins from changing sensitive membership/role fields
--    (keeps security intent without using recursive policy subqueries)
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow backend/service role operations
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow admins
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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
$$;

DROP TRIGGER IF EXISTS prevent_profile_sensitive_changes ON public.profiles;
CREATE TRIGGER prevent_profile_sensitive_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_sensitive_changes();
