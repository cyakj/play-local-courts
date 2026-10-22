# Onboarding Phase 1 — Claudex review log (append-only)

Roles: host/planner/builder = Claude (claude-sonnet-5-5 via Claude Code); reviewer/inspector = Codex CLI 0.162.1 (effective model reported by the CLI: gpt-6.1-sol, read-only sandbox; requested model: CLI default). Scope: Resident signup + existing-community join flow. Authorization: implement; NO commit/push/hosted-DB/migration-apply/deploy. Budgets: rounds=2 (plan), inspections=2, fix rounds=2. Base commit: 4a09757 (working tree already had an unrelated modified `.claude/settings.local.json`).

## Plan review
| Round | Verdict | Findings → disposition |
|---|---|---|
| 1 | REVISE | R1 admin queue reads `community_join_requests` only → accepted (join via RPC writing both tables). R2 `request_hoa_membership` definer bypasses policies → accepted (guards in RPC). R3 stale active-community cache → accepted (refresh+select before navigating, refetch on focus). |
| 2 (resumed same session) | REVISE | R1–R3 confirmed addressed. R4 direct INSERT/DELETE bypass → accepted (RPC-only; policies dropped). R5 legacy `request_join_community` unguarded → accepted (hardened). |
Round budget exhausted: the final plan text (R4/R5 edits) was **not independently APPROVED**; covered by post-build inspection instead.

## Inspections (fresh Codex session each; coverage/limits in the runner results outside the repo)
| # | Verdict | Findings → disposition |
|---|---|---|
| 1 | REVISE | R6 legacy pending request lacks membership → accepted (RPC repair + backfill). R7 Open-community ignored failed selection → accepted (navigate only on successful selection; retryable error). R8 `migrate_existing_hoa_memberships()` callable, unguarded → accepted (REVOKE). |
| 2 | REVISE | R6' rejected legacy request w/o membership → accepted (re-request after a decision refused in both RPCs; backfill records rejection, never access). R7' banner hid pending-request entry for existing members → accepted (show when any pending). |
Inspection budget exhausted. **The final fixes for R6'/R7' were not re-inspected by Codex** (verified only by the node logic tests + typecheck).

## Proof run by the host
- `npx playwright test -c playwright.logic.config.ts` → 148 passed (128 pre-existing + 20 new in `tests/community-join-logic.spec.ts`).
- `npx tsc --noEmit`: no errors in changed files except the repo's pre-existing `Button.tsx`/`button.tsx` casing error (TS1149), also present in `hoa-application.tsx`.
- `npm run lint`: NOT runnable — `eslint` is not installed in node_modules.
- Not run: any hosted/DB behavior, device/simulator UI, two-session e2e (migration not applied).

## Remaining uncertainty
Hosted RLS/grants/auth settings (email confirmation on? redirect allow-list for `tenisxnative://`) were not inspected. Whether `profiles.hoa_role/hoa_status` are client-writable on the hosted DB (feeds `migrate_existing_hoa_memberships`) was not determined; the function is revoked in the migration regardless.
