ALTER TABLE public.open_match_listings
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 90
    CHECK (duration_minutes IN (60, 90, 120)),
  ADD COLUMN IF NOT EXISTS court_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_source text NOT NULL DEFAULT 'directory'
    CHECK (location_source IN ('hoa', 'club', 'directory')),
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.open_match_listing_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'joined'
    CHECK (status IN ('invited', 'joined')),
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_index integer CHECK (slot_index BETWEEN 1 AND 3);

DROP POLICY IF EXISTS "Users can join open matches" ON public.open_match_listing_participants;
CREATE POLICY "Users can join or creators can invite"
  ON public.open_match_listing_participants FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND status = 'joined'
      AND EXISTS (
        SELECT 1
        FROM public.open_match_listings listing
        WHERE listing.id = listing_id
          AND listing.status = 'open'
          AND listing.creator_id <> auth.uid()
      )
    )
    OR
    (
      status = 'invited'
      AND added_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.open_match_listings listing
        WHERE listing.id = listing_id
          AND listing.creator_id = auth.uid()
      )
    )
  );

DROP FUNCTION IF EXISTS public.match_tenisx_contacts(text[], text[]);
CREATE FUNCTION public.match_tenisx_contacts(
  contact_emails text[] DEFAULT ARRAY[]::text[],
  contact_phones text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  utr_rating numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    profile.id,
    profile.full_name,
    profile.avatar_url,
    profile.utr_rating
  FROM public.profiles profile
  JOIN auth.users account ON account.id = profile.id
  WHERE profile.id <> auth.uid()
    AND (
      lower(coalesce(account.email, '')) = ANY (
        SELECT lower(value) FROM unnest(contact_emails) AS value
      )
      OR regexp_replace(
        coalesce(profile.phone_number, account.phone, ''),
        '[^0-9]',
        '',
        'g'
      ) = ANY (
        SELECT regexp_replace(value, '[^0-9]', '', 'g')
        FROM unnest(contact_phones) AS value
      )
    )
  ORDER BY profile.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.match_tenisx_contacts(text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_tenisx_contacts(text[], text[]) TO authenticated;
