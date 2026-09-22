-- Live-reproduced through the real Add Community UI ((cm)/index.tsx
-- addCommunity(), twice with distinct test community names): the admin
-- test account's "Create Community" always fails with
-- "new row violates row-level security policy for table \"hoas\"", and
-- NO orphaned hoas row is left behind -- Postgres applies a table's SELECT
-- RLS policies to an INSERT's RETURNING clause as part of the SAME atomic
-- statement, so when that SELECT-visibility check fails, the entire
-- INSERT ... RETURNING rolls back (not just the returned data). Confirmed
-- by querying for both test rows immediately after: neither exists.
--
-- Root cause: neither hoas SELECT policy covers "a row I am about to
-- create as its admin". "Users can view their HOA" requires
-- profiles.hoa_id to already point at it (a separate, legacy column, never
-- touched by this flow). "Approved members can read full hoa details"
-- requires an approved hoa_memberships row -- which the app creates in a
-- SECOND insert, immediately after the first (chicken-and-egg: the first
-- insert's own RETURNING already needs this to succeed, and the second
-- insert's own WITH CHECK subquery (EXISTS ... hoas h WHERE h.admin_id =
-- auth.uid()) is itself subject to hoas' SELECT RLS, so it hits the exact
-- same gap even if the first insert somehow got past it).
--
-- Fix: add a SELECT policy scoped to admin_id = auth.uid() -- the same
-- column/boundary "Admins can update their HOA" (UPDATE) already trusts,
-- just extended to SELECT. Since the prior fix
-- (20260922010455_greens_v1_fix_hoas_insert_ownership) enforces
-- admin_id = auth.uid() at INSERT time, this can only ever match rows the
-- caller is genuinely the creator/admin of -- it is structurally incapable
-- of exposing another user's HOA, so it cannot reopen the cross-HOA
-- enumeration issue fixed in 20260921230632. This single, narrow addition
-- closes the gap for both the first insert's RETURNING and the second
-- insert's own RLS subquery, without a new SECURITY DEFINER code path.
CREATE POLICY "Creators can view their own HOA" ON public.hoas
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());
