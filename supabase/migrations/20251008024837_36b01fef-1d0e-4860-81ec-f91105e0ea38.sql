-- Assign coach role automatically when a coach profile is created
CREATE OR REPLACE FUNCTION public.assign_coach_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (NEW.user_id, 'coach', NEW.user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coaches_assign_role ON public.coaches;
CREATE TRIGGER coaches_assign_role
AFTER INSERT ON public.coaches
FOR EACH ROW
EXECUTE FUNCTION public.assign_coach_role();