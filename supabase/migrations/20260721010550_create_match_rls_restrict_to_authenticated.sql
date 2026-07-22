-- supabase/migrations/20260721010550_create_match_rls_restrict_to_authenticated.sql
-- Tasks 9-11 introduced four RLS policies without a `TO authenticated` role clause, unlike
-- every other policy on these two tables. A policy with no role clause applies to PUBLIC,
-- which in Supabase includes the `anon` role -- widening read access to unauthenticated
-- requests. This restricts all four new policies to `authenticated`, matching the existing
-- convention (see e.g. "Admins can update bookings in their HOA").
alter policy "Users can view public listings, their own, or ones they are on"
  on public.open_match_listings to authenticated;

alter policy "Users can view participants of visible listings or their own row"
  on public.open_match_listing_participants to authenticated;

alter policy "Users can request to join public listings, creators can invite"
  on public.open_match_listing_participants to authenticated;

alter policy "Creator can approve a join request"
  on public.open_match_listing_participants to authenticated;
