# Pending migration risk review (2026-10-26) - NOTHING APPLIED

Status: **review only.** No migration was applied, no SQL was run against any database, and no migration file was changed by this review.
Independent reviewer: Codex (read-only sandbox, no database access). The section "Claude verification notes" was added by the implementing session after spot-checking the reviewer's claims against the repository.

## RESOLUTION UPDATE 2026-10-28 (overnight session) - still NOTHING APPLIED to any hosted database
The sections below are the historical review as written on 2026-10-26. The six decisions were handled as follows. Codex re-reviewed the changes read-only and returned APPROVED (two low findings, both addressed: real-PostgreSQL rehearsal, this table).

| # | Original finding | Resolution | Evidence |
|---|---|---|---|
| 1 | M4 overwrote `hoa-verification-documents.allowed_mime_types` | **Removed from the migration.** The bucket was created with no allowlist (any type), and the legacy web form also offers .doc/.docx, so nothing is narrowed silently. A separate, optional, commented template with a "record the current value first" step is in `docs/onboarding/OPTIONAL-verification-bucket-mime.sql` (not in the migrations folder). | static tests; rehearsal asserts the bucket row is unchanged |
| 2 | Legacy web paths break after M2 | `JoinByInvite.tsx` now calls new RPC `request_hoa_membership_via_invite(invite_code_input, join_message)` (added to M2: verified email, enabled + unexpired invite, approved community, keeps `joined_via_invite`/`invite_code_used`). `ActiveHOAContext.cancelJoinRequest` now calls `withdraw_membership_request` and no longer reports success when nothing was withdrawn. `AddCommunityModal` needed no change: policy `hoa_memberships_insert_own_admin_creator` survives M2. The legacy web layer (`src/pages`, `src/App.tsx`) is **dormant**: the shipping entry is `expo-router/entry`, `package.json` has no vite/react-router/sonner, and `tsc` cannot even resolve those imports. Edits there are for correctness if it is ever revived. | static tests; rehearsal exercises the RPCs |
| 3 | Physical delete in `withdraw_membership_request` | **Kept deliberately and documented.** It replaces the retired "Users can cancel their own pending requests" DELETE policy, so deleting a never-approved *pending* row is the pre-existing behaviour, not a new one. Tightened: the pending request row is only removed when no membership row remains for the pair (a withdraw can no longer strip the request of an approved/rejected member) and the return value is true if either row was removed. Approved/rejected/removed history is never deleted. If you want a soft-withdraw instead, that needs a new status value and is a product decision. | rehearsal: approved, rejected, pending, legacy request-only |
| 4 | M7 re-granted `authenticated` on every overload | `authenticated` EXECUTE is now captured with `has_function_privilege` BEFORE the revoke and re-granted only where it already existed, so nothing is expanded and a function closed earlier stays closed. **Unchanged / still open:** the hosted body of `update_email_preference` is unreviewed; run HOSTED-VERIFY-READONLY.sql section 6 first. | rehearsal: a previously closed function stays closed |
| 5 | M4 unique index silently skipped on duplicates | Duplicates now `RAISE EXCEPTION` (whole file rolls back, no data changed) so a successful run always means the index exists. You must resolve duplicates yourself first (list them with the read-only SQL). | rehearsal negative case: trigger and index absent, 4 rows unchanged |
| 6 | M2 backfill adds rows and may fire notifications | **Unchanged, by design.** The additions are additive and arguably correct (admins are notified of genuinely pending requests). Compare the HOSTED-VERIFY-READONLY.sql section 1b count before and after, as the runbook already says. | rehearsal: 2 legacy request-only users gained 1 pending + 1 rejected membership; the 4 original memberships untouched |

What the rehearsal actually was (and was not): see `docs/onboarding/LOCAL-REHEARSAL-RESULTS.md`. It ran on a disposable local PostgreSQL with a RECONSTRUCTED fixture, only for M2, M4 and M7, and does not replace a restore of the real backup.

## Bottom line
**Do not apply the seven files unchanged.** The reviewer's verdict is NEEDS CHANGES. None of the seven files deletes, truncates or rewrites account or booking rows when applied (the `DELETE`s in migration 2 are inside a function body that only runs when a user taps "withdraw"), but these items need a decision first:

