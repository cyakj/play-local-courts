-- Platform Admin community approval + secure V1 messaging.
--
-- NOT APPLIED. Review, then apply with the Supabase MCP `apply_migration` (never `db push`).
-- Depends on nothing new; safe to apply after 20261013110000.
--
-- PART A — Community approval (reuses the existing hoa_applications / hoa_application_notes /
--          application_notifications tables and the platform_reviewer role; no second system)
--   Bypasses closed (all found by read-only inspection of the live project):
--     1. hoas INSERT policy "Authenticated users can create communities" (auth.uid() = admin_id)
--     2. create_community() RPC, executable by every signed-in user, which also grants the global
--        'admin' role immediately
--     3. user_roles INSERT policy "Only admins can assign user roles": ANY holder of the 'admin'
--        role (every HOA admin) could insert ANY role, including platform_reviewer
--     4. grant_admin_role(): any 'admin' could grant 'admin' to anyone
--   After this file the ONLY way a community comes into existence is approve_hoa_application(),
--   which only a platform_reviewer can call. Existing communities are backfilled as approved.
--
-- PART B — Messaging (reuses public.messages: direct sender/receiver rows, read_at, realtime)
--   * Sending requires a legitimate relationship (see can_send_message).
--   * Message content/participants are immutable after sending; only the receiver may set read_at.
--   * Messages cannot be deleted by participants (history is preserved).
--   * my_message_contacts() lets a resident discover only their community admins, and an admin
--     discover only members of communities they administer.
--
-- Nothing here deletes or rewrites existing rows (one column is added and backfilled).

-- ======================================================================================
-- PART A
-- ======================================================================================

-- A1. Approval state on communities -----------------------------------------------------
-- New column defaults to 'approved' ONLY so the three existing test communities (The Greens,
-- DBE, The Fairways) are backfilled; the default is then switched to 'pending' so any future
-- row that somehow appears is inactive until approved.
ALTER TABLE public.hoas
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'suspended')),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_application_id uuid REFERENCES public.hoa_applications(id) ON DELETE SET NULL;
ALTER TABLE public.hoas ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Link the community that already came through an application (The Fairways).
UPDATE public.hoas h
SET source_application_id = a.id, approved_at = a.reviewed_at, approved_by = a.reviewed_by
FROM public.hoa_applications a
WHERE a.created_hoa_id = h.id AND h.source_application_id IS NULL;

CREATE OR REPLACE FUNCTION public.hoa_is_approved(_hoa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.hoas WHERE id = _hoa_id AND approval_status = 'approved') $$;
REVOKE ALL ON FUNCTION public.hoa_is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hoa_is_approved(uuid) TO authenticated;

-- A2. Close the creation bypasses ---------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.hoas;

REVOKE ALL ON FUNCTION public.create_community(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Only a platform reviewer may grant the (global) admin role by hand.
CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RAISE EXCEPTION 'Only TenisX platform administrators can grant admin privileges' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (target_user_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.grant_admin_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(uuid) TO authenticated;

-- No client may insert user_roles rows. Roles are written only by SECURITY DEFINER functions
-- (approve_hoa_application, assign_coach_role trigger, signup trigger) or the service role.
DROP POLICY IF EXISTS "Only admins can assign user roles" ON public.user_roles;

-- Defence in depth: platform_reviewer can never be created or edited through the API, even by a
-- definer function that is later added carelessly. (auth.uid() is NULL for service role / SQL editor.)
CREATE OR REPLACE FUNCTION public.guard_platform_reviewer_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.role = 'platform_reviewer'::public.app_role
          OR (TG_OP = 'UPDATE' AND OLD.role = 'platform_reviewer'::public.app_role)) THEN
    RAISE EXCEPTION 'The platform administrator role can only be assigned by TenisX staff' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS guard_platform_reviewer_role_trigger ON public.user_roles;
CREATE TRIGGER guard_platform_reviewer_role_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_reviewer_role();

-- A3. Joining requires an approved community --------------------------------------------------
DROP POLICY IF EXISTS "Users can request to join communities" ON public.hoa_memberships;
CREATE POLICY "Users can request to join communities" ON public.hoa_memberships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND role = 'resident' AND public.hoa_is_approved(hoa_id));

DROP POLICY IF EXISTS "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships;
CREATE POLICY "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'resident' AND status = 'pending' AND public.hoa_is_approved(hoa_id));

