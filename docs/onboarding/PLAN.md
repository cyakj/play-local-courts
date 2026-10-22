# Onboarding Phase 1 — Resident signup → community search → join request → pending status

Host/planner/builder: Claude. Reviewer/inspector: Codex. Time-boxed vertical slice.

## Recon findings (sources)
- `src/app/(auth)/login.tsx:309-317` — "Sign up" pushes `/hoa-application` (HOA-admin applicant form that needs a session). No native Resident signup exists.
- `src/contexts/AuthContext.tsx`, `src/components/community/JoinExistingHOA.tsx`, `CommunitySelection.tsx` are legacy web (react-router/shadcn); not part of the native app. Not reused, not modified.
- `supabase/migrations/20260518190556_*.sql:30-35` — `public_hoa_directory` = `SELECT id,name,community_type FROM hoas`, granted to anon+authenticated, **no approval filter** → unapproved/pending communities are searchable.
- `supabase/migrations/20261013120000_platform_approval_and_secure_messaging.sql:107-115` — INSERT policies on `hoa_memberships` already require own row, `role='resident'`, `status='pending'`, `hoa_is_approved(hoa_id)`. `UNIQUE(user_id,hoa_id)` exists (initial migration). `hoa_memberships_update_own` was dropped (20260922004621); users may DELETE own *pending* rows.
- `status` CHECK allows only `pending|approved|rejected`; there is no `withdrawn` state.
- Admin approve/reject exists: `src/app/(admin)/pending-requests.tsx` (updates `hoa_memberships`). Reused unchanged.
- `src/app/_layout.tsx` AuthGuard + `(auth)/_layout.tsx` already allow unauthenticated access to `(auth)/*` and bounce signed-in users away.
- Roles: `login.tsx`/`index.tsx` route by `user_roles` (platform_reviewer → `(platform)`, admin-ish → `(cm)`, else `(resident)`). `platform_reviewer` is trigger-guarded. Signup must never send role/hoa/status in auth metadata.

## Decisions (made; deferred items listed)
1. Resident signup is a **new separate screen** `(auth)/signup.tsx` (full name, email, password). It passes only `full_name` in metadata. After `signUp`, if no session is returned the user sees a "Verify your email" state with cooldown-limited resend; no auto-login.
2. Login "Sign up" now routes to the Resident signup. HOA-admin application is NOT touched (separate account type, later phase).
3. Community search reads `public_hoa_directory` (id, name, community_type only), min 2 chars, LIKE-wildcards escaped, limit 20, only reachable post-auth in the UI. **Migration fixes the view to approved communities only.**
4. Join request goes through the **existing server operation** `request_hoa_membership(target_hoa_id, join_message)` (SECURITY DEFINER; atomically writes `hoa_memberships` AND `community_join_requests`, which is what the reused admin queue in `(admin)/pending-requests.tsx` reads — review finding R1). Client never sets role/status. Duplicate: the function raises "Membership already exists…" → UI maps to "already requested" and re-fetches the existing status. UI disables the button while submitting.
5. Server-side hardening (migration file only, NOT applied): (a) approved-only directory view; (b) `user_email_verified()` SECURITY DEFINER helper; (c) `CREATE OR REPLACE request_hoa_membership` now requires `auth.uid()` not null, verified email, and `hoa_is_approved(target_hoa_id)` BEFORE either insert (review finding R2: the definer function bypassed the INSERT policies), with EXECUTE revoked from PUBLIC/anon and granted to authenticated; (d) **RPC-only lifecycle (R4)**: `DROP POLICY IF EXISTS` the resident direct write paths — `Users can request to join communities` and `hoa_memberships_insert_own_pending_resident_only` (INSERT) and `Users can cancel their own pending requests` (DELETE) on `hoa_memberships`, and `Users can create their own join requests` (INSERT) on `community_join_requests`; admin policies (`hoa_memberships_insert_own_admin_creator`, admin update/delete) are untouched; legacy callers already use RPCs (`ActiveHOAContext.tsx:206`, `JoinCommunity.tsx:106`, `supabaseService.ts:815`); (d2) **legacy RPC (R5)**: `CREATE OR REPLACE request_join_community` gets the same guards (auth uid, verified email, approved HOA) and writes both tables atomically, returning the join-request id, EXECUTE revoked from PUBLIC/anon; (e) new `withdraw_membership_request(target_hoa_id)` SECURITY DEFINER: deletes only the caller's own `pending` membership AND their pending `community_join_requests` row so the admin queue never shows a stale request.
6. Status screen `join-community.tsx` lists the user's own memberships with pending / approved / rejected labels; pending can be **withdrawn** via `withdraw_membership_request`. Approved shows "Open community": it calls `refreshActiveCommunity()`, awaits it, then `setActive(hoaId)`, then navigates to `/(resident)` (review finding R3). The screen re-fetches on focus (`useFocusEffect`) so an admin approval made elsewhere is observed.
7. Resident home shows a small banner CTA when the user has no approved community (→ join screen) or a pending request.