| # | Decision needed | Why |
|---|---|---|
| 1 | Bucket overwrite in `20261023110000` (lines 98-100) | `UPDATE storage.buckets SET allowed_mime_types = ...` replaces any custom allowlist on bucket `hoa-verification-documents`. Record the current value first and approve the new list explicitly, or move it out of the migration. |
| 2 | Client paths that break after `20261022120000` | Residents' direct INSERT/DELETE on `hoa_memberships` is removed (RPC-only). Direct writes exist in legacy-web code: `src/pages/JoinByInvite.tsx:92`, `src/contexts/ActiveHOAContext.tsx:~228` (cancel: RLS makes it delete 0 rows yet it still shows success), `src/components/condo-manager/AddCommunityModal.tsx:41` (admin self-membership). Native Stage-1 screens under `src/app` do not make these writes, but confirm on a restored scratch copy before applying, and decide whether the legacy web layer matters. |
| 3 | Physical delete in the new `withdraw_membership_request` RPC | Future withdrawals delete the pending membership and join-request rows. If "never delete" applies to ongoing app behaviour, redesign as a soft withdraw. |
| 4 | `20261023140000` grants | Re-grants EXECUTE to `authenticated` on every overload of the listed functions; the hosted `update_email_preference` body is unreviewed (run HOSTED-VERIFY-READONLY.sql section 6 first). |
| 5 | `20261023110000` unique index | If duplicate open applications exist the index is silently skipped (NOTICE only). Treat "index missing" as a failed verification. |
| 6 | Backfill in `20261022120000` (sections 7 and 7b) | Adds pending/rejected membership rows for legacy join requests; pending rows can fire the existing admin-notification trigger. Run HOSTED-VERIFY-READONLY.sql section 1b first and compare the count afterwards (the runbook already says this). |