-- A4. Approval creates the community AND the approved admin membership, atomically ------------
CREATE OR REPLACE FUNCTION public.approve_hoa_application(application_id uuid, reviewer_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  app_record RECORD;
  new_hoa_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RAISE EXCEPTION 'Only platform reviewers can approve applications' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO app_record FROM public.hoa_applications WHERE id = application_id FOR UPDATE;
  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF app_record.status = 'approved' THEN
    RAISE EXCEPTION 'Application already approved';
  END IF;
  IF app_record.status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending application can be approved (current status: %)', app_record.status;
  END IF;

  INSERT INTO public.hoas (name, address, admin_id, approval_status, approved_at, approved_by, source_application_id)
  VALUES (app_record.hoa_name, app_record.community_location, app_record.applicant_id,
          'approved', now(), auth.uid(), application_id)
  RETURNING id INTO new_hoa_id;

  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
  SELECT app_record.applicant_id, new_hoa_id, 'admin', 'approved'
  WHERE NOT EXISTS (SELECT 1 FROM public.hoa_memberships m
                    WHERE m.user_id = app_record.applicant_id AND m.hoa_id = new_hoa_id);

  UPDATE public.hoa_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
      created_hoa_id = new_hoa_id, updated_at = now()
  WHERE id = application_id;

  UPDATE public.profiles
  SET hoa_id = new_hoa_id, hoa_status = 'approved', hoa_role = 'admin'
  WHERE id = app_record.applicant_id;

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (app_record.applicant_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.hoa_application_notes (application_id, reviewer_id, note, status_change)
  VALUES (application_id, auth.uid(), COALESCE(NULLIF(btrim(reviewer_note), ''), 'Approved'), 'approved');

  INSERT INTO public.application_notifications (application_id, user_id, title, message)
  VALUES (application_id, app_record.applicant_id, 'Application approved',
          'Your community "' || app_record.hoa_name || '" has been approved. You now have administrator access.');

  RETURN new_hoa_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.approve_hoa_application(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_hoa_application(uuid, text) TO authenticated;

-- update_hoa_application_status already enforces platform_reviewer; just remove the anon grant.
REVOKE ALL ON FUNCTION public.update_hoa_application_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_hoa_application_status(uuid, text, text) TO authenticated;

-- ======================================================================================
-- PART B — messaging
-- ======================================================================================

-- B1. Who may start / continue a conversation ----------------------------------------------
-- Allowed when ANY of:
--   (a) the two users are approved in the same community AND one of them administers it
--       (resident <-> HOA admin; residents cannot cold-message each other through the community);
--   (b) the receiver has already messaged the sender (replies always work);
--   (c) tennis context: a coach lesson request exists between them, or both are involved in the
--       open match listing the message refers to;
--   (d) neither user belongs to any approved community (the public tennis marketplace, which the
--       discoverable-profiles policy already scopes to non-community users).
-- Everything else is refused, so a community member cannot be contacted by outsiders or by members
-- of other communities.
CREATE OR REPLACE FUNCTION public.can_send_message(
  _sender uuid, _receiver uuid, _lesson_request_id uuid DEFAULT NULL, _listing_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _sender IS NOT NULL AND _receiver IS NOT NULL AND _sender <> _receiver AND (
    EXISTS (
      SELECT 1
      FROM public.hoa_memberships a
      JOIN public.hoa_memberships b ON b.hoa_id = a.hoa_id
      WHERE a.user_id = _sender AND b.user_id = _receiver
        AND a.status = 'approved' AND b.status = 'approved'
        AND (a.role = 'admin' OR b.role = 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.messages m WHERE m.sender_id = _receiver AND m.receiver_id = _sender)
    OR EXISTS (
      SELECT 1 FROM public.lesson_requests lr
      WHERE (lr.player_id = _sender AND lr.coach_id = _receiver) OR (lr.player_id = _receiver AND lr.coach_id = _sender)
    )
    OR (_listing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.open_match_listings l
      WHERE l.id = _listing_id
        AND (l.creator_id = _sender OR EXISTS (SELECT 1 FROM public.open_match_listing_participants p WHERE p.listing_id = l.id AND p.user_id = _sender))
        AND (l.creator_id = _receiver OR EXISTS (SELECT 1 FROM public.open_match_listing_participants p WHERE p.listing_id = l.id AND p.user_id = _receiver))
    ))
    OR (
      NOT EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = _sender AND m.status = 'approved')
      AND NOT EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = _receiver AND m.status = 'approved')
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_send_message(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_send_message(uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.can_send_message(sender_id, receiver_id, lesson_request_id, related_listing_id));

-- B2. Messages are immutable apart from the receiver marking them read ----------------------------
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN            -- service role / migrations
    RETURN NEW;
  END IF;
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.message_type IS DISTINCT FROM OLD.message_type
     OR NEW.lesson_request_id IS DISTINCT FROM OLD.lesson_request_id
     OR NEW.related_listing_id IS DISTINCT FROM OLD.related_listing_id
     OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION 'Sent messages cannot be edited' USING ERRCODE = '42501';
  END IF;
  IF NEW.read_at IS DISTINCT FROM OLD.read_at AND auth.uid() <> OLD.receiver_id THEN
    RAISE EXCEPTION 'Only the recipient can mark a message as read' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS guard_message_update_trigger ON public.messages;
CREATE TRIGGER guard_message_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

-- No client deletes messages; keep the history intact.
DROP POLICY IF EXISTS "Users can delete messages they sent or received" ON public.messages;

-- B3. Contact directory (replaces broad client-side member queries) ----------------------------------
-- A community admin sees approved members of the communities they administer.
-- Everyone else sees only the approved admins of their own communities.
CREATE OR REPLACE FUNCTION public.my_message_contacts()
RETURNS TABLE (user_id uuid, full_name text, hoa_id uuid, hoa_name text, contact_is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (c.user_id, c.hoa_id)
         c.user_id, COALESCE(NULLIF(btrim(p.full_name), ''), 'Resident'), c.hoa_id, h.name, (c.role = 'admin')
  FROM public.hoa_memberships me
  JOIN public.hoa_memberships c ON c.hoa_id = me.hoa_id AND c.status = 'approved' AND c.user_id <> me.user_id
  JOIN public.hoas h ON h.id = me.hoa_id AND h.approval_status = 'approved'
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE me.user_id = auth.uid() AND me.status = 'approved'
    AND (me.role = 'admin' OR c.role = 'admin')
  ORDER BY c.user_id, c.hoa_id
$$;
REVOKE ALL ON FUNCTION public.my_message_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_message_contacts() TO authenticated;
