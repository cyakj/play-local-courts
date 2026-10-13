-- ROLLBACK for 20261013120000_platform_approval_and_secure_messaging.sql
--
-- NOT a migration (kept outside supabase/migrations on purpose). Apply with the Supabase MCP only if the
-- forward migration must be undone. It restores the policies and function bodies captured in
-- backup_20261013 (_policies / _functions) BEFORE the forward migration, i.e. it also restores the
-- known-insecure behaviour (anyone can create communities / message anyone). It does not delete data and
-- leaves the additive hoas columns (approval_status, approved_at, approved_by, source_application_id) in place.

-- Part B: messaging
DROP TRIGGER IF EXISTS guard_message_update_trigger ON public.messages;
DROP FUNCTION IF EXISTS public.guard_message_update();

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO public WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete messages they sent or received" ON public.messages;
CREATE POLICY "Users can delete messages they sent or received" ON public.messages
  FOR DELETE TO public USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP FUNCTION IF EXISTS public.my_message_contacts();
DROP FUNCTION IF EXISTS public.can_send_message(uuid, uuid, uuid, uuid);

-- Part A: community approval
DROP POLICY IF EXISTS "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships;
CREATE POLICY "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (role = 'resident'::text) AND (status = 'pending'::text));

DROP POLICY IF EXISTS "Users can request to join communities" ON public.hoa_memberships;
CREATE POLICY "Users can request to join communities" ON public.hoa_memberships
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id) AND (status = 'pending'::text) AND (role = 'resident'::text));

DROP TRIGGER IF EXISTS guard_platform_reviewer_role_trigger ON public.user_roles;
DROP FUNCTION IF EXISTS public.guard_platform_reviewer_role();

DROP POLICY IF EXISTS "Only admins can assign user roles" ON public.user_roles;
CREATE POLICY "Only admins can assign user roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.hoas;
CREATE POLICY "Authenticated users can create communities" ON public.hoas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_id);

GRANT EXECUTE ON FUNCTION public.create_community(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Only existing admins can grant admin role
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant admin privileges';
  END IF;
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (target_user_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_hoa_application(application_id uuid, reviewer_note text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  app_record RECORD;
  new_hoa_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RAISE EXCEPTION 'Only platform reviewers can approve applications';
  END IF;
  SELECT * INTO app_record FROM public.hoa_applications WHERE id = application_id;
  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF app_record.status = 'approved' THEN
    RAISE EXCEPTION 'Application already approved';
  END IF;
  INSERT INTO public.hoas (name, address, admin_id)
  VALUES (app_record.hoa_name, app_record.community_location, app_record.applicant_id)
  RETURNING id INTO new_hoa_id;
  UPDATE public.hoa_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), created_hoa_id = new_hoa_id, updated_at = now()
  WHERE id = application_id;
  UPDATE public.profiles
  SET hoa_id = new_hoa_id, hoa_status = 'approved', hoa_role = 'admin'
  WHERE id = app_record.applicant_id;
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (app_record.applicant_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  IF reviewer_note IS NOT NULL THEN
    INSERT INTO public.hoa_application_notes (application_id, reviewer_id, note, status_change)
    VALUES (application_id, auth.uid(), reviewer_note, 'approved');
  END IF;
  INSERT INTO public.application_notifications (application_id, user_id, title, message)
  VALUES (application_id, app_record.applicant_id, 'Application Approved!',
    'Congratulations! Your HOA application for "' || app_record.hoa_name || '" has been approved. You now have full administrative access to manage your community.');
  RETURN new_hoa_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.approve_hoa_application(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_hoa_application_status(uuid, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.hoa_is_approved(uuid);
