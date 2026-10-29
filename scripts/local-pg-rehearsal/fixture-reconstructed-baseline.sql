-- RECONSTRUCTED approximation of the hosted tables the changed migrations (M2, M4, M7) touch. Column shapes come from
-- src/lib/types.ts and the repo migrations; hosted triggers, extra policies and drift are NOT reproduced. It proves
-- the SQL compiles and behaves as designed on a plausible schema; it is NOT a substitute for a restore of the real backup.
CREATE TYPE public.app_role AS ENUM ('admin','resident','coach','platform_reviewer','maintenance_worker');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id, role));
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE TABLE public.hoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, address text, admin_id uuid, community_type text,
  description text, email text, phone text, logo_url text, invite_code varchar UNIQUE, invite_enabled boolean NOT NULL DEFAULT true,
  invite_expires_at timestamptz, approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','suspended')),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.hoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can view their own HOA" ON public.hoas FOR SELECT TO authenticated USING (admin_id = auth.uid());
CREATE FUNCTION public.hoa_is_approved(_hoa_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.hoas WHERE id = _hoa_id AND approval_status = 'approved') $$;
REVOKE ALL ON FUNCTION public.hoa_is_approved(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.hoa_is_approved(uuid) TO authenticated;

CREATE TABLE public.hoa_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_id uuid NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'resident',
  status text NOT NULL DEFAULT 'pending', is_primary boolean NOT NULL DEFAULT false, last_active_at timestamptz,
  joined_via_invite boolean NOT NULL DEFAULT false, invite_code_used varchar,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, hoa_id));
ALTER TABLE public.hoa_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY hoa_memberships_select_own ON public.hoa_memberships FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can request to join communities" ON public.hoa_memberships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND role = 'resident' AND public.hoa_is_approved(hoa_id));
CREATE POLICY hoa_memberships_insert_own_pending_resident_only ON public.hoa_memberships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'resident' AND status = 'pending' AND public.hoa_is_approved(hoa_id));
CREATE POLICY "Users can cancel their own pending requests" ON public.hoa_memberships FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY hoa_memberships_insert_own_admin_creator ON public.hoa_memberships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'admin' AND status = 'approved'
              AND EXISTS (SELECT 1 FROM public.hoas h WHERE h.id = hoa_id AND h.admin_id = auth.uid()));

CREATE TABLE public.community_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_id uuid NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE, message text, status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, hoa_id));
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own join requests" ON public.community_join_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own join requests" ON public.community_join_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.hoa_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_name text NOT NULL, community_location text NOT NULL DEFAULT 'x', claimed_role text NOT NULL DEFAULT 'president',
  claimed_role_other text, estimated_residents integer NOT NULL DEFAULT 10, status text NOT NULL DEFAULT 'pending',
  verification_documents text[], reviewed_by uuid, reviewed_at timestamptz, created_hoa_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.hoa_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE, booking_confirmations boolean NOT NULL DEFAULT true,
  booking_reminders boolean NOT NULL DEFAULT true, cancellation_notifications boolean NOT NULL DEFAULT true,
  admin_announcements boolean NOT NULL DEFAULT true, lesson_confirmations boolean, lesson_reminders boolean,
  match_confirmations boolean, match_reminders boolean, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- hosted-only / legacy function stand-ins
CREATE FUNCTION public.migrate_existing_hoa_memberships() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
CREATE FUNCTION public.update_email_preference(p_user uuid, p_field text, p_value boolean) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 1 $$;
CREATE FUNCTION public.get_email_preferences(target_user_id uuid) RETURNS TABLE (id uuid, user_id uuid, booking_confirmations boolean, booking_reminders boolean,
  cancellation_notifications boolean, admin_announcements boolean, lesson_confirmations boolean, lesson_reminders boolean, match_confirmations boolean,
  match_reminders boolean, created_at timestamptz, updated_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=public
  AS $$ SELECT e.id, e.user_id, e.booking_confirmations, e.booking_reminders, e.cancellation_notifications, e.admin_announcements, e.lesson_confirmations, e.lesson_reminders, e.match_confirmations, e.match_reminders, e.created_at, e.updated_at FROM email_preferences e WHERE e.user_id = target_user_id $$;
CREATE FUNCTION public.create_default_email_preferences(target_user_id uuid) RETURNS TABLE (id uuid, user_id uuid, booking_confirmations boolean, booking_reminders boolean,
  cancellation_notifications boolean, admin_announcements boolean, lesson_confirmations boolean, lesson_reminders boolean, match_confirmations boolean,
  match_reminders boolean, created_at timestamptz, updated_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=public
  AS $$ SELECT e.id, e.user_id, e.booking_confirmations, e.booking_reminders, e.cancellation_notifications, e.admin_announcements, e.lesson_confirmations, e.lesson_reminders, e.match_confirmations, e.match_reminders, e.created_at, e.updated_at FROM email_preferences e WHERE false $$;
-- a function an earlier migration deliberately closed to signed-in users: M7 must NOT reopen it
CREATE FUNCTION public.assign_coach_role(target uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.assign_coach_role(uuid) FROM PUBLIC, anon, authenticated;
-- a function with default (PUBLIC) grants that signed-in users legitimately use
CREATE FUNCTION public.set_active_hoa(target_hoa_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 1 $$;
