-- Structured blockout category, separate from the existing free-text
-- description (which becomes the optional note in the redesigned admin
-- Blockout UI). Additive column, no data loss.
--
-- NOTE: an earlier draft of this migration also planned to add an admin
-- UPDATE policy on public.bookings. That policy already exists —
-- "Admins can update bookings in their HOA", added by
-- 20260318124037_1ec7776e-3874-4ec2-afef-36035a82888b.sql — so it is
-- intentionally not repeated here.
alter table public.court_maintenance
  add column if not exists blockout_type text null;
