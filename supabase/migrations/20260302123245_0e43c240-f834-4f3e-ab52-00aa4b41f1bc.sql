
-- 1) Backfill missing admin roles for approved HOA admins
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT hm.user_id, 'admin'::public.app_role
FROM public.hoa_memberships hm
WHERE hm.role = 'admin' AND hm.status = 'approved'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also backfill from hoas.admin_id
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT h.admin_id, 'admin'::public.app_role
FROM public.hoas h
WHERE h.admin_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Preflight permission check RPC
CREATE OR REPLACE FUNCTION public.check_competition_create_permission(_hoa_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  result := jsonb_build_object(
    'auth_uid', auth.uid(),
    'has_admin_role', public.has_role(auth.uid(), 'admin'::public.app_role),
    'has_coach_role', public.has_role(auth.uid(), 'coach'::public.app_role),
    'has_coach_profile', EXISTS (SELECT 1 FROM public.coaches WHERE user_id = auth.uid()),
    'has_approved_admin_membership', (
      _hoa_id IS NULL OR EXISTS (
        SELECT 1 FROM public.hoa_memberships
        WHERE user_id = auth.uid()
          AND hoa_id = _hoa_id
          AND role = 'admin'
          AND status = 'approved'
      )
    ),
    'can_create', public.can_create_ladder(auth.uid(), _hoa_id)
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_competition_create_permission(uuid) TO authenticated;

-- 3) Server-side create_competition_ladder RPC
CREATE OR REPLACE FUNCTION public.create_competition_ladder(
  _name text,
  _description text DEFAULT NULL,
  _format public.ladder_format DEFAULT 'doubles',
  _is_private boolean DEFAULT false,
  _city text DEFAULT NULL,
  _hoa_only boolean DEFAULT false,
  _hoa_id uuid DEFAULT NULL,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL,
  _registration_deadline date DEFAULT NULL,
  _min_ntrp numeric DEFAULT NULL,
  _max_ntrp numeric DEFAULT NULL,
  _min_age int DEFAULT NULL,
  _max_age int DEFAULT NULL,
  _gender_restriction text DEFAULT NULL,
  _max_teams int DEFAULT 20,
  _auto_approve_registration boolean DEFAULT false,
  _enable_playoffs boolean DEFAULT false,
  _playoff_teams_count int DEFAULT 4,
  _scoring_mode text DEFAULT 'cumulative',
  _scoring_format text DEFAULT 'best_of_3',
  _third_set_format text DEFAULT 'super_tiebreak',
  _points_per_win int DEFAULT 3,
  _points_per_set int DEFAULT 1,
  _loss_points int DEFAULT 0,
  _tiebreaker_rule text DEFAULT 'head_to_head',
  _secondary_tiebreaker text DEFAULT 'games_won',
  _require_score_confirmation boolean DEFAULT true,
  _dispute_window_hours int DEFAULT 48,
  _challenge_range int DEFAULT 3,
  _acceptance_window_hours int DEFAULT 48,
  _play_by_deadline_days int DEFAULT 10,
  _max_freeze_days int DEFAULT 30,
  _min_players_required int DEFAULT NULL,
  _status public.ladder_status DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _result record;
BEGIN
  -- Validate permission
  IF NOT public.can_create_ladder(_admin_id, _hoa_id) THEN
    RAISE EXCEPTION 'Permission denied: you do not have admin or coach privileges to create a competition.';
  END IF;

  INSERT INTO public.ladders (
    admin_id, name, description, format, is_private, city, hoa_only, hoa_id,
    start_date, end_date, registration_deadline, min_ntrp, max_ntrp, min_age, max_age,
    gender_restriction, max_teams, auto_approve_registration, enable_playoffs, playoff_teams_count,
    scoring_mode, scoring_format, third_set_format, points_per_win, points_per_set, loss_points,
    tiebreaker_rule, secondary_tiebreaker, require_score_confirmation, dispute_window_hours,
    challenge_range, acceptance_window_hours, play_by_deadline_days, max_freeze_days,
    min_players_required, status
  ) VALUES (
    _admin_id, _name, _description, _format, _is_private, _city, _hoa_only, _hoa_id,
    _start_date, _end_date, _registration_deadline, _min_ntrp, _max_ntrp, _min_age, _max_age,
    _gender_restriction, _max_teams, _auto_approve_registration, _enable_playoffs, _playoff_teams_count,
    _scoring_mode, _scoring_format, _third_set_format, _points_per_win, _points_per_set, _loss_points,
    _tiebreaker_rule, _secondary_tiebreaker, _require_score_confirmation, _dispute_window_hours,
    _challenge_range, _acceptance_window_hours, _play_by_deadline_days, _max_freeze_days,
    _min_players_required, _status
  )
  RETURNING * INTO _result;

  RETURN to_jsonb(_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_competition_ladder(text, text, public.ladder_format, boolean, text, boolean, uuid, date, date, date, numeric, numeric, int, int, text, int, boolean, boolean, int, text, text, text, int, int, int, text, text, boolean, int, int, int, int, int, int, public.ladder_status) TO authenticated;

-- 4) Refactor INSERT policy to use centralized can_create_ladder function
DROP POLICY IF EXISTS "Admins and coaches can create ladders" ON public.ladders;

CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
TO authenticated
WITH CHECK (public.can_create_ladder(admin_id, hoa_id));
