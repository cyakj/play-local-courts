-- Retires the dead 'casual_hit' value: confirmed via `select format, count(*) from
-- open_match_listings group by format` that zero rows use it, and it was never
-- reachable from any UI (activity_type, added in the prior migration, now owns
-- that concept properly).
alter table public.open_match_listings drop constraint open_match_listings_format_check;
alter table public.open_match_listings add constraint open_match_listings_format_check
  check (format in ('singles','doubles'));
