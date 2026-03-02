
Goal: stop the recurring “new row violates row-level security policy for table ladders” error for your Greens admin account and make competition publish reliable.

What I found
1) Your role mix (HOA admin + regular player) is not a conflict by itself.
- The current INSERT policy is additive (OR-based), so having extra roles does not block access.
- The `ladders` INSERT policy is currently scoped to `authenticated` (correct), not `public`.
2) The recurring failure is more likely from one of these:
- You are occasionally publishing from a different logged-in account than expected (resident account vs admin account).
- Role source mismatch in legacy data paths (profile says admin, but canonical role tables differ for some accounts).
- Insert path lacks preflight diagnostics, so all permission failures look identical.

Implementation plan
1) Add explicit preflight permission diagnostics before publish
- Add an RPC helper that returns:
  - `auth_uid`
  - `has_admin_role`
  - `has_coach_role`
  - `has_coach_profile`
  - `has_approved_admin_membership_for_selected_hoa`
  - `can_create_result`
- Call this in the wizard right before insert; if false, show a specific toast explaining exactly what’s missing.

2) Harden server-side creation path (remove ambiguity from client-sent admin_id)
- Add a secure RPC `create_competition_ladder(...)` that:
  - Forces `admin_id = auth.uid()` on the server
  - Validates create access with one centralized function
  - Inserts and returns the created row
- Update `CreateCompetitionWizard` to call this RPC instead of raw `from('ladders').insert(...)`.

3) Normalize role data so admin identity is consistent
- Add a migration that backfills missing canonical role records for legacy admins:
  - Ensure approved HOA admins have matching `user_roles('admin')`
  - Ensure HOA membership/admin rows are aligned where expected
- This prevents “UI says admin but policy check fails” drift.

4) Keep RLS centralized and single-source
- Refactor `ladders` INSERT policy to use only `public.can_create_ladder(admin_id, hoa_id)` so logic is not duplicated in multiple policies/functions.
- Keep `TO authenticated`.

5) Improve error observability in UI
- On publish failure, surface `error.code`, `error.message`, and policy hint text (safe subset) in dev/debug mode so we can immediately identify whether it was auth, role, or data-shape related.

End-to-end validation plan (until it works)
1) Log in as the exact Greens admin account you intend to use.
2) In Compete → Manage → Create:
- Publish a Public ladder.
- Publish a Community ladder (with Greens selected as active HOA).
- Publish a Round Robin.
3) Confirm each appears in Manage list and row exists in `ladders` with:
- `admin_id = your auth user id`
- `hoa_id = Greens` for community-scoped create
4) Negative checks:
- Attempt publish from a resident-only account and confirm a clear “missing admin/coach permission” message (not generic RLS error).

Technical details
- Why I’m confident roles are not conflicting: current policy logic is OR-based and evaluated for authenticated users.
- Why this plan is stronger: moving creation to RPC with server-assigned `admin_id` removes client mismatch risk and gives deterministic permission checks.
- Why this prevents repeat regressions: centralized function + preflight diagnostics + role backfill closes both policy and data consistency gaps.
