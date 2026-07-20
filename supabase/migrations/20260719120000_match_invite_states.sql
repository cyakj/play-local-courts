-- Match invitation lifecycle: accepted/declined participant states, an
-- interactive invite card inside the existing DM thread, and a privacy-aware
-- in-app player search RPC to replace contacts-only invites as the primary flow.

-- ── 1. Participant states ───────────────────────────────────────────────────
-- 'invited'  — pending organizer invite, awaiting the player's response
-- 'accepted' — invitee accepted (checkmark in match detail)
-- 'declined' — invitee declined (slot reopens for the organizer to re-invite)
-- 'joined'   — player claimed an open slot directly (existing behavior)
ALTER TABLE public.open_match_listing_participants
  DROP CONSTRAINT IF EXISTS open_match_listing_participants_status_check;

ALTER TABLE public.open_match_listing_participants
  ADD CONSTRAINT open_match_listing_participants_status_check
    CHECK (status IN ('invited', 'accepted', 'declined', 'joined'));

-- No UPDATE/DELETE policy existed on this table before now — invitees could
-- not accept/decline and organizers could not remove/replace a participant.
DROP POLICY IF EXISTS "Invitee can respond to their own invite" ON public.open_match_listing_participants;
CREATE POLICY "Invitee can respond to their own invite"
  ON public.open_match_listing_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('accepted', 'declined'));

DROP POLICY IF EXISTS "Creator can remove or reopen a participant slot" ON public.open_match_listing_participants;
CREATE POLICY "Creator can remove or reopen a participant slot"
  ON public.open_match_listing_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.open_match_listings listing
      WHERE listing.id = listing_id AND listing.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participant can leave a match" ON public.open_match_listing_participants;
CREATE POLICY "Participant can leave a match"
  ON public.open_match_listing_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Interactive invite card inside the DM thread ─────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'match_invite')),
  ADD COLUMN IF NOT EXISTS related_listing_id uuid REFERENCES public.open_match_listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS messages_related_listing_idx
  ON public.messages (related_listing_id) WHERE related_listing_id IS NOT NULL;

-- ── 3. Privacy-aware player search ───────────────────────────────────────────
-- Mirrors match_tenisx_contacts (SECURITY DEFINER, excludes self) but searches
-- by name across all discoverable players instead of matching device contacts.
-- Respects profiles.profile_visibility: 'public' → visible to anyone,
-- 'community_only' → visible only to members who share the same hoa_id,
-- 'private' → excluded entirely.
DROP FUNCTION IF EXISTS public.search_players(text);
CREATE FUNCTION public.search_players(search_query text DEFAULT '')
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  ntrp_rating numeric,
  utr_rating numeric,
  hoa_id uuid,
  same_community boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    profile.id,
    profile.full_name,
    profile.avatar_url,
    profile.ntrp_rating,
    profile.utr_rating,
    profile.hoa_id::uuid,
    (profile.hoa_id IS NOT NULL AND profile.hoa_id = viewer.hoa_id) AS same_community
  FROM public.profiles profile
  CROSS JOIN (SELECT hoa_id FROM public.profiles WHERE id = auth.uid()) AS viewer
  WHERE profile.id <> auth.uid()
    AND (
      coalesce(profile.profile_visibility, 'public') = 'public'
      OR (
        coalesce(profile.profile_visibility, 'public') = 'community_only'
        AND profile.hoa_id IS NOT NULL
        AND profile.hoa_id = viewer.hoa_id
      )
    )
    AND (
      trim(search_query) = ''
      OR profile.full_name ILIKE '%' || trim(search_query) || '%'
      OR profile.username ILIKE '%' || trim(search_query) || '%'
    )
  ORDER BY same_community DESC NULLS LAST, profile.full_name NULLS LAST
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.search_players(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_players(text) TO authenticated;