### Deferred (needs a backend/product decision — documented, not improvised)
- A true `withdrawn` status (needs CHECK change + audit-preserving withdraw) — today withdraw = delete pending row; UI shows "not requested" afterwards.
- Re-request after `rejected` (UNIQUE blocks it): admin-reset vs cooldown policy.
- A `discoverable` flag on `hoas` (opt-out of search). Today discoverable = approved.
- Anon enumeration of approved community names via the view's anon grant (kept for legacy web).
- Community-interest request / invitation flow (not-listed communities).

## Acceptance criteria
- A1 Login "Sign up" opens Resident signup; submitting calls `auth.signUp` with only `full_name` metadata; no role/hoa/status metadata.
- A2 Without a returned session, "Verify your email" shows and signup does not navigate into the app.
- A3 Search only issues queries for ≥2 sanitized chars and returns ≤20 rows from the directory view; wildcard chars cannot widen the match.
- A4 Migration: directory view filters `approval_status='approved'`; `request_hoa_membership` rejects null uid / unverified email / unapproved HOA before inserting and is not executable by anon; both INSERT policies require verified email + approved HOA; `withdraw_membership_request` removes only own pending rows in both tables; migration is idempotent (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`).
- A5 Join call is `rpc('request_hoa_membership', {target_hoa_id, join_message})` with no role/status/user id from the client; the new request is visible to the admin queue (both tables written in the one function); duplicate ("Membership already exists") → "already requested" not an error; rejected is displayed as not approved.
- A6 Status labels map pending/approved/rejected; unknown → safe fallback; loading/empty/error+retry states exist.
- A7 After Open community on an approved membership the shared community store contains that HOA before navigation; status list refetches on focus.
- A8 No resident-callable direct write path to `hoa_memberships` / `community_join_requests` remains (migration drops them); `request_join_community` is hardened identically.
- A9 Existing tests/typecheck unaffected; Stage 2 and admin/platform/tennis code unchanged.

## Verification
- `npx playwright test -c playwright.logic.config.ts community-join-logic` (new, node-only; includes migration-text assertions).
- `npx tsc --noEmit -p tsconfig.json` (no new errors vs baseline) and `npm run lint` on changed files.
- Manual/hosted verification (NOT run here): apply migration to a non-prod project, then `tests/e2e` style two-session check. Hosted DB is untouched in this sprint.

## Non-goals
HOA-admin onboarding, platform review changes, community-interest flow, email/SMS/push, hosted migration apply, commits/pushes.


## Review status
Round 1: REVISE (R1–R3, accepted, fixed, confirmed addressed by Codex in round 2). Round 2: REVISE (R4, R5 accepted and folded in above). `rounds=2` budget exhausted: this final plan text (R4/R5 edits) is **not independently APPROVED**; it is covered by the post-build Codex inspection of the actual migration and code instead.

## Checkpoint — 2026-10-22 (Phase 1 saved locally, work paused)
**Implemented:** Resident signup (`(auth)/signup.tsx`, full_name-only metadata, verify-email state + resend), login "Sign up" rerouted, `join-community.tsx` (approved-only search, request via RPC, pending/approved/not-approved states, withdraw, Open community with store refresh), `CommunityJoinBanner` on resident home, logic module + data layer, and unapplied migration `20261022120000_resident_join_flow_hardening.sql`.
**Tests passed:** `npx playwright test -c playwright.logic.config.ts` → 148 passed (20 new in `tests/community-join-logic.spec.ts`, incl. static migration assertions). `tsc`: no new errors in changed files (pre-existing TS1149 `Button.tsx` casing only).
**Unverified:** migration NOT applied anywhere; no DB/RLS behavior run; no device/iPhone/simulator run; `npm run lint` not runnable (eslint missing); hosted email-confirmation setting and `tenisxnative://` redirect allow-list unknown; whether `profiles.hoa_role/hoa_status` are client-writable on hosted DB. Final fixes (R6' rejected-legacy-request guard, R7' banner) were NOT re-inspected by Codex (inspection budget used).
**Next steps:** (1) Codex re-inspection of the final snapshot (`inspect --base 4a09757`); (2) apply the migration to a NON-PROD Supabase project, then run a two-account e2e (Resident signup → request → admin approve → access); (3) iPhone/Expo test of signup, verify-email deep link, search, request, withdraw, Open community; (4) decide deferred items (withdrawn status, re-request after rejection, discoverable flag, anon directory grant, not-listed community flow).
