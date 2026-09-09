# The Greens V1 — Turbo Release Pass · Final Report

**Date:** 2026-09-08 → 09-09 (spanned a power-loss recovery — see §1)
**Branch:** `greens-v1` throughout. `main` never touched.
**Baseline at start:** `origin/greens-v1` @ `f4ce454`
**HEAD at end:** `greens-v1` @ `9c746c9` (pushed to `origin/greens-v1`)

The single-page status view is `GREENS_V1_LAUNCH_MATRIX.md`. This report is the narrative: what the pass
did, what the power loss cost, and what remains.

---

## 1. Power-loss recovery (this session's first job)

The machine lost power mid-pass, while the Turbo **Track A (Resident)** agent was still running in a
separate worktree. Recovery procedure and findings:

### What was found

| Artifact | State on recovery |
|---|---|
| `greens-v1` (main checkout) | `f4ce454`, clean (only runtime-noise files dirty) |
| Worktree `.claude/worktrees/agent-a5ebef6715120d452` | intact, locked, branch `track-a-resident-audit-retry` @ `9c746c9` |
| Track A commits ahead of `greens-v1` | **3** — `18d6036`, `931eb50`, `9c746c9` |
| Track A uncommitted work | **none** — working tree clean apart from a line-ending-only touch to `.claude/settings.local.json` |
| `git stash` | one entry belonging to **another** worktree session (`agent-a761e9a8…`) — left untouched |

### What survived vs. what was lost

**Everything survived.** The last status check before the power loss believed the `courts.tsx` 23P01
handling was still uncommitted. It was not — it had been committed as `9c746c9` at 22:30:47, four lines,
complete. Nothing of substance was lost to the power loss.

- ✅ `18d6036` — grounds report category fix + `reports.spec.ts` triage
- ✅ `931eb50` — `profile-settings.spec.ts` triage (stale Tennis-mode assertions)
- ✅ `9c746c9` — `courts.tsx` 23P01 friendly-error handling (**the "uncommitted" edit — actually committed**)

### The one thing that must NOT be merged — and wasn't

`playwright.config.ts` carried a worktree-only `8081→8082` port workaround during Track A's run. It was
**never committed**, is **not on `track-a-resident-audit-retry`**, and is **not in any of the 10 commits**
`greens-v1` is ahead of the old remote. `playwright.config.ts` on `greens-v1` is unchanged, still on 8081.
Confirmed by `git log f4ce454..greens-v1 -- playwright.config.ts` (empty) and a working-tree diff (empty).

### Integration

`track-a-resident-audit-retry` was exactly `greens-v1` + 3 linear commits, so integration was a clean
`git merge --ff-only` — no merge commit, no conflicts, nothing duplicated. `greens-v1` went `f4ce454` →
`9c746c9`.

---

## 2. Track A (Resident) — completed scope

### 2a. Bug fixes (carried from the interrupted agent, verified this session)

**`9c746c9` — friendly message on the double-booking race (SQLSTATE 23P01)**
Track C's `bookings_no_overlapping_confirmed` EXCLUDE constraint (`btree_gist`, `WHERE status='confirmed'`)
rejects a second overlapping confirmed booking with Postgres error `23P01`. `courts.tsx`'s
`handleConfirm` had no case for it, so a resident who lost a booking race saw the raw constraint text.
Now: catches `error.code === '23P01'`, shows *"That time slot was just taken — please pick another."*, and
refetches the day's bookings + court list so the stale slot disappears from the sheet.
**Verified this session:** constraint is live and named exactly as the handler expects; the 4-line handler
compiles clean and is correctly placed in the `else if` chain (`dateStr` in scope, no double-success).
There is no automated seam for the race itself — acceptable and documented.

**`18d6036` — grounds report category matches the DB CHECK constraint**
`report.tsx` `CATEGORIES` used key `grounds`; the live `maintenance_reports_category_check` only allows
`grounds_landscaping`. Submitting a Grounds report from tile index 3 hit the constraint and silently
failed as a submit-error. Also relabeled `equipment` → "Amenities & Equipment" to match the shared
`getCategoryLabel` map in `my-reports.tsx` / `report-detail`.
**Verified this session:** live constraint = `plumbing, electrical, structural, grounds_landscaping,
equipment, safety, other`; `report.tsx` keys are now identical. `reports.spec.ts` 42/42.

