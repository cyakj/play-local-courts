-- supabase/migrations/20260721010650_create_match_widen_slot_index_capacity.sql
-- open_match_listing_participants.slot_index was constrained to 1-3 by an earlier,
-- unrelated migration (20260610190000_match_creation_v2.sql) that predates doubles
-- capacity being 4 (open_match_listings.format now allows 'doubles', capacity 4, per
-- create_match_listing's own capacity math: 4 for doubles, 2 for singles). Widening
-- to 1-4 so a full doubles match (organizer + 3 invitees, or 4 invitees with no
-- organizer) can actually be created without a check_violation.
alter table public.open_match_listing_participants
  drop constraint open_match_listing_participants_slot_index_check;
alter table public.open_match_listing_participants
  add constraint open_match_listing_participants_slot_index_check
  check (slot_index between 1 and 4);
