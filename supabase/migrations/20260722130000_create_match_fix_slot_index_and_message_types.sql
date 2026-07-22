-- supabase/migrations/20260722130000_create_match_fix_slot_index_and_message_types.sql
-- Fixes two bugs found during Task 31's final regression pass on the Create Match plan:
--
-- 1. approve_match_participant never assigned slot_index to the newly-approved
--    participant, leaving it null. src/app/match/[id].tsx places players into UI
--    slots by matching slot_index, so the approved participant was invisible and
--    the organizer's own row (slot_index=1) rendered twice. Fix: compute the
--    lowest unused slot in 1..capacity and assign it during approval.
--
-- 2. messages_message_type_check didn't include 'match_join_request' or
--    'match_request_decision' (src/lib/matchRequests.ts, Task 16), so every
--    such notification insert failed with a 23514 check-constraint violation
--    -- caught and logged by design, but silently dropping the notification.

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
  next_slot int;
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

  select min(s) into next_slot
  from generate_series(1, capacity) s
  where s not in (
    select slot_index from public.open_match_listing_participants
    where listing_id = p_listing_id and slot_index is not null
  );

  update public.open_match_listing_participants
  set status = 'joined', slot_index = next_slot
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

alter table public.messages drop constraint messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'match_invite', 'match_join_request', 'match_request_decision'));