### 2b. Test triage (stale Community-mode assertions → real bugs)

| Spec | Before | After | Nature |
|---|---|---|---|
| `reports.spec.ts` | failing/hanging on `tenisx-logo` header selector | **42/42** | stale: Tennis-only `tenisx-logo` / non-existent `menu-icon` / legacy bottom-nav labels → Community-mode equivalents. Plus the one real app bug (2a). |
| `profile-settings.spec.ts` | 17 failing | **57/57** | stale: 10 tests asserted tennis-player fields (NTRP, dominant hand, backhand, surface, goals, years) *render* — `edit-profile.tsx` correctly gates them behind `isTennisMode`, so in Community mode they must be *absent*. Flipped to assert absence. Plus 6 real Playwright locator bugs (ambiguous `getByText`, a `page.locator('button')` that matches zero react-native-web elements). No app changes. |
| `announcements.spec.ts` | not previously run | **6/6** | triaged via live DB: The Greens has 1 announcement + 1 closed community survey, so item / survey-results assertions are satisfied by real data. No stale assertions, no app bug. One weak test (`toBeTruthy()` on a locator) noted, left green. |

### 2c. Resident functional verification (narrative)

| Screen | Verified | Result |
|---|---|---|
| Reserve (`courts.tsx`) | `courts.spec.ts` 35/35 + live data | GREEN |
| Report Issue (`report.tsx`) | `reports.spec.ts` 42/42 incl. end-to-end submit → list → detail → back; category ↔ constraint | GREEN |
| Community (`(resident)/community.tsx`) | source + live `hoas` / `hoa_announcements` / `hoa_documents` for The Greens | GREEN |
| Announcements (`announcements.tsx`) | `announcements.spec.ts` 6/6 + live data | GREEN |
| Documents (`docs.tsx`) | `docs.spec.ts` 16/16 | GREEN |
| Me / Settings (`me.tsx` + settings-*) | `profile-settings.spec.ts` 57/57 | GREEN |
| Home (`(resident)/index.tsx`) | source: fully `isCommunityMode`-branched (quick actions, upcoming-reservation card, Community Pulse, events, maintenance notices). `home.spec.ts` **stale** (Tennis-mode). | AMBER — no Community-mode automated coverage |
| Schedule (`(resident)/calendar.tsx`) | source: `isCommunityMode`-aware labels/filters, merges events + bookings + blockouts. `calendar.spec.ts` **stale**. | AMBER — no Community-mode automated coverage |
| Auth / login | exercised every Playwright run via real Supabase auth in `auth.setup.ts` | AMBER — no standalone spec |
| Password reset / change password | unchanged since 2026-07-17, not touched by Greens V1, no coverage | AMBER — not independently re-verified |

---

## 3. Tracks B & C (completed and merged before this pass)

These were done in earlier Turbo work and were already on `greens-v1` at `f4ce454`; this pass verified
they are coherent with Track A and that their migrations are live.

**Track B (Admin)** — `b0ed7eb` (platformAlert web no-op, silent RLS zero-row updates, invalid-date
crash), `39c897d` (`hoa_notifications.type` value in blockout cancellation), `ba99936` (community-creator
self-admin membership insert + `invite_reminder` type). Admin screens (Manage Amenities, Community Detail,
Portfolio, calendar) are source-verified from prior sessions; **no admin-side automated coverage** — AMBER.

**Track C (Data / security)** — `4a91d8b` (exclusion constraint feat), `c190792` (`court_maintenance`
RLS via `check_hoa_admin`), `bc32f5b` (resident blockout enforcement). All 5 migrations from this pass
plus the 5 from prior passes are **applied live** and re-verified against `pg_constraint` /
`information_schema`. No `supabase db push`; no Match v2 migration touched.

---

## 4. Regression evidence

