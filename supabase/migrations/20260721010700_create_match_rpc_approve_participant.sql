-- supabase/migrations/20260721010700_create_match_rpc_approve_participant.sql
create or replace function public.approve_match_participant(
  p_listing_id uuid,
  p_participant_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_row public.open_match_listings%rowtype;
  participant_status text;
  capacity int;
  reserved_count int;
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select * into listing_row from public.open_match_listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0001';
  end if;
  if listing_row.creator_id <> actor then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if listing_row.status <> 'open' then
    raise exception 'listing_not_open' using errcode = 'P0001';
  end if;

  select status into participant_status
  from public.open_match_listing_participants
  where listing_id = p_listing_id and user_id = p_participant_user_id;

  if participant_status is null or participant_status <> 'requested' then
    raise exception 'request_no_longer_pending' using errcode = 'P0001';
  end if;

  capacity := case when listing_row.format = 'doubles' then 4 else 2 end;
  select count(*) into reserved_count
  from public.open_match_listing_participants
  where listing_id = p_listing_id and status in ('joined','accepted','invited');

  if reserved_count >= capacity then
    raise exception 'listing_already_full' using errcode = 'P0001';
  end if;

  update public.open_match_listing_participants
  set status = 'joined'
  where listing_id = p_listing_id and user_id = p_participant_user_id and status = 'requested';

  if not found then
    raise exception 'request_no_longer_pending' using errcode = 'P0001';
  end if;

  if reserved_count + 1 >= capacity then
    update public.open_match_listings set status = 'full' where id = p_listing_id;
  end if;
end;
$$;

revoke all on function public.approve_match_participant(uuid, uuid) from public;
grant execute on function public.approve_match_participant(uuid, uuid) to authenticated;
