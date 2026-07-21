-- supabase/migrations/20260721010000_create_match_activity_visibility_rating_columns.sql
alter table public.open_match_listings
  add column activity_type text not null default 'match' check (activity_type in ('match','practice_hit')),
  add column visibility text not null default 'public' check (visibility in ('public','invite_only')),
  add column rating_system text not null default 'none' check (rating_system in ('utr','ntrp','none')),
  add column rating_enforcement text not null default 'preference' check (rating_enforcement in ('preference','strict')),
  add column linked_reservation_id uuid references public.bookings(id) on delete set null;

alter table public.open_match_listings alter column match_type set default 'casual';
