-- supabase/migrations/20260721010200_create_match_participant_status_requested.sql
alter table public.open_match_listing_participants drop constraint open_match_listing_participants_status_check;
alter table public.open_match_listing_participants add constraint open_match_listing_participants_status_check
  check (status in ('invited','accepted','declined','requested','joined'));
