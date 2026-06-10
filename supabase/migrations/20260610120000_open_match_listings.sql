-- Public match listings power the resident Match discovery marketplace.
CREATE TABLE IF NOT EXISTS public.open_match_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('singles', 'doubles', 'casual_hit')),
  match_type text NOT NULL CHECK (match_type IN ('casual', 'competitive')),
  play_with text NOT NULL DEFAULT 'all' CHECK (play_with IN ('men', 'women', 'mixed', 'all')),
  match_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  utr_min numeric(3,1) NOT NULL DEFAULT 0 CHECK (utr_min BETWEEN 0 AND 16.5),
  utr_max numeric(3,1) NOT NULL DEFAULT 16.5 CHECK (utr_max BETWEEN 0 AND 16.5 AND utr_max >= utr_min),
  location text NOT NULL,
  distance_miles integer NOT NULL DEFAULT 25 CHECK (distance_miles BETWEEN 0 AND 100),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.open_match_listing_participants (
  listing_id uuid NOT NULL REFERENCES public.open_match_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS open_match_listings_discovery_idx
  ON public.open_match_listings (status, match_date, start_time);

ALTER TABLE public.open_match_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_match_listing_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can discover open matches" ON public.open_match_listings;
CREATE POLICY "Authenticated users can discover open matches"
  ON public.open_match_listings FOR SELECT TO authenticated
  USING (status = 'open' OR creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can create open matches" ON public.open_match_listings;
CREATE POLICY "Users can create open matches"
  ON public.open_match_listings FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Creators can update open matches" ON public.open_match_listings;
CREATE POLICY "Creators can update open matches"
  ON public.open_match_listings FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Creators can delete open matches" ON public.open_match_listings;
CREATE POLICY "Creators can delete open matches"
  ON public.open_match_listings FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view listing participants" ON public.open_match_listing_participants;
CREATE POLICY "Authenticated users can view listing participants"
  ON public.open_match_listing_participants FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can join open matches" ON public.open_match_listing_participants;
CREATE POLICY "Users can join open matches"
  ON public.open_match_listing_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.open_match_listings listing
      WHERE listing.id = listing_id
        AND listing.status = 'open'
        AND listing.creator_id <> auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.open_match_listings;