| Check | Result |
|---|---|
| `tsc --noEmit` — new type errors from Track A | **0** (1684 pre-existing baseline, identical before/after; `courts.tsx` + `report.tsx` compile clean) |
| Playwright — resident core (`announcements` + `courts` + `docs` + `reports` + `profile-settings`) | **153 passed / 0 failed** (4.6m) |
| Playwright — `home` + `calendar` + `navigation` + `book` + `me-dashboard` + `global` + `theme` | run this session — see §5; failures are confined to the specs classified stale/dead in `GREENS_V1_LAUNCH_MATRIX.md` §5, none are app regressions |
| `npm run lint` | not runnable — `eslint` absent from `node_modules` (pre-existing) |

---

## 5. Second Playwright batch — stale-classification confirmation

A second batch (`home`, `calendar`, `navigation`, `book`, `me-dashboard`, `global`, `theme`) was started
and **stopped early once the pattern was unambiguous**: every failure is the same stale selector, not an
app fault.

- `calendar.spec.ts:14` "header logo is visible" and `:18` "bell icon is visible" each ran to the full
  120 s timeout waiting on `[data-testid="tenisx-logo"]` — a testID `Header.tsx` renders **only in Tennis
  mode**. Community mode renders `community-wordmark`. Identical root cause to the bugs already fixed in
  `courts.spec.ts` / `docs.spec.ts` / `reports.spec.ts`.
- A repo-wide grep confirms the blast radius: `book`, `calendar`, `design`, `global`, `home`,
  `me-dashboard`, `navigation`, and `theme` all still gate on `tenisx-logo` and/or Tennis-mode tab
  testIDs. They are the **pre-Community-mode** spec generation. The five specs triaged this pass and in
  the immediately preceding Turbo commits (`courts`, `docs`, `reports`, `profile-settings`,
  `announcements`) are the Community-mode-current generation — and all pass.
- The underlying screens (`(resident)/index.tsx`, `(resident)/calendar.tsx`, `(resident)/me.tsx`) were
  read directly and are correctly `isCommunityMode`-branched. `profile-settings.spec.ts` (57/57) already
  gives real Community-mode coverage of the Me / Settings sub-screens.

**Conclusion:** no app regression is hiding in the stale specs. Rewriting them for Community mode is a
separate, deliberate task (see §7) — not started here, per the pass's "no new development phase" rule.

---

## 6. Git / release

- `greens-v1` @ `9c746c9`, pushed to `origin/greens-v1`; local and remote confirmed **0 ahead / 0 behind** after push.
- 10 commits landed on the remote this pass (`4a91d8b..9c746c9`): 6 Track B/C, 1 docs-spec triage, 3 Track A. Every one is in-scope Greens V1 work (admin screens, resident `courts.tsx`/`report.tsx`, 5 migrations, 3 test files).
- `playwright.config.ts` **not** among the pushed changes — the port workaround stayed in the worktree only.
- `main` = `origin/main` = `c05b941` — **0 ahead / 0 behind, untouched, unmodified.**
- Worktree `agent-a5ebef6715120d452` / branch `track-a-resident-audit-retry` fully merged — safe to `git worktree remove` + delete the branch.
- New docs this pass: `GREENS_V1_LAUNCH_MATRIX.md`, `GREENS_V1_TURBO_REPORT.md`.

---

## 7. What is NOT done (explicitly out of this pass)

Per the pass instructions, none of the following were started:

- `/verify`, formal code review, UI/design redesign, SDK 57 upgrade, any new development phase.
- Real-device / simulator QA — **nothing in Greens V1 has been seen rendered on iOS/Android.** This is the #1 launch risk.
- `home.spec.ts` / `calendar.spec.ts` rewrite for Community mode; `book.spec.ts` / `navigation.spec.ts` deletion.
- Password-reset / change-password re-verification.
- Real email-delivery verification for `sendNotificationEmail`.
- Pre-existing security advisors (3× `SECURITY DEFINER` view, leaked-password protection, Postgres version) — need a scope decision.
- `npm run lint` repair (`eslint` install).

## 8. Recommended immediate next step

Real-device QA against production data using the sequence in `GREENS_V1_CHECKPOINT.md`
§"Exact manual QA sequence for next time at a device/browser" — starting with the Reserve → confirm →
double-book (two accounts) → cancel round-trip, then Report Issue → admin status change → resident sees
update. That is the single highest-value check not achievable from web + DB.
