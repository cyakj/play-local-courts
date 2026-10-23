-- Community-interest leads and private reviewer notes. NOT APPLIED.
-- Depends on 20261022120000_resident_join_flow_hardening.sql (user_email_verified).
-- An interest request NEVER creates admin privileges, a community, a membership,
-- a role, or approves anything. Only the two interest tables are written here.
-- Requesters can read their linked_application_id; this internal UUID is acceptable because hoa_applications independently enforces RLS.

CREATE TABLE IF NOT EXISTS public.community_interest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  community_name text NOT NULL CHECK (char_length(btrim(community_name)) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 80),
  region text CHECK (char_length(region) <= 80),
  community_type text NOT NULL DEFAULT 'hoa' CHECK (community_type IN ('hoa', 'condo', 'coop', 'townhome', 'other')),
  approx_units integer CHECK (approx_units IS NULL OR approx_units BETWEEN 1 AND 100000),
  contact_name text CHECK (char_length(contact_name) <= 120),
  contact_email text CHECK (char_length(contact_email) <= 254 AND position('@' IN contact_email) > 0),
  notes text CHECK (char_length(notes) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_review', 'onboarding', 'declined', 'closed')),
  status_message text CHECK (char_length(status_message) <= 500),
  linked_application_id uuid REFERENCES public.hoa_applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.community_interest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.community_interest_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  note text NOT NULL CHECK (char_length(btrim(note)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_interest_requester_idx ON public.community_interest_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_interest_notes_request_idx ON public.community_interest_notes(request_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS community_interest_one_open_per_community
  ON public.community_interest_requests (requester_id, lower(btrim(community_name)), lower(btrim(city)))
  WHERE status IN ('new', 'contacted', 'in_review', 'onboarding');
ALTER TABLE public.community_interest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_interest_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_interest_requests, public.community_interest_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.community_interest_requests, public.community_interest_notes TO authenticated;

DROP POLICY IF EXISTS interest_requester_select ON public.community_interest_requests;
CREATE POLICY interest_requester_select ON public.community_interest_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
DROP POLICY IF EXISTS interest_reviewer_select ON public.community_interest_requests;
CREATE POLICY interest_reviewer_select ON public.community_interest_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_reviewer'));
DROP POLICY IF EXISTS interest_notes_reviewer_select ON public.community_interest_notes;
CREATE POLICY interest_notes_reviewer_select ON public.community_interest_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_reviewer'));

CREATE OR REPLACE FUNCTION public.submit_community_interest(
  p_community_name text, p_city text, p_region text, p_community_type text,
  p_approx_units integer, p_contact_name text, p_contact_email text, p_notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.user_email_verified(), false) THEN
    RAISE EXCEPTION 'Sign in and verify your email address first' USING ERRCODE = '42501';
  END IF;
  p_community_name := btrim(p_community_name);
  p_city := btrim(p_city);
  p_region := nullif(btrim(p_region), '');
  p_community_type := btrim(p_community_type);
  p_contact_name := nullif(btrim(p_contact_name), '');
  p_contact_email := nullif(btrim(p_contact_email), '');
  p_notes := nullif(btrim(p_notes), '');
  IF p_community_name IS NULL OR char_length(p_community_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Community name must be 2 to 120 characters' USING ERRCODE = '22023';
  END IF;
  IF p_city IS NULL OR char_length(p_city) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'City must be 2 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_community_type IS NULL OR p_community_type NOT IN ('hoa', 'condo', 'coop', 'townhome', 'other') THEN
    RAISE EXCEPTION 'Choose a valid community type' USING ERRCODE = '22023';
  END IF;
  IF p_approx_units IS NOT NULL AND p_approx_units NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'Approximate units must be 1 to 100000' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_region) > 80 OR char_length(p_contact_name) > 120 OR char_length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Region, contact name, or notes exceed their length limit' USING ERRCODE = '22023';
  END IF;
  IF p_contact_email IS NOT NULL AND (char_length(p_contact_email) > 254 OR p_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Enter a valid contact email address' USING ERRCODE = '22023';
  END IF;
  -- Serialize submissions for this requester so concurrent devices cannot bypass either limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  IF EXISTS (SELECT 1 FROM public.community_interest_requests
    WHERE requester_id = auth.uid() AND status IN ('new', 'contacted', 'in_review', 'onboarding')
      AND lower(btrim(community_name)) = lower(p_community_name) AND lower(btrim(city)) = lower(p_city)) THEN
    RAISE EXCEPTION 'You have already told us about this community' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.community_interest_requests
    WHERE requester_id = auth.uid() AND status IN ('new', 'contacted', 'in_review', 'onboarding')) >= 5 THEN
    RAISE EXCEPTION 'You can have at most five open community requests' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.community_interest_requests
    (community_name, city, region, community_type, approx_units, contact_name, contact_email, notes)
  VALUES (p_community_name, p_city, p_region, p_community_type, p_approx_units, p_contact_name, p_contact_email, p_notes)
  RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;

-- Remove the superseded signature so default arguments never select an old unlink-by-default overload.
DROP FUNCTION IF EXISTS public.update_community_interest(uuid, text, text, text, uuid);
CREATE OR REPLACE FUNCTION public.update_community_interest(
  p_request_id uuid, p_status text, p_status_message text,
  p_internal_note text DEFAULT NULL, p_linked_application_id uuid DEFAULT NULL,
  p_clear_link boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_owner uuid;
  previous_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(), 'platform_reviewer'), false) THEN
    RAISE EXCEPTION 'Platform reviewer permission required' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('new', 'contacted', 'in_review', 'onboarding', 'declined', 'closed') THEN
    RAISE EXCEPTION 'Choose a valid interest status' USING ERRCODE = '22023';
  END IF;
  p_status_message := nullif(btrim(p_status_message), '');
  p_internal_note := nullif(btrim(p_internal_note), '');
  IF char_length(p_status_message) > 500 THEN
    RAISE EXCEPTION 'Status message must be at most 500 characters' USING ERRCODE = '22023';
  END IF;
  IF p_linked_application_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.hoa_applications WHERE id = p_linked_application_id) THEN
    RAISE EXCEPTION 'Linked application does not exist' USING ERRCODE = '22023';
  END IF;
  SELECT requester_id INTO request_owner FROM public.community_interest_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interest request not found' USING ERRCODE = '22023';
  END IF;
  -- Share the submission lock, then lock the row before reading the transition's current status.
  PERFORM pg_advisory_xact_lock(hashtextextended(request_owner::text, 0));
  SELECT status INTO previous_status FROM public.community_interest_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interest request not found' USING ERRCODE = '22023';
  END IF;
  IF previous_status IN ('declined', 'closed') AND p_status IN ('new', 'contacted', 'in_review', 'onboarding') THEN
    IF (SELECT count(*) FROM public.community_interest_requests
      WHERE requester_id = request_owner AND status IN ('new', 'contacted', 'in_review', 'onboarding')) >= 5 THEN
      RAISE EXCEPTION 'This requester already has five open community requests' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.community_interest_requests
    SET status = p_status, status_message = p_status_message,
        linked_application_id = CASE WHEN p_clear_link THEN NULL
          ELSE COALESCE(p_linked_application_id, linked_application_id) END, updated_at = now()
    WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interest request not found' USING ERRCODE = '22023';
  END IF;
  IF p_internal_note IS NOT NULL THEN
    INSERT INTO public.community_interest_notes (request_id, note) VALUES (p_request_id, p_internal_note);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_community_interest(text, text, text, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_community_interest(text, text, text, text, integer, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_community_interest(uuid, text, text, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_community_interest(uuid, text, text, text, uuid, boolean) TO authenticated;
