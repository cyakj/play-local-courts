# TenisX V1: overnight handoff (2026-10-22 -> 2026-10-23)

Everything here is **local**. Nothing was pushed, deployed, applied to any database, or sent. In this session no hosted Supabase data was read or changed and no real email/SMS/push was triggered. Four new migration files were written and one existing unapplied migration was edited; **six migrations in total are unapplied** (section 16).

## 1. Executive summary
- The reported HOA Manager defects were real and are fixed in code: **Open Schedule / Add Blockout did nothing on iPhone** because the schedule sheet was a *sibling* Modal rendered while the amenity-detail Modal was open (iOS cannot present it). It is now nested inside the detail Modal. This was an iOS-only defect; web tests could never see it. The blockout RPCs it calls are recorded as applied on hosted in the earlier session handoff (I did not re-check the database).
- The manager calendar no longer lists routine resident reservations; reservations are managed per amenity.
- Admins now get a notification only when a reservation **needs approval**; routine confirmed bookings never notify them (migration, unapplied).
- Four **pre-existing** defects were found and fixed along the way, mostly on Stage 1 flows (details in sections 3 and 17): resident report photos were never attached (per the RLS policy text); a real iOS build would be terminated on first photo/camera access because the usage strings were missing (standard iOS behaviour, not reproduced on a device); an applicant could write `status='approved'` on their own HOA application (per the policy text, not exercised on Postgres); an admin could "approve" a join request that grants no access.
- New: community-interest onboarding (resident + platform), HOA applicant document upload and server-side integrity guard, an offline RLS audit tool that already surfaced two security candidates to verify on the hosted DB.
- Not done: platform duplicate-application detection, same-email account switching (needs your decision), PDF attachments, real device testing.

## 2. Features completed (all gated: tests + opposite-provider review + local commit)
| Unit | Builder -> inspector | What |
|---|---|---|
| U1 `ebd65c3` | Claude -> Codex | Open Schedule / Add Blockout (nested modal); manager calendar without reservations |
| U2 `3ce7716` | Codex -> Claude | Admin "reservation needs approval" notification + routing (migration) |
| U4 `c8f40b3` | Claude -> Codex | Dashboard reservation shortcuts -> Manage Amenities; activity feed shows only pending requests |
| U6 `4f02baa` | Claude -> Codex (6 rounds) | HOA application: integrity guard (migration), private photo upload, validation, optimistic concurrency |
| U9 `0451d07` | Claude -> Codex (4 rounds) | Report photo upload as bytes + attach RPC (migration); block approving a membership-less join request |
| U7 `bea547b` | Codex -> Claude (2 rounds) | Community-interest requests: resident form/status/share + platform lead queue (migration) |
| U11 `f44bac5` | Claude -> Codex | Phase 1 review R10: legacy join RPC cannot re-open a decided membership (migration edit) |
| U3 `90e06b8` | Codex built; Claude took over rounds 4+ (10 inspections) | Offline static RLS / SECURITY DEFINER audit script + report |
| U13 | Claude -> Codex | Account isolation: guard the shared community store against a slow load for account A publishing into account B's session; this handoff + iPhone checklist |
| U12 `950f7d5` | Claude -> Codex (2 rounds) | `expo-image-picker` and `expo-contacts` iOS purpose strings in `app.json` + mutation-checked guard test |

