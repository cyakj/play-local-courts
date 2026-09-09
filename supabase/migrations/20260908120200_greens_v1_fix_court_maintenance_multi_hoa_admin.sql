-- Greens V1: court_maintenance still trusted the single-valued profiles.hoa_id
-- (via has_role('admin') AND profiles.hoa_id = courts.hoa_id, joined through
-- courts since court_maintenance has no direct hoa_id column) instead of the
-- per-HOA hoa_memberships/check_hoa_admin() pattern already used correctly
-- on courts and amenity_rules, and already applied to bookings and
-- maintenance_reports in 20260825114623_greens_v1_fix_multi_hoa_admin_visibility.
--
-- Live-verified real instance (not theoretical): user f6eec1c1-fa0e-4806-b0fb-
-- c61480870a95 is an approved admin (hoa_memberships, role='admin',
-- status='approved') of HOA f222b3de-2e6b-4f5e-999b-a7fcdd9750ae, but their
-- profiles.hoa_id points at a different HOA (cb6a0752-dee0-4a01-b74a-
-- 6fb25f47de98). Under the old policy this admin could not manage or even
-- see maintenance blockouts for f222b3de despite being its legitimate admin.
-- The same single-value trust is structurally also an over-permission risk:
-- any globally has_role('admin') user is authorized against whatever HOA
-- profiles.hoa_id happens to hold, with no check that they were ever
-- approved (via hoa_memberships) for that specific HOA.
--
-- Fix: scope both the admin-management and resident-view policies through
-- courts.hoa_id -> hoa_memberships, matching the "v2" pattern already in
-- production on the courts table.

drop policy if exists "Admins can manage maintenance in their HOA" on public.court_maintenance;
drop policy if exists "Residents can view maintenance in their HOA" on public.court_maintenance;

create policy "Admins can manage maintenance in their HOA v2"
on public.court_maintenance
for all
using (
  exists (
    select 1 from public.courts
    where courts.id = court_maintenance.court_id
      and check_hoa_admin(auth.uid(), courts.hoa_id)
  )
)
with check (
  exists (
    select 1 from public.courts
    where courts.id = court_maintenance.court_id
      and check_hoa_admin(auth.uid(), courts.hoa_id)
  )
);

create policy "Residents can view maintenance in their HOA v2"
on public.court_maintenance
for select
using (
  exists (
    select 1
    from public.courts
    join public.hoa_memberships
      on hoa_memberships.hoa_id = courts.hoa_id
    where courts.id = court_maintenance.court_id
      and hoa_memberships.user_id = auth.uid()
      and hoa_memberships.status = 'approved'
  )
);
