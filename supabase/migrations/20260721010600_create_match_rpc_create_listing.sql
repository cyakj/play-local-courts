-- supabase/migrations/20260721010600_create_match_rpc_create_listing.sql
create or replace function public.create_match_listing(
  listing jsonb,
  invitee_ids uuid[] default '{}',
  organizer_playing boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  actor uuid := auth.uid();
  capacity int;
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  capacity := case when (listing->>'format') = 'doubles' then 4 else 2 end;
  if array_length(invitee_ids, 1) is not null
     and array_length(invitee_ids, 1) > (capacity - case when organizer_playing then 1 else 0 end) then
    raise exception 'invitee_count_exceeds_capacity' using errcode = 'P0001';
  end if;

  insert into public.open_match_listings (
    creator_id, activity_type, format, visibility, match_date, start_time, end_time,
    duration_minutes, location, location_id, location_source, play_with,
    rating_system, rating_enforcement, ntrp_min, ntrp_max, utr_min, utr_max,
    note, court_reserved, linked_reservation_id, match_type
  ) values (
    actor,
    coalesce(listing->>'activity_type', 'match'), listing->>'format', coalesce(listing->>'visibility', 'public'),
    (listing->>'match_date')::date, (listing->>'start_time')::time, (listing->>'end_time')::time,
    coalesce((listing->>'duration_minutes')::int, 90), listing->>'location', nullif(listing->>'location_id','')::uuid,
    coalesce(listing->>'location_source', 'directory'), coalesce(listing->>'play_with', 'all'),
    coalesce(listing->>'rating_system', 'none'), coalesce(listing->>'rating_enforcement', 'preference'),
    coalesce((listing->>'ntrp_min')::numeric, 1.0), coalesce((listing->>'ntrp_max')::numeric, 7.0),
    coalesce((listing->>'utr_min')::numeric, 0), coalesce((listing->>'utr_max')::numeric, 16.5),
    listing->>'note', coalesce((listing->>'court_reserved')::boolean, false),
    nullif(listing->>'linked_reservation_id','')::uuid,
    'casual'
  )
  returning id into new_id;

  if organizer_playing then
    insert into public.open_match_listing_participants (listing_id, user_id, status, slot_index)
    values (new_id, actor, 'joined', 1);
  end if;

  if invitee_ids is not null and array_length(invitee_ids, 1) > 0 then
    begin
      insert into public.open_match_listing_participants (listing_id, user_id, status, added_by, slot_index)
      select new_id, unnest(invitee_ids), 'invited', actor,
             row_number() over () + case when organizer_playing then 1 else 0 end;
    exception when unique_violation then
      raise exception 'duplicate_invitation' using errcode = 'P0001';
    end;
  end if;

  return new_id;
end;
$$;

revoke all on function public.create_match_listing(jsonb, uuid[], boolean) from public;
grant execute on function public.create_match_listing(jsonb, uuid[], boolean) to authenticated;