## Claude verification notes
- Confirmed in the repo: the `UPDATE storage.buckets` at migration 4 lines 98-100; the unique index is skipped with a NOTICE when duplicates exist (lines 83-95); direct `hoa_memberships` insert/delete calls at the three client locations above, all in the legacy web layer (`src/pages`, `src/contexts`, `src/components`), none under `src/app`.
- `src/services/supabaseService.ts:383` inserts an *approved* membership as an admin approval action; admin write policies are untouched by migration 2.
- Not independently verified: hosted function bodies, hosted notification types, hosted triggers. These need the read-only SQL run against the real project (blocked tonight: no password, SQL tools denied).
- Run order from the runbook stays as is: 1 `20261013130000`, 2 `20261022120000`, 3 `20261023100000`, 4 `20261023110000`, 5 `20261023120000` (needs `user_email_verified()` from #2), 6 `20261023130000`, 7 `20261023140000`. Do NOT include `20261013100100_admin_reports_scrub_legacy_admin_notes`.
- Apply first on a restored scratch copy, one file at a time. The automatic restore test in `scripts/hosted-backup` deletes its scratch server when it finishes and is a plain PostgreSQL server with no Supabase REST API, so it cannot rehearse the API-dependent checks (for example the photo-attach RPC with request headers); prepare a separate isolated rehearsal environment (for example a local Supabase stack) for those. Apply one file at a time inside `BEGIN; SET LOCAL lock_timeout='5s'; ... COMMIT;`, running that file's verification query before COMMIT.

## Security findings these migrations will NOT fix (Supabase advisor on TENISX REAL)
- 2 SECURITY DEFINER views: `public.referral_leaderboard`, `public.public_hoa_directory` (ERROR level).
- 10 functions with mutable search_path; 76 tables visible via GraphQL to anon and authenticated (RLS still applies); leaked-password protection disabled; Postgres version has security patches available (dashboard upgrade); schema `backup_20261013` holds 85 RLS-enabled tables without policies (access denied by default; do not "fix" with permissive policies).

---

# Codex read-only migration review (verbatim)


**Do not apply the seven files unchanged yet.** Two current client paths break after #2; #4 overwrites an existing bucket setting; and #7 grants authenticated execution more broadly than its hardening description suggests.

No files were modified. No database connections or queries were made. Hosted state is taken from your description; the verification SQL below is for the operator to run later.

Line references below use these aliases, all under `supabase/migrations/`:

| Alias | File |
|---|---|
| M1 | [20261013130000_revoke_anon_execute_on_admin_rpcs.sql](C:/Users/info/tenisx-native/supabase/migrations/20261013130000_revoke_anon_execute_on_admin_rpcs.sql:1) |
| M2 | [20261022120000_resident_join_flow_hardening.sql](C:/Users/info/tenisx-native/supabase/migrations/20261022120000_resident_join_flow_hardening.sql:1) |
| M3 | [20261023100000_admin_booking_review_notifications.sql](C:/Users/info/tenisx-native/supabase/migrations/20261023100000_admin_booking_review_notifications.sql:1) |
| M4 | [20261023110000_hoa_application_hardening.sql](C:/Users/info/tenisx-native/supabase/migrations/20261023110000_hoa_application_hardening.sql:1) |
| M5 | [20261023120000_community_interest_requests.sql](C:/Users/info/tenisx-native/supabase/migrations/20261023120000_community_interest_requests.sql:1) |
| M6 | [20261023130000_report_photo_attach.sql](C:/Users/info/tenisx-native/supabase/migrations/20261023130000_report_photo_attach.sql:1) |
| M7 | [20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql](C:/Users/info/tenisx-native/supabase/migrations/20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql:1) |

## A. Per-migration changes

| File | Changes |
|---|---|
| **M1** | Revokes `anon` execution on the two admin blockout RPCs and `hoa_is_approved(uuid)`. Does **not** revoke `PUBLIC` or authenticated access. Exact signatures must exist. **M1:12–15.** |
| **M2** | Limits the directory to approved communities; adds email verification; replaces both join RPCs so they maintain membership and request rows together; adds withdrawal RPC; drops five resident write policies; inserts missing pending/rejected memberships; disables the old migration RPC for API clients. **M2:13,22,36,88,150,177,185,198,211.** |
| **M3** | Replaces notification type CHECK constraint, adding `booking_review_needed`; adds an AFTER INSERT trigger notifying approved admins about pending bookings, excluding the booker. **M3:6,17,48.** |
| **M4** | Adds application write guard; conditionally creates a unique index for open applications; replaces the verification bucket MIME allowlist. **M4:14,75,81,98.** |
| **M5** | Creates interest requests and reviewer notes, constraints/indexes/RLS; gives authenticated users SELECT with row filtering; writes occur through submission/reviewer RPCs. Removes a superseded five-argument update overload. **M5:7,24,31,36,51,109,110.** |
| **M6** | Adds authenticated photo attachment RPC. Checks caller folder, object existence and API headers; fills an own report’s NULL `photo_url`. **M6:14,30,38,45,57.** |
| **M7** | Adds caller checks to two email preference RPCs; revokes `PUBLIC`/anon execution across every overload of named functions; explicitly grants those overloads to authenticated and service role, except authenticated access to the migration helper. **M7:19,62,112–143.** |

## B. Data safety

**Installation contains no top-level DELETE, TRUNCATE, DROP TABLE, or application-row UPDATE.** It does contain new-row backfills and an existing-row UPDATE in `storage.buckets`. SQL inside function definitions executes only when those functions are subsequently invoked.

| Statement | Existing-data effect and assessment |
|---|---|
| **M2:185–193**, pending backfill | Inserts missing resident/pending memberships for pending requests in approved communities. `NOT EXISTS` plus conflict handling preserves existing memberships of every status. **Additive, but changes account behavior:** these users gain visible pending memberships and become actionable through membership approval RPCs. |
| **M2:198–206**, rejected backfill | Inserts missing resident/rejected memberships. Existing memberships remain untouched; missing approved memberships are deliberately not created. Additive, but prevents normal re-requesting for those users. |
| **Backfill trigger effects** | Pending inserts also invoke the existing membership INSERT trigger, potentially inserting admin notifications. The trigger checks `NEW.status = 'pending'`; rejected backfills do not generate these notifications. See [20260307225408…sql:238](C:/Users/info/tenisx-native/supabase/migrations/20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql:238) and trigger attachment at **:259**. Inspect hosted triggers before claiming the backfill affects only one table. |
| **M2:163–168**, withdrawal function | **Future calls delete existing pending memberships and pending request rows.** Not executed during migration. Membership deletion requires role `resident`; request deletion does not check membership role. The function can remove a pending request even when it returns `false` because no membership was deleted. If “no row may be deleted” includes subsequent app behavior, this implementation violates that requirement and needs a soft-withdraw design. |
| **M3:6–15**, CHECK replacement | No row conversion or type alteration. Existing notification rows are scanned for validation; any non-NULL type outside the enumerated list causes failure. A successful constraint change leaves values unchanged. Do not assume the hosted allowed set matches the repository set. |
| **M4:14–78**, application guard | No existing rows rewritten. Existing malformed document paths, NULL/empty elements, or historical forged review fields remain. Some legacy applications can become impossible for applicants to resubmit: every resulting document path must pass validation. The guard permits dropping old NULL/empty elements, but does not repair them itself. |
| **M4:81–96**, unique index | No deduplication or row changes. Existing duplicates cause a **NOTICE and skipped index**, not failure. A successful migration therefore does not prove duplicate protection exists. A concurrent duplicate can also make index creation fail after the initial check. |
| **M4:98–100**, bucket UPDATE | **Overwrites an existing bucket row’s `allowed_mime_types`**, including any custom allowlist. This is the clearest installation-time violation of literal “no existing row silently changed.” It does not delete objects or rewrite their MIME metadata. Existing downloads remain; future uploads/overwrites using excluded MIME types fail. Missing bucket means zero updated rows, with no error. It does not set privacy or the size limit. |
| **M5:9,20,26**, foreign keys | No immediate deletion or overwrite. Future user/request deletion can cascade to interest data; application deletion can NULL a linked application ID. These future effects matter if preservation is an ongoing requirement. |
| **M5:153–162**, reviewer RPC | Future authorized calls overwrite request status, public status message, linked application and timestamp, and optionally append notes. No automatic migration-time request update. |
| **M6:57–61**, report UPDATE | **Not executed during migration.** Future calls change only an own report with `photo_url IS NULL`; existing non-NULL photo URLs are preserved. Empty strings are not considered missing. There is **no report-status or age check**, despite the “new report” comment: any own historical report with NULL photo can receive one. Existing UPDATE triggers may also run. |
| **M7:87–89**, defaults function | Future calls INSERT preference rows; does not upsert or reset existing preferences. Repeated creation can fail on the existing uniqueness constraint. |

**There are no enum or column type changes in M3/M4.** M3 changes a text CHECK; M4 adds trigger validation, an expression/partial unique index and a MIME array setting.

For strict preservation, separate M4’s bucket change into an explicitly reviewed configuration change. Review and record M2’s exact candidate rows and trigger effects before authorizing its backfills.

## C. Dependencies and order

The requested order is valid **provided hosted objects match the expected definitions**.

| File | Required prerequisites / failure consequences |
|---|---|
| **M1** | Admin blockout functions from hosted `admin_blockouts_and_reservation_workflow`, and `hoa_is_approved` from `platform_approval_and_secure_messaging`. Missing exact signature causes immediate failure. **M1:12–15.** |
| **M2** | `hoas.approval_status`, `hoa_is_approved`, both membership/request tables and their unique keys, and the old `migrate_existing_hoa_memberships()` function. Missing old helper makes the final REVOKE fail. **M2:16,51,131,193,211.** |
| **M3** | Booking/court/profile/membership tables and notification columns, especially `dedupe_key` and a matching unique index. The repository prerequisite adds these at [20261013100000…sql:21](C:/Users/info/tenisx-native/supabase/migrations/20261013100000_admin_reports_internal_notes_and_notifications.sql:21). Missing notification structures may surface only on the first pending booking, causing that booking INSERT to roll back. **M3:33–42.** |
| **M4** | `hoa_applications` and its expected columns; `has_role`; `app_role` containing `platform_reviewer`; verification bucket and existing upload/read policies. Missing bucket is silently ignored. **M4:22,31,98.** |
| **M5** | **M2’s `user_email_verified()`**, reviewer role support, `hoa_applications`, auth users. Missing helper can survive PL/pgSQL creation and fail at first submission. **M5:20,46,61,122.** |
| **M6** | Report/storage schemas and object bucket. Does not depend on M5. Requires API request headers at runtime and a working public report-photo origin. **M6:38–55.** |
| **M7** | Existing email table/compatible return types. Other named functions are discovered dynamically: missing names are skipped. It does not verify their bodies or required signatures. **M7:19–33,62–76,129–136.** |

M7 overlaps M1/M2’s revokes; that repetition is harmless. Its authenticated grants can, however, reverse earlier restrictions on named functions other than the explicitly handled migration helper.

**Hosted migration numbers must be reconciled by content, not chronology.** M1’s version sorts before the hosted watermark but is unapplied. A naïve push can reject history differences or include unintended older files. Do not replay the four prerequisites merely because their local filenames have different versions.

The repository also contains a separate legacy notes scrub migration. It is outside this seven-file review and must not be accidentally included.

## D. Transactionality, failures, locks and downtime

**All seven files are transaction-compatible, but none contains its own `BEGIN`/`COMMIT`.**

- **Normal Supabase CLI migration execution:** these files contain no transaction-breaking statements, so each runs as a transactional migration batch. Failure rolls back that file; earlier successfully applied files remain committed. Pin/check the actual CLI version and execution mode. Supabase’s [runner implementation](https://raw.githubusercontent.com/supabase/cli/develop/apps/cli/src/command-internal/migration-apply.ts) distinguishes normal transactional batches from nontransactional execution.
- **SQL editor:** submitting the entire file as one multi-statement query is atomic under PostgreSQL’s [single-query transaction behavior](https://www.postgresql.org/docs/15/libpq-exec.html). Running selections or separate submissions does **not** make the whole file atomic. Use an explicit transaction around the complete file to remove ambiguity.
- **DO blocks:** each block is atomic even if the surrounding file is executed statement by statement.

| File | If incorrectly run statement by statement and a later statement fails |
|---|---|
| M1 | Only some revokes may be installed. |
| M2 | View/functions/policies may change before the backfill or final revoke fails; pending backfill may commit without rejected backfill. Newly created RPCs could retain default grants if execution stops before their revokes. |
| M3 | CHECK could be dropped without replacement; function could exist without trigger; old trigger could be dropped without replacement. |
| M4 | Guard may be installed while unique index or bucket change is absent. Duplicate NOTICE is a deliberate incomplete outcome even in an atomic run. |
| M5 | Tables, grants and policies may be partly installed. Old overload may be dropped before its replacement exists. |
| M6 | Function may exist before its restrictive ACL is applied. |
| M7 | Email bodies may change before ACL loop runs. The loop itself rolls back as a unit if any dynamic grant/revoke fails. |

**Lock exposure:**

- **M1/M7:** mainly catalog/ACL work; low expected downtime.
- **M2:** view/policy DDL plus membership inserts; backfills can wait on unique conflicts and invoke notification triggers. Duration depends on candidate count and indexes.
- **M3:** highest read/write blocking concern. CHECK replacement requires a strong table lock and validation scans existing notifications. Trigger DDL also locks bookings.
- **M4:** ordinary `CREATE UNIQUE INDEX` blocks application-table writes while building. Bucket UPDATE locks the matching bucket row.
- **M5:** low if genuinely new tables; potentially higher if tables already exist because `IF NOT EXISTS` does not validate existing shape.
- **M6:** short function DDL; runtime row locking only during attachment.

Use a short `lock_timeout`, a bounded `statement_timeout`, and a quiet window. A lock request waiting behind a long transaction can also queue later requests.

## E. Current client compatibility

| Client call | Result after migrations |
|---|---|
| [JoinByInvite.tsx:92](C:/Users/info/tenisx-native/src/pages/JoinByInvite.tsx:92), direct pending membership INSERT | **Breaks after M2** for ordinary residents because the self-insert policies are removed. Replace with the join RPC. The current RPC signature does not preserve `joined_via_invite`/`invite_code_used`; decide how to retain that attribution. |
| [ActiveHOAContext.tsx:225](C:/Users/info/tenisx-native/src/contexts/ActiveHOAContext.tsx:225), direct membership DELETE | **Breaks after M2.** RLS can produce zero deleted rows without error, followed by the success toast at **:235**. Used by [PendingMemberships.tsx:42](C:/Users/info/tenisx-native/src/components/community/PendingMemberships.tsx:42). |
| [communityJoin.ts:65](C:/Users/info/tenisx-native/src/lib/communityJoin.ts:65), join and withdrawal RPCs | Compatible with M2. Caller must have confirmed email for joining. Withdrawal’s boolean should be checked. |
| [ActiveHOAContext.tsx:206](C:/Users/info/tenisx-native/src/contexts/ActiveHOAContext.tsx:206), [JoinCommunity.tsx:106](C:/Users/info/tenisx-native/src/pages/JoinCommunity.tsx:106), [supabaseService.ts:815](C:/Users/info/tenisx-native/src/services/supabaseService.ts:815) | RPC names remain compatible; **unverified accounts now receive 42501**. Existing memberships, including rejected/removed ones, block rejoining. |
| Directory reads: [Register.tsx:80](C:/Users/info/tenisx-native/src/pages/Register.tsx:80), [CompleteProfile.tsx:46](C:/Users/info/tenisx-native/src/pages/CompleteProfile.tsx:46), [JoinExistingHOA.tsx:47](C:/Users/info/tenisx-native/src/components/community/JoinExistingHOA.tsx:47) | Same columns/SELECT grants; pending or unapproved communities disappear intentionally. |
| [AmenityScheduleSheet.tsx:235](C:/Users/info/tenisx-native/src/components/admin/AmenityScheduleSheet.tsx:235), blockout RPCs | Authenticated calls remain allowed after M1/M7. Anonymous calls fail. |
| [emailService.ts:22](C:/Users/info/tenisx-native/src/services/emailService.ts:22), **:40**, **:62** | Own-user get/create remain allowed; signed-in cross-user get/create now fail. Service wrapper converts failures to `null`. `update_email_preference` remains authenticated-callable with an **unreviewed hosted body**. |
| [useCoachData.ts:255](C:/Users/info/tenisx-native/src/hooks/useCoachData.ts:255), `get_coaches_near` | Signed-in access retained. This hook guards on user at **:175**, so no demonstrated anonymous regression here. |
| Competition/match RPCs: [CreateCompetitionWizard.tsx:88](C:/Users/info/tenisx-native/src/components/compete/CreateCompetitionWizard.tsx:88), [useCreateMatchDraft.ts:104](C:/Users/info/tenisx-native/src/hooks/createMatchDraft/useCreateMatchDraft.ts:104), [useMyMatches.ts:136](C:/Users/info/tenisx-native/src/hooks/useMyMatches.ts:136) | M7 retains authenticated execution; anonymous use fails. No demonstrated signed-in ACL break. |
| [hoa-application.tsx:191](C:/Users/info/tenisx-native/src/app/hoa-application.tsx:191) | Native writes fit the guard: own applicant, pending submission, append documents. Legacy invalid paths or growing beyond five documents can block resubmission. Web resubmission also appends without a database-aware cap at [HOAApplication.tsx:197](C:/Users/info/tenisx-native/src/pages/HOAApplication.tsx:197). |
| [communityInterest.ts:20](C:/Users/info/tenisx-native/src/lib/communityInterest.ts:20), **:34**, **:47**, **:56** | Matches M5’s RPC writes and SELECT-only tables, including six-argument update. |
| [report.tsx:367](C:/Users/info/tenisx-native/src/app/(resident)/report.tsx:367) | Uses M6’s expected object-path contract. Attachment returns `false` if the report already has a photo or is not owned by the caller. |

M2 leaves admin write policies intact. The direct admin updates/fallbacks in [supabaseService.ts:325](C:/Users/info/tenisx-native/src/services/supabaseService.ts:325) are not categorically broken by these policy drops, although their multi-table synchronization remains fragile.

**Already broken by the stated hosted prerequisite:** `create_community` calls at [CommunityCreationForm.tsx:49](C:/Users/info/tenisx-native/src/components/CommunityCreationForm.tsx:49) and [supabaseService.ts:795](C:/Users/info/tenisx-native/src/services/supabaseService.ts:795). The platform migration revokes authenticated execution at [20261013120000…sql:60](C:/Users/info/tenisx-native/supabase/migrations/20261013120000_platform_approval_and_secure_messaging.sql:60). These seven do not restore it.

## F. Advisor findings

| Hosted finding | Outcome |
|---|---|
| Two SECURITY DEFINER views | **Unresolved.** M2 filters `public_hoa_directory` but does not set `security_invoker`; `referral_leaderboard` is untouched. Simply making the directory invoker-security may break public discovery under underlying HOA RLS. |
| Ten functions with mutable `search_path` | **Partial/unknown count.** Replaced functions set paths; M7 does not alter paths for its dynamically discovered list. Cannot claim all ten resolved without their identities. |
| 76 GraphQL-visible tables | **Unresolved broadly.** No GraphQL-wide configuration/revocation. M5 adds two authenticated SELECT tables, potentially adding GraphQL exposure subject to RLS. |
| Anon-executable SECURITY DEFINER functions | **Substantially reduced, not eliminated.** M7 intentionally excludes helpers/public lookups and is a fixed name list. M1 alone also leaves any inherited PUBLIC execution intact. |
| Authenticated-executable SECURITY DEFINER functions | **Mostly remains by design.** These power the app. M7 explicitly grants authenticated execution to all matching overloads except the migration helper. Execution permission is not proof of a vulnerability; body authorization matters. |
| Leaked-password protection off | Unchanged. |
| Outdated PostgreSQL | Unchanged. |
| Backup schema: 85 RLS tables without policies | Unchanged. Do not add permissive policies or delete the schema merely to silence the advisor. |

**M7 security gap:** `update_email_preference` remains unreviewed and authenticated-callable (**M7:13–14,127,136**). Also, `auth.uid() IS NULL` is treated as trusted in the two replaced email functions; that trust depends on effective execution grants, not the NULL check itself.

## G. Concrete apply procedure and verification

These are instructions for a later operator session; **none was executed**.

1. Resolve the client breaks and preservation decisions above.
2. Take and restore-test a database backup covering auth, public, storage metadata, backup schemas, ACLs and functions. Preserve Storage object bytes separately.
3. Reconcile hosted/local migration history by definition. Inspect the exact seven-file apply plan; do not use a blanket “include everything older” approach.
4. Capture pre-apply row counts and row-content snapshots for existing tables, bucket settings, policies, function definitions/ACLs and triggers. Counts alone do not detect overwrites.
5. Preflight:
   - Inventory notification types against M3’s exact allowlist.
   - List M2’s missing-membership candidates and all membership INSERT triggers.
   - List duplicate open applications; inspect the bucket allowlist.
   - Inspect every M7-matched overload, current ACL and body, especially hosted-only functions.
   - Confirm prerequisite object signatures and the notification partial unique index.
6. Rehearse on an isolated restored copy. Apply one complete file at a time in the stated order, transactionally. For SQL editor execution:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- Paste ONE complete reviewed migration here.
-- Run its verification queries before COMMIT.
COMMIT;
```

If a check fails, roll back. For CLI execution, use its transactional file runner and run verification immediately after each file. SQL editor execution does not automatically reconcile CLI migration history.

### After M1

```sql
SELECT p.oid::regprocedure AS signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN
      ('admin_blockout_conflicts', 'admin_create_blockout', 'hoa_is_approved');
```

Expected: the three intended signatures exist; anon false, authenticated true. Any extra overload needs separate review.

### After M2

```sql
SELECT pg_get_viewdef('public.public_hoa_directory'::regclass, true);

SELECT count(*) AS missing_expected_memberships
FROM public.community_join_requests r
JOIN public.hoas h ON h.id = r.hoa_id
WHERE h.approval_status = 'approved'
  AND r.status IN ('pending', 'rejected')
  AND NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.user_id = r.user_id AND m.hoa_id = r.hoa_id
  );

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('hoa_memberships', 'community_join_requests');
```

Expected: approved-only view, zero missing candidates, five named policies absent. Inspect **all surviving policies**, since permissive policies combine with OR. Compare added rows/notifications against the approved candidate snapshot and verify the migration helper’s effective API grants are false.

### After M3

```sql
SELECT convalidated, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.hoa_notifications'::regclass
  AND conname = 'hoa_notifications_type_check';

SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.bookings'::regclass
  AND tgname = 'trg_notify_admins_booking_review';
```

Expected: validated CHECK includes all required old values plus the new value; enabled pending-INSERT trigger. On the restored copy, verify a pending booking creates one notification per eligible admin and no duplicate.

### After M4

```sql
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.hoa_applications'::regclass
  AND tgname = 'guard_hoa_application_write_trigger';

SELECT indexrelid::regclass, indisvalid, indisunique,
       pg_get_indexdef(indexrelid)
FROM pg_index
WHERE indexrelid =
      to_regclass('public.hoa_applications_one_open_per_name');

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'hoa-verification-documents';
```

Expected: guard enabled, valid intended unique index, exactly one bucket row. **Zero index rows means incomplete hardening.** Compare bucket settings with the explicitly approved change.

### After M5

```sql
SELECT c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS auth_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS auth_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS auth_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('community_interest_requests', 'community_interest_notes');

SELECT to_regprocedure('public.user_email_verified()') AS helper,
       to_regprocedure(
         'public.update_community_interest(uuid,text,text,text,uuid)'
       ) AS removed_overload,
       to_regprocedure(
         'public.update_community_interest(uuid,text,text,text,uuid,boolean)'
       ) AS current_overload;
```

Expected: both tables RLS-enabled; anon SELECT false; authenticated SELECT true and writes false; helper/current overload exist; old overload NULL. Verify requester/reviewer isolation on the restored copy.

### After M6

```sql
SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute,
       pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.attach_report_photo(uuid,text)');
```

Expected: definer, fixed search path, anon false, authenticated true. Inspect body for own reporter/NULL-photo checks. Test through the restored project’s REST API; SQL-editor calls lack the required headers. Confirm the stored URL uses the real accessible Storage origin.

### After M7

```sql
SELECT p.oid::regprocedure AS signature,
       p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY 1;

SELECT p.oid::regprocedure, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_email_preferences',
    'create_default_email_preferences',
    'update_email_preference'
  );
```

Compare **every name/overload in M7:115–127** with the before snapshot: anon false; no unexpected authenticated privilege expansion; migration helper authenticated false. Inspect the hosted update body before accepting email preference authorization as complete.

Finally compare existing-row contents, not just totals; accept only the reviewed additions/configuration change. Re-run advisors and signed-in/public application smoke checks.

## H. Top five risks, ranked

1. **Migration history mismatch can replay unintended SQL.** Reconcile content and apply exactly seven reviewed files; do not infer pending state from version numbers.
2. **M2 breaks invite joining and cancellation.** Direct INSERT fails; direct DELETE can falsely report success. Fix [JoinByInvite.tsx:92](C:/Users/info/tenisx-native/src/pages/JoinByInvite.tsx:92) and [ActiveHOAContext.tsx:225](C:/Users/info/tenisx-native/src/contexts/ActiveHOAContext.tsx:225).
3. **Preservation scope is not satisfied literally.** M4 overwrites bucket configuration; M2 installs physical withdrawal deletes; backfills generate additional lifecycle/notification data. **M4:98; M2:163,185.**
4. **M7 can expand authenticated access and leaves a known authorization unknown.** Grants cover all matched overloads; `update_email_preference` is not reviewed. **M7:13,132–139.**
5. **Successful application can conceal incomplete hardening or cause blocking.** M4 skips uniqueness on duplicates; M3 validates existing values under strong locks; runtime trigger failures can reject bookings. **M4:83–93; M3:6–15,33–42.**

**NEEDS CHANGES — fix invite/cancel client paths; separate and explicitly approve the bucket overwrite; resolve physical withdrawal deletion if preservation is ongoing; narrow/review M7 grants and `update_email_preference`; make M4’s missing unique index a blocking verification failure.**
