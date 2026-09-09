-- Allows the creator of a new HOA (hoas.admin_id = auth.uid(), set at insert time in
-- (cm)/index.tsx addCommunity()) to also insert their own approved admin membership row.
-- Without this, community creation always succeeded but the follow-up membership insert
-- was rejected by RLS (only resident/pending self-inserts were previously allowed),
-- leaving an orphaned HOA with no admin every time.
create policy hoa_memberships_insert_own_admin_creator
  on public.hoa_memberships
  for insert
  with check (
    auth.uid() = user_id
    and role = 'admin'
    and status = 'approved'
    and exists (
      select 1 from public.hoas h
      where h.id = hoa_id and h.admin_id = auth.uid()
    )
  );
