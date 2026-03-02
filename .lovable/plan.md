
Issue confirmed:
- Publish is failing because Supabase returns `42P17: infinite recursion detected in policy for relation "ladders"`.
- This is a database RLS policy cycle (not a wizard field bug): `ladders` policies query `ladder_teams`/`ladder_registration_requests`, while those tables also query `ladders`.

Implementation plan to make the fix durable:

1) Replace recursive ladder visibility policies with security-definer helpers
- Add `public.can_view_ladder(_ladder_id uuid)` (SECURITY DEFINER, STABLE, `search_path=public`) that checks visibility rules internally (admin, same HOA, participant, registration, invitation) without triggering RLS recursion.
- Add `public.is_ladder_admin(_ladder_id uuid)` helper for admin checks used by child tables.

2) Refactor RLS policies to call helpers instead of cross-querying tables directly
- `ladders` SELECT: drop the multiple cross-table SELECT policies and replace with one policy using `can_view_ladder(id)`.
- `ladder_teams` SELECT/ALL admin policy: replace `EXISTS (SELECT ... FROM ladders ...)` with helper calls.
- `ladder_matches` and `ladder_registration_requests` admin/view policies: replace direct ladders subqueries with helper calls where needed.
- Keep INSERT/UPDATE/DELETE intent unchanged (same access model), only remove recursion source.

3) Harden wizard publish behavior so this class of failure is easier to diagnose
- Keep status publish logic as `active` (already corrected).
- Improve submit error handling to show the returned Supabase message/code in toast/log (instead of generic “Failed to create competition”), so future policy regressions are immediately identifiable.

4) Validate end-to-end before closing
- Admin publish from wizard (Save Draft + Publish).
- Coach publish (if coach role without HOA admin role).
- Open Compete list, Manage list, and a competition detail after publish.
- Confirm no `42P17` in console/network and inserted ladder is visible immediately in Manage tab.

Technical details (what will be changed):
- New SQL migration only (no manual DB edits): create helper functions, drop/recreate affected policies idempotently.
- Policy targets:
  - `public.ladders` SELECT policies (especially “Users can view ladders they participate in/registered for”).
  - `public.ladder_teams` SELECT/admin policies.
  - `public.ladder_registration_requests` admin SELECT/UPDATE policies.
  - `public.ladder_matches` admin/view policy references if still directly dependent on ladder subqueries.
- Frontend file to harden messaging: `src/components/compete/CreateCompetitionWizard.tsx`.

Expected outcome:
- Competition creation no longer fails on publish.
- Visibility rules remain intact.
- Recursion bug is removed at the RLS design level, preventing repeat regressions.
