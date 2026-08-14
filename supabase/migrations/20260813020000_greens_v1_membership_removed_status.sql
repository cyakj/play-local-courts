-- Greens V1: allow admins to deactivate/remove a member without deleting
-- their history (hoa_memberships currently only allows pending/approved/
-- rejected). STAGED ONLY — not yet applied to the live database.

ALTER TABLE public.hoa_memberships DROP CONSTRAINT IF EXISTS hoa_memberships_status_check;
ALTER TABLE public.hoa_memberships
  ADD CONSTRAINT hoa_memberships_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed'));