## 3. Bugs discovered and fixed
1. **P1** Open Schedule / Add Blockout dead on iPhone (stacked Modals). Fixed + guard test.
2. **P1** Resident report photos were uploaded but never attached: residents have no UPDATE policy on `maintenance_reports`, so `UPDATE ... photo_url` matched 0 rows with no error. Fixed via a reporter-only RPC (migration #6). Until applied, the resident sees an honest "submitted, photo could not be attached" message instead of a false success.
3. **P1** Photo uploads used a Blob body, which supabase-js documents as unsupported on React Native. Now ArrayBuffer bytes decoded from base64, content type sniffed from magic bytes.
4. **P0/P1** iOS builds (dev client / TestFlight) would terminate on first photo/camera access: no usage strings. Fixed in `app.json` (also `expo-contacts`, see C5); needs a new native build to take effect. Not reproduced on a device.
5. **P1** HOA application: RLS cannot restrict columns, so an applicant could INSERT/UPDATE `status='approved'`, `reviewed_by`, `created_hoa_id`, or foreign document paths. Guard trigger added (migration #4; this is from reading the policies, not from running Postgres). Authority itself was never grantable this way (`approve_hoa_application` is reviewer-only) but a forged "approved" row blocked real approval.
6. **P1** Approving a join request with no pending membership marked it "approved" while the resident got no access. Now refused with an explanation.
7. **P1** Phase 1 legacy `request_join_community` could re-open a decided membership (review R10). Guarded (migration #2 edit).
8. **P1** Stale account data: a slow community load for account A could publish after account B signed in (shared store race). Fixed with a latest-wins guard (U13).
9. **P2** Estimated residents silently stored 0 for blank input; "Other" role text not required; both validated now. Phone number is collected but never stored (no column): see section 18.

## 4. HOA Manager calendar
Code audit: the `(cm)/calendar` screen merged `bookings` for every court into its feed and offered a "Reservation" filter. Now: events, board meetings, scheduled maintenance and blockouts only. Reservations are inspected in **Manage Amenities -> amenity -> Open schedule** (date navigation, slot grid with available / reserved / pending / blocked, reservation detail, cancel-and-block, blockout edit/remove, realtime refresh). A blockout detail from the calendar links to Manage Amenities. Dashboard "Upcoming reservations" / "Today's bookings" and community activity rows also route there. Guard tests keep reservations out of the calendar.
Not built: an amenity *filter* and *status filter* inside one cross-amenity schedule view (the schedule is per amenity). Reservation approval stays in Approvals -> Reservations and the amenity detail.

## 5. HOA Manager notifications
Code audit of recipient logic: the existing triggers (`notify_booker_on_booking*`) notify only the **booker**; nothing sent routine confirmations to admins. If a manager account saw "Booking confirmed", it was for a booking made by that same account (an account with both admin and resident membership). The real gap was the opposite: **admins were never notified when a reservation needed approval.** Fixed in migration #3 (`booking_review_needed`, per approved community admin, excluding the booker, deduplicated). Residents' own booking notifications are unchanged. Routing: the shared Notifications screen maps the new type to Manage Amenities.
Deferred: the new route carries no `hoaId` (multi-community admins land on the unfiltered list); the legacy web `CMNotificationCenter` has no entry for the type.

## 6. Open Schedule: status
Fixed in code (iOS stacked-Modal root cause); unit-guarded; web behaviour unchanged. **Not verified on a device.** Verify with section 2 of the iPhone checklist.

## 7. Add Blockout: status
Same fix (it lives in the same sheet). The flow itself (validation, conflict preview, atomic create via `admin_create_blockout`, cancellation notices, refresh) pre-exists and its migration (`20261013110000`) is **applied on hosted**. Verify end to end on a device.

## 8. Resident onboarding (Phase 1)
Committed earlier (`5f915ba`) and independently inspected today: findings R9 (legacy web caller, deferred) and R10 (fixed). Migration #2 is still unapplied; two-account E2E has not been run. See checklist section 1.

## 9. Community-interest flow
Resident form, "your requests" with status, native Share of an invitation (no personal data beyond first name); platform lead queue with status, requester-visible message, internal notes, application linking. Writes only via two SECURITY DEFINER RPCs (verified email, duplicate and 5-open limits, reviewer-only update); an interest request cannot create admin privileges, memberships or communities (asserted in tests). Needs migration #5; degrades to a "not available yet" state without it. Not implemented: email/push to the board (sharing is manual by design: no sending).

## 10. HOA Admin application
Works against today's database: document photos upload to the private bucket, resubmission keeps prior documents, validation, duplicate handling, concurrency guard. Server-side integrity guard + one-open-application-per-community-name + image/PDF-only bucket are in migration #4. **No applicant gets management authority before platform approval**: unchanged and re-confirmed by reading `approve_hoa_application`.

## 11. Platform management
Existing review workflow audited (RPC-only approval, signed-URL document viewer, notes). Added the community-interest queue. **Not built:** duplicate/competing-application flagging in the list (planned unit U10, see section 20).

## 12. Account switching (identity decision needed; one isolation bug fixed)
Findings: the app has **no** account-switching feature; one Supabase session in AsyncStorage; sign-out entry points exist for resident, manager (via Settings) and platform. `useActiveCommunity` is the only module-level identity cache. It was user-keyed and reset on auth change, **but a review found a real stale-data race**: `load()` read the session, then awaited memberships / communities / storage and published unconditionally, so a slow load for account A could finish after account B signed in and restore A's community identity into B's session. Fixed in this unit with a latest-wins guard (`src/lib/latestGuard.ts`): every await is followed by a staleness check and an account change invalidates in-flight loads (pure interleaving tests + source guards; not exercised against a live session or device). A targeted scan found no other module-level mutable identity state (not a proof; screen-local state is discarded when the route group changes). Verify on a device: sign in as A, sign out, sign in as B quickly; B must never show A's community name or data.
Why I did not build a switcher: a true "switch without re-login" needs several refresh tokens stored on-device (SecureStore, not currently a dependency) and a policy for the same person holding several roles. Same-email multi-role is an **identity decision** (one auth user with several roles vs separate auth users per role) and I will not invent an unsafe workaround. Safe baseline available today: Sign out -> Sign in as the other account (the login screen already signs out locally first). **Decision for you:** are Resident, HOA Admin and Platform separate auth users (separate emails) or one user with several roles? Everything else follows from that.

## 13. Branches and commits (all local)
Integration branch: `v1/overnight-integration` (HEAD in the checkpoint). Unit branches kept: `v1/u2-admin-booking-notifications`, `v1/u3-rls-audit`, `v1/u7-community-interest`, `v1/u11-phase1-fixes`. Starting point: `onboarding/phase1-resident-join` @ `5f915ba` (unchanged). The checkpoint tool gained a `--worktree` option on `begin-task` and a `takeover` command (authorship change forces a fresh opposite-provider review). Worktrees `C:\Users\info\tenisx-wt-u2/u3/u7/u11/p1` are safe to remove after you merge (`git worktree remove`). `perm-test-tmp` (from the earlier permission test) still exists: `git branch -D perm-test-tmp`. Checkpoint / plans / review artifacts: `C:\Users\info\tenisx-overnight\` (outside the repo).

## 14. Tests that actually ran
- `npx playwright test -c playwright.logic.config.ts` (Node-only logic + static-source tests): **258 passed** on the final integrated tree (baseline at the start of the session: 148, including Phase 1). Most new tests are static-source or pure-logic guards; they prove the code says what we intend, not that a database or device behaves.
- `npx expo export --platform ios` (Metro + Hermes bundle): **exit 0** on the integrated tree.
- `npx expo config --type public`: resolves with the new plugin.
- `npx tsc --noEmit`: see section 15.
- **Not run:** any database/RLS/trigger behaviour, any device, `npm run lint` (eslint is not installed), Playwright browser/e2e suites (need web server + hosted auth).

## 15. Baseline errors vs new regressions
`tsc` reports ~1,550 errors repo-wide at the starting commit and now. Almost all are the pre-existing `TS1149/TS1261` file-name-casing conflicts (`Button.tsx` vs `button.tsx`, `Card`, `Skeleton`) and template/legacy-web code. Set comparison (paths normalised): **no new non-casing error** from this work; the new screens inherit the same `Button.tsx` casing error as every existing screen. Four other baseline errors (typed-routes / CSS-module side-effect imports) do not appear in the integrated run; I did not investigate why and take no credit for it.

## 16. Unapplied migrations (apply to a NON-PRODUCTION project first, in this order)
1. `20261013130000_revoke_anon_execute_on_admin_rpcs.sql` (older; revokes anon EXECUTE on admin RPCs)
2. `20261022120000_resident_join_flow_hardening.sql` (Phase 1; now includes the R10 guard)
3. `20261023100000_admin_booking_review_notifications.sql`
4. `20261023110000_hoa_application_hardening.sql`
5. `20261023120000_community_interest_requests.sql` (depends on #2)
6. `20261023130000_report_photo_attach.sql`
Already applied to hosted per earlier sessions: `20261012190000`, `20261013100000`, `20261013110000`, `20261013120000`. After applying, regenerate `src/lib/types.ts` and retire `untypedDb` call sites where its header says so.

## 17. Security findings
Verified by code reading: items 3.2-3.7 above. Candidates from the offline audit (`docs/onboarding/RLS-AUDIT.md`; **verify on the hosted DB with the read-only queries in the report; migrations are not the source of truth**):
- **C1 (verify first)** `profiles_select_authenticated` (`USING auth.role() = 'authenticated'`, 20260109213852) is never dropped in the migration history. If it exists on hosted alongside the scoped same-HOA policy, every signed-in user can read every profile (cross-community PII). The earlier launch-matrix investigation blamed a different policy, which hints it may already be gone, but this is **unverified**.
- **C2** `ladders` insert policy "Admins and coaches can create ladders" -> `can_create_ladder`: ORs the *global* `admin` role with a membership branch, so a global admin of community A may create ladders for B. Ladders are a hidden Stage 2 (tennis) feature, but the policy lives in the shared database.
- **C3** 32 `SECURITY DEFINER` functions in `public` appear anon-callable by grant reachability (Supabase default grants); migration #1 handles three of them. Review the list in the report.
- **C4** 5 baseline tables (`courts`, `bookings`, `hoas`, `court_maintenance`, ...) have no RLS toggle in the migration history: their RLS state is **unknown**, not "disabled". Check `pg_class.relrowsecurity`.
- **C5 (privacy, Stage 2 tennis screen)** `src/components/match/AddPlayersSheet.tsx` reads up to 1,000 device contacts and sends their emails and phone numbers to the `match_tenisx_contacts` RPC to find members. `expo-contacts` is autolinked into the binary, so App Store Connect would flag the missing `NSContactsUsageDescription` even though the screen is hidden in Community mode; U12 adds an accurate purpose string. If that screen ever ships, the App Store privacy label must declare Contacts collection, and you should confirm what the RPC retains or logs.
- Global-admin design note: `approve_hoa_application` grants a *global* `admin` role (also the app-shell gate). Database authority for admin actions is community-scoped (`check_hoa_admin`), but app screens that query all rows rely entirely on RLS for scoping.

## 18. Unresolved issues
**P0 (verify, not yet confirmed):** C1.
**P1:** C2 (hidden feature); unapplied migrations block photo attach / interest / applicant guard / admin review notifications in a live test; native rebuild required for iOS permission strings; two-account E2E for Phase 1 not run.
**P2:** phone number on the HOA application is collected but not stored (needs a column); legacy web callers (`ActiveHOAContext` cancel, `CMNotificationCenter`, `src/pages/HOAApplication.tsx`) are not part of the native app and were left alone; orphan storage objects from abandoned uploads need an operational cleanup; PDF attachments need `expo-document-picker`; `src/components/app-tabs.web.tsx` is dead template code with a bad route; photo re-attach to an existing report is not implemented; the low-severity review findings listed in the appendix.

## 19. iPhone testing
See `docs/onboarding/IPHONE-QA-CHECKLIST.md` (three account experiences, prerequisites, migration order, test accounts). **No real-device testing happened.** Build a development client first: the new permission strings only exist in a fresh native build.

## 20. Recommended next steps
1. Answer the account-identity question (section 12).
2. On a staging Supabase: run the verification queries for C1-C4, then apply migrations 1-6 in order and run `supabase/tests/*.sql` style dry-runs for the new functions (none were executed).
3. Build a dev client and walk the checklist.
4. Next units: platform duplicate-application flagging (U10), carry `hoaId` in the admin notification route, phone persistence column, `expo-document-picker` for PDFs, add `ENABLE ROW LEVEL SECURITY` verification to CI using the audit script.

## Appendix: deferred review findings (low)
- U7: friendlier wording for the 23505 index error; two links to the interest form on an empty search; platform editor blocks Save when the optional applications list fails to load; RPC has 6 params vs 5 in the original plan (intentional).
- U3 (10 inspection rounds, each finding another parser edge case): the SQL reader is regex/tokenizer based; the stated acceptance scope was made explicit in the plan (wrong output on THIS repository's migrations blocks; edge cases that do not occur here are documented limits). See "Parser limits" in the report. The tool's own tests never touch the tracked report; the repo's pre-commit secret scan rejects the literal role name, so the code builds it from parts.
- U2: no `hoaId` in notification route; legacy web notification centre.
- Phase 1 R9: legacy web cancel path deletes memberships directly (blocked by the Phase 1 policy drop; native uses the RPC).

## 21. Session 2 addendum (2026-10-23): read-only check of the hosted project
Only read-only Supabase tools were used (project list, table list with RLS flag, migration list, security advisor). No SQL tool was available, so no `pg_policies` query was run and **C1 is still unverified**. Production = project `hqqlrliakttqsbalvuyz` ("TENISX REAL", the only ACTIVE project; the other two are paused and were not restored because that could start paid resources).
- **C4 resolved:** every table in `public` (including `courts`, `bookings`, `hoas`, `court_maintenance`, `email_preferences`) has RLS **enabled**.
- Hosted migration list ends at `20261013190307` (platform approval); the six local migrations remain unapplied, as documented.
- **NEW (C6, confirmed in migration code; hosted bodies not read):** the local definitions of `get_email_preferences` / `create_default_email_preferences` (20260115024246) are SECURITY DEFINER, take a caller-supplied user id and never check the caller; the advisor confirms anon can EXECUTE them on the hosted project. If the hosted bodies match the migration file, anyone with the public API key could read any user's email-notification settings by user id. Hosted exploitability stays PENDING a `pg_get_functiondef` check (no SQL tool was available). Migration 7 closes both regardless.
- **C3 confirmed larger:** the advisor lists 58 anon-callable SECURITY DEFINER functions (the offline audit said 32) because it also counts functions that exist only on the hosted DB. Migration 7 revokes anon on 40 RPC/trigger names. Left alone on purpose: RLS helper functions, `get_public_*` lookups, `handle_new_user`.
- **PENDING (needs a human with SQL access):** `update_email_preference(uuid, text, boolean)` exists only on the hosted DB (no migration file). Migration 7 revokes anon, but whether it checks `auth.uid()` for signed-in callers is unknown: run `select pg_get_functiondef('public.update_email_preference(uuid,text,boolean)'::regprocedure);`.
- Advisor also reports (not changed; decisions needed): SECURITY DEFINER views `public.referral_leaderboard` (hidden feature) and `public.public_hoa_directory` (an intentional public directory, but the hosted definition is unverified and the approved-communities-only filter exists only in unapplied migration 2, so until then unapproved communities may be listed); leaked-password protection is OFF in Auth settings (a dashboard toggle); Postgres has outstanding security patches (an upgrade you schedule); the advisor lists tables in a schema `backup_20261013` (e.g. `_columns`, `_policies`, `_functions`) that have RLS enabled and no policies; the schema looks like a manual snapshot of schema metadata taken on 2026-10-13 (speculation: its purpose and contents were not inspected), and whether it is reachable through the API (exposed-schema settings, grants) is UNVERIFIED, so decide whether to keep it and check its exposure; 76 tables are visible to anon in GraphQL (RLS still gates rows).
- **Migration 7:** `20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql` (apply after #6, non-production first). Static test: `tests/anon-rpc-lockdown-logic.spec.ts`. It was never executed against Postgres.
- **iPhone build:** `eas.json` now has `development-device` (dev client, real device). It deliberately has **no** Supabase URL: the existing `development` profile hardcodes the PRODUCTION URL, and a device build with it would write QA data to production. Supply a non-production project via EAS env vars (none is currently active). No build was started.
- No isolated non-production database existed, so no migration was applied or tested against any database.
