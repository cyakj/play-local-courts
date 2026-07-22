-- supabase/migrations/20260722120000_create_match_fix_rls_recursion.sql
-- Fixes a live "infinite recursion detected in policy" error: open_match_listings'
-- SELECT policy and open_match_listing_participants' SELECT/INSERT/UPDATE policies
-- each subquery the other table directly, and Postgres re-evaluates each table's
-- own RLS on every such cross-reference -- a genuine unbounded cycle, confirmed in
-- production logs. Fix: route every cross-table check through a narrow, boolean-
-- returning SECURITY DEFINER function. Such a function runs as its owner (table
-- owner, RLS doesn't apply to owners without FORCE ROW LEVEL SECURITY, which is not
-- set here), so the query inside it bypasses RLS and the cycle never starts. Each
-- function returns ONLY a boolean -- never a row or raw column -- so that calling
-- it directly (EXECUTE must be granted to authenticated for policies to use it)
-- can't be used to read data the caller's own RLS wouldn't otherwise allow.

create or replace function public._is_listing_participant(_listing_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.open_match_listing_participants
    where listing_id = _listing_id and user_id = _user_id
  );
$$;

create or replace function public._listing_readable(_listing_id uuid, _actor uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.open_match_listings
    where id = _listing_id and (visibility = 'public' or creator_id = _actor)
  );
$$;

create or replace function public._listing_open_for_join(_listing_id uuid, _actor uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.open_match_listings listing
    where listing.id = _listing_id
      and listing.status = 'open'
      and listing.visibility = 'public'
      and listing.creator_id <> _actor
      and (
        listing.rating_enforcement = 'preference'
        or listing.rating_system = 'none'
        or (
          listing.rating_system = 'utr' and exists (
            select 1 from public.profiles p where p.id = _actor
              and p.utr_rating is not null
              and p.utr_rating between listing.utr_min and listing.utr_max
          )
        )
        or (
          listing.rating_system = 'ntrp' and exists (
            select 1 from public.profiles p where p.id = _actor
              and p.ntrp_rating is not null
              and p.ntrp_rating between listing.ntrp_min and listing.ntrp_max
          )
        )
      )
  );
$$;

create or replace function public._is_listing_creator(_listing_id uuid, _actor uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.open_match_listings
    where id = _listing_id and creator_id = _actor
  );
$$;

revoke all on function public._is_listing_participant(uuid, uuid) from public;
revoke all on function public._listing_readable(uuid, uuid) from public;
revoke all on function public._listing_open_for_join(uuid, uuid) from public;
revoke all on function public._is_listing_creator(uuid, uuid) from public;
grant execute on function public._is_listing_participant(uuid, uuid) to authenticated;
grant execute on function public._listing_readable(uuid, uuid) to authenticated;
grant execute on function public._listing_open_for_join(uuid, uuid) to authenticated;
grant execute on function public._is_listing_creator(uuid, uuid) to authenticated;

-- Rewrite open_match_listings SELECT: same logic, participant check now via function.
drop policy if exists "Users can view public listings, their own, or ones they are on" on public.open_match_listings;
create policy "Users can view public listings, their own, or ones they are on"
on public.open_match_listings
for select
to authenticated
using (
  (status = 'open' and visibility = 'public')
  or creator_id = auth.uid()
  or public._is_listing_participant(id, auth.uid())
);

-- Rewrite open_match_listing_participants SELECT: same logic, listing check via function.
drop policy if exists "Users can view participants of visible listings or their own row" on public.open_match_listing_participants;
create policy "Users can view participants of visible listings or their own row"
on public.open_match_listing_participants
for select
to authenticated
using (
  public._listing_readable(listing_id, auth.uid())
  or user_id = auth.uid()
);

-- Rewrite open_match_listing_participants INSERT: same two branches, both listing
-- checks now via function (self-join eligibility, and invite-branch creator check).
drop policy if exists "Users can request to join public listings, creators can invite" on public.open_match_listing_participants;
create policy "Users can request to join public listings, creators can invite"
on public.open_match_listing_participants
for insert
to authenticated
with check (
  (user_id = auth.uid() and status = 'requested' and public._listing_open_for_join(listing_id, auth.uid()))
  or (status = 'invited' and added_by = auth.uid() and public._is_listing_creator(listing_id, auth.uid()))
);

-- Rewrite open_match_listing_participants UPDATE (approve): same logic, creator
-- check via function.
drop policy if exists "Creator can approve a join request" on public.open_match_listing_participants;
create policy "Creator can approve a join request"
on public.open_match_listing_participants
for update
to authenticated
using (
  status = 'requested'
  and public._is_listing_creator(listing_id, auth.uid())
)
with check (status = 'joined');
