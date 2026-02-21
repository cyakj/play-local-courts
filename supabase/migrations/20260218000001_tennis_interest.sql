-- tennis_interest: capture user intent for the upcoming global TennisX product.
-- This table is intentionally minimal — it is only used to notify early adopters
-- when Tennis features go live.  No tennis gameplay data is stored here.

create table if not exists public.tennis_interest (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  zip_code    text,
  note        text,
  created_at  timestamptz not null default now()
);

-- Only the inserting user (or a service-role key) should be able to read rows.
alter table public.tennis_interest enable row level security;

-- Authenticated users can insert their own interest record
create policy "Users can express tennis interest"
  on public.tennis_interest
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Users can read their own records
create policy "Users can view own tennis interest"
  on public.tennis_interest
  for select
  to authenticated
  using (user_id = auth.uid());
