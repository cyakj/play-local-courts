-- supabase/migrations/20260721010400_create_match_rls_participants_select_insert.sql

-- SELECT: was `using (true)` — anyone could read every participant row on every
-- listing, which would leak who's on an invite_only listing even though the
-- listing itself is hidden. Scope to: listing is public, or viewer is the
-- listing's creator, or the row belongs to the viewer.
drop policy if exists "Authenticated users can view listing participants" on public.open_match_listing_participants;

create policy "Users can view participants of visible listings or their own row"
on public.open_match_listing_participants
for select
using (
  exists (
    select 1 from public.open_match_listings listing
    where listing.id = open_match_listing_participants.listing_id
      and (listing.visibility = 'public' or listing.creator_id = auth.uid())
  )
  or user_id = auth.uid()
);

-- INSERT: was "Users can join or creators can invite". Self-join now inserts as
-- 'requested' (not immediately 'joined') and is blocked entirely on invite_only
-- listings. Strict rating enforcement is checked here, server-side, against the
-- joining user's own profile row — a user with no rating on file fails the
-- `is not null` check and cannot self-join a strict listing.
drop policy if exists "Users can join or creators can invite" on public.open_match_listing_participants;

create policy "Users can request to join public listings, creators can invite"
on public.open_match_listing_participants
for insert
with check (
  (
    user_id = auth.uid() and status = 'requested'
    and exists (
      select 1 from public.open_match_listings listing
      where listing.id = open_match_listing_participants.listing_id
        and listing.status = 'open'
        and listing.visibility = 'public'
        and listing.creator_id <> auth.uid()
        and (
          listing.rating_enforcement = 'preference'
          or listing.rating_system = 'none'
          or (
            listing.rating_system = 'utr' and exists (
              select 1 from public.profiles p where p.id = auth.uid()
                and p.utr_rating is not null
                and p.utr_rating between listing.utr_min and listing.utr_max
            )
          )
          or (
            listing.rating_system = 'ntrp' and exists (
              select 1 from public.profiles p where p.id = auth.uid()
                and p.ntrp_rating is not null
                and p.ntrp_rating between listing.ntrp_min and listing.ntrp_max
            )
          )
        )
    )
  )
  or (
    status = 'invited' and added_by = auth.uid()
    and exists (
      select 1 from public.open_match_listings listing
      where listing.id = open_match_listing_participants.listing_id and listing.creator_id = auth.uid()
    )
  )
);
