-- supabase/migrations/20260721010300_create_match_rls_listings_select.sql
-- Replaces "Authenticated users can discover open matches". New rule: public+open
-- listings are discoverable by anyone; a listing's own participants can always
-- read it (this also fixes a pre-existing gap where a listing that left 'open'
-- status became unreadable even to its own confirmed participants).
drop policy if exists "Authenticated users can discover open matches" on public.open_match_listings;

create policy "Users can view public listings, their own, or ones they are on"
on public.open_match_listings
for select
using (
  (status = 'open' and visibility = 'public')
  or creator_id = auth.uid()
  or exists (
    select 1 from public.open_match_listing_participants p
    where p.listing_id = open_match_listings.id and p.user_id = auth.uid()
  )
);
