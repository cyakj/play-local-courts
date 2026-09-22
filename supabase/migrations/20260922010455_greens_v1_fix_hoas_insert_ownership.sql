-- I4: "Authenticated users can create communities" (INSERT, WITH CHECK
-- (auth.uid() IS NOT NULL)) let any authenticated user insert a hoas row
-- with admin_id pointed at an arbitrary other user. App code
-- (AddCommunityModal.tsx / (cm)/index.tsx) always sets admin_id: user.id
-- correctly, but nothing at the DB level enforced it.
--
-- Live-reproduced: the resident test account inserted
-- {name, admin_id: <admin test account's uid>} with Prefer: return=minimal
-- (avoiding Postgres's unrelated RLS-on-RETURNING behavior, which requires
-- the SELECT policy to also match and would otherwise mask this finding
-- behind a misleading "violates row-level security policy" error on ANY
-- insert, spoofed or not, since a brand-new hoa has no matching
-- hoa_memberships/profiles.hoa_id row yet for anyone) -- HTTP 201, and the
-- row was confirmed persisted with admin_id = the other user, inserted by
-- the resident. Row deleted immediately after confirming.
ALTER POLICY "Authenticated users can create communities" ON public.hoas
WITH CHECK (auth.uid() = admin_id);
