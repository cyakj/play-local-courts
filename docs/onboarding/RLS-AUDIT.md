# Static RLS audit — candidates for human review

Offline migration replay only. These findings are CANDIDATES, not verdicts or proof of cross-community access. No database was contacted.

## Hosted-project note (2026-10-23)
A read-only look at the hosted project confirmed RLS is enabled on every public table (the five 'unknown' baseline tables below are resolved) and found anon-callable definer functions beyond this list; see OVERNIGHT-HANDOFF.md section 21. This file is generated; the note was added by hand.

## How to use this report

Every row is a candidate or audit observation from migrations only. Migration history is NOT the source of truth for the hosted database: tables and policies may have been created, changed or dropped outside it. Example to verify first: the policy profiles_select_authenticated (USING (auth.role() = authenticated), created in 20260109213852) is never dropped in the migration history, while 20260518184411 later adds the scoped "Members can view profiles in same HOA". If both exist on the hosted database, every signed-in user can read every profile. GREENS_V1_LAUNCH_MATRIX.md names a different policy as the root cause of the platform-wide profile exposure it found, which suggests profiles_select_authenticated may already have been removed out-of-band, but that is unverified. Verify the real state before drawing conclusions or changing access.

For each table/policy candidate, run this read-only query in the Supabase SQL editor, replacing <table> with the unqualified table name:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename = '<table>' order by policyname;
```

For each function candidate, replace <name> with the function name without schema or arguments. The query returns all matching overloads:

```sql
select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '<name>';
```

Verify tables listed as "RLS state unknown" with this read-only query:

```sql
select relname, relrowsecurity from pg_class where relname = '<table>';
```

These queries are guidance for human verification; the audit tool does not execute them.

Exact observed counts: migrations read: 173; tables: 72; final policies: 214; baseline policies inferred from ALTER: 1; definer functions: 65; candidates: 50; lower-priority trigger candidates: 19; anon-callable public definer functions (grant reachability only): 32; tables with unknown baseline RLS: 5; global-admin policy paths: 1; final helper functions examined: 73; restrictive policies: 0.

| Candidate | Table/function | Policy | Defining migration | Why |
| --- | --- | --- | --- | --- |
| Authenticated-only, no scoping marker | public.profiles | profiles_select_authenticated | 20260109213852_30094278-2d50-428e-8090-b7e9e6b8e4ca.sql | USING (auth.role() = 'authenticated') has no recognized community scope; roles: public. |
| Global admin | public.ladders | Admins and coaches can create ladders | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql | WITH CHECK: public.ladders: Admins and coaches can create ladders -> public.can_create_ladder(uuid, uuid); global-admin body lacks scope or a call does not pass a recognizable hoa id. Function defined in 20260302013226_4b36c4ec-5e13-4ded-ac89-8142edcda374.sql. |
| Unconditional access | public.coaches | Anyone can view coach profiles | 20250625193319-e271b948-6523-4e4d-b102-83b07b8ace01.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.coach_availability | Anyone can view coach availability | 20250625193319-e271b948-6523-4e4d-b102-83b07b8ace01.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.coach_reviews | Anyone can view reviews | 20250625193319-e271b948-6523-4e4d-b102-83b07b8ace01.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.likes | Users can view likes | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.comments | Users can view comments | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.referrals | Users can view referrals | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.referral_leaderboard | Users can view referral leaderboard | 20250813002800-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.posts | Users can view posts | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.tournaments | Users can view tournaments | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.clubs | Users can view clubs | 20250813002835-.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.email_reminders_sent | Service role can manage email reminders | 20260115025515_3fc0ef1c-43f6-434c-82a9-5d47089e6e59.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.email_reminders_sent | Service role can manage email reminders | 20260115025515_3fc0ef1c-43f6-434c-82a9-5d47089e6e59.sql | WITH CHECK (true) has no recognized community scope; roles: public. |
| Unconditional access | public.coach_global_hours | Anyone can view global hours | 20260609120000_coach_schedule_control_panel.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.message_email_throttle | Service role manages message throttle | 20260628120000_notification_fixes.sql | USING (true) has no recognized community scope; roles: public. |
| Unconditional access | public.message_email_throttle | Service role manages message throttle | 20260628120000_notification_fixes.sql | WITH CHECK (true) has no recognized community scope; roles: public. |
| Public execution | public.generate_round_robin_matches(uuid) | — | 20260302012330_8ce04453-fb8a-4402-8a82-0971dd1ed7fb.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.has_role(uuid, app_role) | — | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.is_in_same_hoa(uuid, uuid) | — | 20260109212118_9c5b997b-7c15-43f2-aefe-084b7adf0103.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.is_admin_in_same_hoa(uuid, uuid) | — | 20260518231300_c02d2463-b423-41c5-b83d-56577af70062.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.set_active_hoa(uuid) | — | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.approve_hoa_membership(uuid) | — | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.reject_hoa_membership(uuid) | — | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.check_hoa_admin(uuid, uuid) | — | 20260109213852_30094278-2d50-428e-8090-b7e9e6b8e4ca.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.get_email_preferences(uuid) | — | 20260115024246_889ebaf6-31bd-4182-8ac5-8ee9bb6d1f3d.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.create_default_email_preferences(uuid) | — | 20260115024246_889ebaf6-31bd-4182-8ac5-8ee9bb6d1f3d.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.can_create_ladder(uuid, uuid) | — | 20260302013226_4b36c4ec-5e13-4ded-ac89-8142edcda374.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.is_ladder_admin(uuid) | — | 20260302010729_d72be856-9665-4317-8de6-a4c593b0a23d.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.can_view_ladder(uuid) | — | 20260302120558_c5710fca-e9bc-41a9-a06c-fafef31d752a.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.can_view_ladder_row(uuid, uuid, uuid) | — | 20260302120558_c5710fca-e9bc-41a9-a06c-fafef31d752a.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.check_competition_create_permission(uuid) | — | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.create_competition_ladder(text, text, ladder_format, boolean, text, boolean, uuid, date, date, date, numeric, numeric, int, int, text, int, boolean, boolean, int, text, text, text, int, int, int, text, text, boolean, int, int, int, int, int, int, ladder_status) | — | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.create_maintenance_report(uuid, text, text, text, text, uuid, text, text) | — | 20260318132108_9717de85-e7f7-4145-888d-aa6645d5cfb0.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.get_public_survey_results(uuid) | — | 20260328182207_4d536b08-eec3-4dae-adc5-2a65ea660d53.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.get_survey_member_count(uuid) | — | 20260328182207_4d536b08-eec3-4dae-adc5-2a65ea660d53.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.regenerate_invite_code(uuid) | — | 20260407022034_f777e65c-32cb-4f43-8bb3-4df50da78972.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.get_public_hoa_invite_by_code(text) | — | 20260518190556_0efc31f2-5cfb-4c12-b14f-ede2e34c209c.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.match_tenisx_contacts(text[], text[]) | — | 20260610190000_match_creation_v2.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.clinic_enrollment_counts(uuid[]) | — | 20260610230000_coach_clinics.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Missing search_path | public.expire_past_lesson_requests() | — | 20260627125740_auto_expire_lesson_requests.sql | SECURITY DEFINER has no explicit SET search_path. |
| Public execution | public.expire_past_lesson_requests() | — | 20260627125740_auto_expire_lesson_requests.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |
| Public execution | public.search_players(text) | — | 20260719120000_match_invite_states.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.create_match_listing(jsonb, uuid[], boolean) | — | 20260721010600_create_match_rpc_create_listing.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.approve_match_participant(uuid, uuid) | — | 20260722130000_create_match_fix_slot_index_and_message_types.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public._is_listing_participant(uuid) | — | 20260722120000_create_match_fix_rls_recursion.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public._listing_readable(uuid) | — | 20260722120000_create_match_fix_rls_recursion.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public._listing_open_for_join(uuid) | — | 20260722120000_create_match_fix_rls_recursion.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public._is_listing_creator(uuid) | — | 20260722120000_create_match_fix_rls_recursion.sql | PUBLIC reachability=false; direct anon grant=true; anon reachability=true. |
| Public execution | public.is_hoa_affiliated(uuid) | — | 20260922000420_greens_v1_scope_discoverable_profiles_to_non_hoa_users.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. |

## Restrictive policies (narrow access only)

RESTRICTIVE policies only narrow access allowed by permissive policies; they are excluded from broad-access candidates. Composition across policies still requires review.

No final restrictive policies observed.

## ALTER POLICY on policies not created in migrations

These final baseline policies were first observed through ALTER POLICY. Only altered expressions/roles are known; unobserved command and roles remain UNKNOWN/unknown, rather than assuming CREATE defaults. Missing expressions are unknown, not evidence of unrestricted access. Broad-access candidates conservatively include unknown command/roles for hosted verification.

| Table | Policy | Command | Roles | Altered expressions | First ALTER migration | Last defining migration |
| --- | --- | --- | --- | --- | --- | --- |
| public.profiles | Discoverable profiles visible to authenticated users | UNKNOWN | unknown | USING (location_visible = true AND NOT public.is_hoa_affiliated(id)) | 20260922000420_greens_v1_scope_discoverable_profiles_to_non_hoa_users.sql | 20260922000420_greens_v1_scope_discoverable_profiles_to_non_hoa_users.sql |

## Policies referencing the global admin role

Global admin candidates: 1. Final policy expressions with direct or transitive global-admin references are listed below, including scoped paths. Helper paths require a scope marker in the global-admin function body AND a recognizable hoa id passed at every call site to be marked scoped.

| Table | Policy | Command | Roles | Expression | scoped | orBranchRisk | Defining migration | Chain | Global-admin function migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public.ladders | Admins and coaches can create ladders | INSERT | authenticated | WITH CHECK | false | false | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql | public.ladders: Admins and coaches can create ladders -> public.can_create_ladder(uuid, uuid) | 20260302013226_4b36c4ec-5e13-4ded-ac89-8142edcda374.sql |

## Functions using the global admin role

Lists every final function with a direct has_role(admin) reference, even if no policy calls it. scoped is a lexical body marker, not proof of isolation.

| Function | SECURITY DEFINER | usesGlobalAdmin | scoped | callsHelpers | Defining migration |
| --- | --- | --- | --- | --- | --- |
| public.prevent_profile_sensitive_changes() | true | true | false | public.has_role(uuid, app_role) | 20260103230513_99f85471-fb0c-4e36-90ad-25a00590f66a.sql |
| public.can_create_ladder(uuid, uuid) | true | true | false | public.has_role(uuid, app_role) | 20260302013226_4b36c4ec-5e13-4ded-ac89-8142edcda374.sql |
| public.check_competition_create_permission(uuid) | true | true | false | public.has_role(uuid, app_role), public.can_create_ladder(uuid, uuid) | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql |

### Full final helper inventory examined

All final SQL/plpgsql bodies were examined. Calls are matched by qualified name and compatible argument count; ambiguous overloads are all traversed conservatively. The final body replaces earlier bodies.

| Function | SECURITY DEFINER | usesGlobalAdmin | scoped | callsHelpers | Transitive global-admin chains | Defining migration |
| --- | --- | --- | --- | --- | --- | --- |
| public.handle_match_preferences_updated_at() | false | false | false | (none) | (none) | 20250617122237-3a7c15c7-c7d8-4eff-aa37-1303d6a67e2b.sql |
| public.create_community(text, text, text, text, text) | true | false | true | (none) | (none) | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql |
| public.request_join_community(uuid, text) | true | false | true | public.user_email_verified(), public.hoa_is_approved(uuid) | (none) | 20261022120000_resident_join_flow_hardening.sql |
| public.calculate_ladder_points(integer, integer, boolean) | false | false | false | (none) | (none) | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql |
| public.generate_round_robin_matches(uuid) | true | false | false | (none) | (none) | 20260302012330_8ce04453-fb8a-4402-8a82-0971dd1ed7fb.sql |
| public.has_role(uuid, app_role) | true | false | false | (none) | (none) | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql |
| public.grant_admin_role(uuid) | true | false | false | public.has_role(uuid, app_role) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.is_in_same_hoa(uuid, uuid) | true | false | true | (none) | (none) | 20260109212118_9c5b997b-7c15-43f2-aefe-084b7adf0103.sql |
| public.is_admin_in_same_hoa(uuid, uuid) | true | false | true | (none) | (none) | 20260518231300_c02d2463-b423-41c5-b83d-56577af70062.sql |
| public.assign_coach_role() | true | false | false | (none) | (none) | 20251008024837_36b01fef-1d0e-4860-81ec-f91105e0ea38.sql |
| public.prevent_profile_sensitive_changes() | true | true | false | public.has_role(uuid, app_role) | (none) | 20260103230513_99f85471-fb0c-4e36-90ad-25a00590f66a.sql |
| public.approve_hoa_application(uuid, text) | true | false | true | public.has_role(uuid, app_role) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.update_hoa_application_status(uuid, text, text) | true | false | false | public.has_role(uuid, app_role) | (none) | 20260102102017_70f9ef4a-3b8f-4250-9868-f91016664f2f.sql |
| public.migrate_existing_hoa_memberships() | true | false | true | (none) | (none) | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql |
| public.set_active_hoa(uuid) | true | false | true | (none) | (none) | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql |
| public.request_hoa_membership(uuid, text) | true | false | true | public.user_email_verified(), public.hoa_is_approved(uuid) | (none) | 20261022120000_resident_join_flow_hardening.sql |
| public.approve_hoa_membership(uuid) | true | false | true | (none) | (none) | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql |
| public.reject_hoa_membership(uuid) | true | false | true | (none) | (none) | 20260106171217_cf5d5842-3a92-43f4-a4c1-bbf44c147c62.sql |
| public.check_hoa_admin(uuid, uuid) | true | false | true | (none) | (none) | 20260109213852_30094278-2d50-428e-8090-b7e9e6b8e4ca.sql |
| public.get_email_preferences(uuid) | true | false | false | (none) | (none) | 20260115024246_889ebaf6-31bd-4182-8ac5-8ee9bb6d1f3d.sql |
| public.create_default_email_preferences(uuid) | true | false | false | (none) | (none) | 20260115024246_889ebaf6-31bd-4182-8ac5-8ee9bb6d1f3d.sql |
| public.can_create_ladder(uuid, uuid) | true | true | false | public.has_role(uuid, app_role) | (none) | 20260302013226_4b36c4ec-5e13-4ded-ac89-8142edcda374.sql |
| public.is_ladder_admin(uuid) | true | false | false | (none) | (none) | 20260302010729_d72be856-9665-4317-8de6-a4c593b0a23d.sql |
| public.can_view_ladder(uuid) | true | false | true | public.can_view_ladder_row(uuid, uuid, uuid) | (none) | 20260302120558_c5710fca-e9bc-41a9-a06c-fafef31d752a.sql |
| public.can_view_ladder_row(uuid, uuid, uuid) | true | false | true | (none) | (none) | 20260302120558_c5710fca-e9bc-41a9-a06c-fafef31d752a.sql |
| public.check_competition_create_permission(uuid) | true | true | false | public.has_role(uuid, app_role), public.can_create_ladder(uuid, uuid) | public.check_competition_create_permission(uuid) -> public.can_create_ladder(uuid, uuid) | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql |
| public.create_competition_ladder(text, text, ladder_format, boolean, text, boolean, uuid, date, date, date, numeric, numeric, int, int, text, int, boolean, boolean, int, text, text, text, int, int, int, text, text, boolean, int, int, int, int, int, int, ladder_status) | true | false | true | public.can_create_ladder(uuid, uuid) | public.create_competition_ladder(text, text, ladder_format, boolean, text, boolean, uuid, date, date, date, numeric, numeric, int, int, text, int, boolean, boolean, int, text, text, text, int, int, int, text, text, boolean, int, int, int, int, int, int, ladder_status) -> public.can_create_ladder(uuid, uuid) | 20260302123245_0e43c240-f834-4f3e-ab52-00aa4b41f1bc.sql |
| public.notify_admins_on_report() | true | false | true | (none) | (none) | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_reporter_on_status_change() | true | false | true | (none) | (none) | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.notify_admins_on_member_application() | true | false | true | (none) | (none) | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_applicant_on_membership_change() | true | false | true | (none) | (none) | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_booker_on_booking() | true | false | true | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.create_maintenance_report(uuid, text, text, text, text, uuid, text, text) | true | false | true | (none) | (none) | 20260318132108_9717de85-e7f7-4145-888d-aa6645d5cfb0.sql |
| public.get_public_survey_results(uuid) | true | false | true | (none) | (none) | 20260328182207_4d536b08-eec3-4dae-adc5-2a65ea660d53.sql |
| public.get_survey_member_count(uuid) | true | false | true | (none) | (none) | 20260328182207_4d536b08-eec3-4dae-adc5-2a65ea660d53.sql |
| public.generate_invite_code(text) | false | false | false | (none) | (none) | 20260407022034_f777e65c-32cb-4f43-8bb3-4df50da78972.sql |
| public.auto_generate_invite_code() | false | false | false | public.generate_invite_code(text) | (none) | 20260407022034_f777e65c-32cb-4f43-8bb3-4df50da78972.sql |
| public.regenerate_invite_code(uuid) | true | false | true | public.check_hoa_admin(uuid, uuid), public.generate_invite_code(text) | (none) | 20260407022034_f777e65c-32cb-4f43-8bb3-4df50da78972.sql |
| public.get_public_hoa_invite_by_code(text) | true | false | false | (none) | (none) | 20260518190556_0efc31f2-5cfb-4c12-b14f-ede2e34c209c.sql |
| public.prevent_overlapping_coach_teaching_blocks() | false | false | false | (none) | (none) | 20260609170000_coach_teaching_blocks.sql |
| public.validate_coach_teaching_block_boundary() | false | false | false | (none) | (none) | 20260609170000_coach_teaching_blocks.sql |
| public.replace_own_coach_teaching_blocks(jsonb) | false | false | false | (none) | (none) | 20260609170000_coach_teaching_blocks.sql |
| public.match_tenisx_contacts(text[], text[]) | true | false | false | (none) | (none) | 20260610190000_match_creation_v2.sql |
| public.clinic_enrollment_counts(uuid[]) | true | false | false | (none) | (none) | 20260610230000_coach_clinics.sql |
| public.set_updated_at() | false | false | false | (none) | (none) | 20260610230000_coach_clinics.sql |
| public.expire_past_lesson_requests() | true | false | false | (none) | (none) | 20260627125740_auto_expire_lesson_requests.sql |
| public.search_players(text) | true | false | true | (none) | (none) | 20260719120000_match_invite_states.sql |
| public.create_match_listing(jsonb, uuid[], boolean) | true | false | false | (none) | (none) | 20260721010600_create_match_rpc_create_listing.sql |
| public.approve_match_participant(uuid, uuid) | true | false | false | (none) | (none) | 20260722130000_create_match_fix_slot_index_and_message_types.sql |
| public._is_listing_participant(uuid) | true | false | false | (none) | (none) | 20260722120000_create_match_fix_rls_recursion.sql |
| public._listing_readable(uuid) | true | false | false | (none) | (none) | 20260722120000_create_match_fix_rls_recursion.sql |
| public._listing_open_for_join(uuid) | true | false | false | (none) | (none) | 20260722120000_create_match_fix_rls_recursion.sql |
| public._is_listing_creator(uuid) | true | false | false | (none) | (none) | 20260722120000_create_match_fix_rls_recursion.sql |
| public.is_hoa_affiliated(uuid) | true | false | true | (none) | (none) | 20260922000420_greens_v1_scope_discoverable_profiles_to_non_hoa_users.sql |
| public.enforce_amenity_booking_rules() | true | false | false | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.enforce_booking_cancellation_window() | true | false | true | public.check_hoa_admin(uuid, uuid) | (none) | 20261012190000_greens_v1_booking_approval_workflow.sql |
| public.prevent_notification_content_changes() | true | false | true | (none) | (none) | 20260922010908_greens_v1_restrict_notification_mark_read.sql |
| public.enforce_booking_status_transitions() | true | false | true | public.check_hoa_admin(uuid, uuid) | (none) | 20261012190000_greens_v1_booking_approval_workflow.sql |
| public.notify_reporter_on_public_note() | true | false | true | (none) | (none) | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.deprecate_report_admin_notes() | true | false | false | (none) | (none) | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.log_court_maintenance_change() | true | false | true | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.guard_court_maintenance_change() | true | false | false | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.notify_booker_on_booking_status() | true | false | true | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.admin_blockout_conflicts(uuid, date, date, time, time) | true | false | true | public.check_hoa_admin(uuid, uuid) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text) | true | false | true | public.check_hoa_admin(uuid, uuid) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.guard_membership_admin_changes() | true | false | true | (none) | (none) | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.hoa_is_approved(uuid) | true | false | false | (none) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.guard_platform_reviewer_role() | true | false | false | (none) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.can_send_message(uuid, uuid, uuid, uuid) | true | false | true | (none) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.guard_message_update() | true | false | false | (none) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.my_message_contacts() | true | false | true | (none) | (none) | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.user_email_verified() | true | false | false | (none) | (none) | 20261022120000_resident_join_flow_hardening.sql |
| public.withdraw_membership_request(uuid) | true | false | true | (none) | (none) | 20261022120000_resident_join_flow_hardening.sql |

### Helper traversal limits encountered

No cycles or depth limits encountered.

## RLS state unknown - table not created in migrations (verify on the database)

These baseline tables are not RLS-disabled findings. Observed toggles are shown as evidence, but their creation and initial RLS state are outside this migration history. System-schema tables are excluded from RLS-disabled and unknown-baseline checks.

| Table | Last observed RLS toggle | Migration evidence |
| --- | --- | --- |
| public.courts | none | 20250613130452-a097168c-9a28-41e3-9e0e-ad598fa43dcb.sql |
| public.hoas | none | 20250622222449-6355824b-83c9-4923-a7c8-cbb557b5e54a.sql |
| public.court_maintenance | none | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql |
| public.bookings | none | 20251008023157_6123941c-c4c0-4d4a-a863-c2295491c9a1.sql |
| public.email_preferences | none | 20260115024246_889ebaf6-31bd-4182-8ac5-8ee9bb6d1f3d.sql |

## Lower-priority SECURITY DEFINER trigger functions

RETURNS trigger functions cannot be called directly through the PostgREST API. Their grant/search_path candidates are listed separately and excluded from the anon-callable count and main candidate count.

| Trigger function | SET search_path present | PUBLIC grant | Direct anon grant | Defining migration |
| --- | --- | --- | --- | --- |
| public.assign_coach_role() | true | true | true | 20251008024837_36b01fef-1d0e-4860-81ec-f91105e0ea38.sql |
| public.prevent_profile_sensitive_changes() | true | true | true | 20260103230513_99f85471-fb0c-4e36-90ad-25a00590f66a.sql |
| public.notify_admins_on_report() | true | true | true | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_reporter_on_status_change() | true | true | true | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.notify_admins_on_member_application() | true | true | true | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_applicant_on_membership_change() | true | true | true | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql |
| public.notify_booker_on_booking() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.enforce_amenity_booking_rules() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.enforce_booking_cancellation_window() | true | true | true | 20261012190000_greens_v1_booking_approval_workflow.sql |
| public.prevent_notification_content_changes() | true | true | true | 20260922010908_greens_v1_restrict_notification_mark_read.sql |
| public.enforce_booking_status_transitions() | true | true | true | 20261012190000_greens_v1_booking_approval_workflow.sql |
| public.notify_reporter_on_public_note() | true | true | true | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.deprecate_report_admin_notes() | true | true | true | 20261013100000_admin_reports_internal_notes_and_notifications.sql |
| public.log_court_maintenance_change() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.guard_court_maintenance_change() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.notify_booker_on_booking_status() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.guard_membership_admin_changes() | true | true | true | 20261013110000_admin_blockouts_and_reservation_workflow.sql |
| public.guard_platform_reviewer_role() | true | true | true | 20261013120000_platform_approval_and_secure_messaging.sql |
| public.guard_message_update() | true | true | true | 20261013120000_platform_approval_and_secure_messaging.sql |

### Trigger candidates

| Candidate | Table/function | Policy | Defining migration | Why |
| --- | --- | --- | --- | --- |
| Public execution | public.assign_coach_role() | — | 20251008024837_36b01fef-1d0e-4860-81ec-f91105e0ea38.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.prevent_profile_sensitive_changes() | — | 20260103230513_99f85471-fb0c-4e36-90ad-25a00590f66a.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_admins_on_report() | — | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_reporter_on_status_change() | — | 20261013100000_admin_reports_internal_notes_and_notifications.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_admins_on_member_application() | — | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_applicant_on_membership_change() | — | 20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_booker_on_booking() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.enforce_amenity_booking_rules() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.enforce_booking_cancellation_window() | — | 20261012190000_greens_v1_booking_approval_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.prevent_notification_content_changes() | — | 20260922010908_greens_v1_restrict_notification_mark_read.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.enforce_booking_status_transitions() | — | 20261012190000_greens_v1_booking_approval_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_reporter_on_public_note() | — | 20261013100000_admin_reports_internal_notes_and_notifications.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.deprecate_report_admin_notes() | — | 20261013100000_admin_reports_internal_notes_and_notifications.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.log_court_maintenance_change() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.guard_court_maintenance_change() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.notify_booker_on_booking_status() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.guard_membership_admin_changes() | — | 20261013110000_admin_blockouts_and_reservation_workflow.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.guard_platform_reviewer_role() | — | 20261013120000_platform_approval_and_secure_messaging.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |
| Public execution | public.guard_message_update() | — | 20261013120000_platform_approval_and_secure_messaging.sql | PUBLIC reachability=true; direct anon grant=true; anon reachability=true. RETURNS trigger: not directly API-callable. |

## Parser limits

- DO blocks: only CREATE POLICY statements inside them are replayed (with IF NOT EXISTS semantics, matched on the exact policy name). Other statements inside DO blocks, and conditions other than the policy-name check, are not modelled.
- The statement reader is regex / tokenizer based. It was hardened over eight review rounds against specific forms (renamed policies, argument lists, casts, wrappers, quoting), but unusual SQL forms that do not occur in the current migrations can still be mis-classified. This is why every row is a candidate for human review and the verification queries above are provided.
- Counts and final states describe the static replay, assuming migrations execute successfully in filename order. Tables referenced but never created in migrations are counted as observed tables and listed separately with unknown baseline RLS. RLS-disabled checks exclude system schemas (storage, auth, pg_catalog, information_schema, extensions, realtime, supabase_functions, vault).
- Handles top-level CREATE/DROP/ALTER POLICY, CREATE/DROP TABLE, ENABLE/DISABLE RLS, CREATE/REPLACE/DROP FUNCTION and explicit EXECUTE/ALL function grants. CREATE OR REPLACE preserves grants. Function argument extraction balances parentheses and protects quoted text; numeric type modifiers are removed from identity signatures. Complex types, aliases and quoted argument names may not match. Policy FOR/TO attributes are read only from the header before USING/WITH CHECK. Baseline ALTER policies retain unknown attributes and only observed expressions.
- Dollar bodies, strings and comments are protected during statement splitting. Dynamic SQL and DDL inside DO/function bodies are not replayed. Table/schema renames, dependencies/CASCADE effects, ALTER FUNCTION, changes to default privileges, role inheritance, owners, schema privileges, transactions and conditional execution are not modeled. Escaped E-strings are not fully modeled.
- Grants without argument lists apply to every tracked overload of the qualified name. ON ALL FUNCTIONS IN SCHEMA applies only to functions existing at that replay point. New public-schema functions start with Supabase default EXECUTE grants to PUBLIC, anon, authenticated and the service role; other schemas start with PUBLIC only. Replacements preserve grants. PUBLIC and direct anon grants are reported separately; either permits anon grant reachability, subject to unmodeled privileges. RETURNS trigger functions are excluded from anon-callable counts.
- Direct policy scope detection splits Boolean AND/OR with parentheses. AND inherits a surrounding scope constraint; OR requires every branch to carry scope for scoped=true. orBranchRisk applies to direct policy references only. Recognized direct markers: hoa_id, check_hoa_admin, is_hoa_admin, is_admin_in_same_hoa, hoa_memberships. NOT, CASE, literal text and nested SQL can confound detection; flags do not prove Boolean safety or correlation.
- Final SQL/plpgsql AS bodies (dollar-quoted or ordinary strings) are retained. Body usesGlobalAdmin is lexical; body scoped uses the same AND/OR analysis as policies and is conservative (OR alternatives and control flow stay candidates, flagged for manual review); scope markers include hoa_id (also prefixed parameter names), hoa_memberships, check_hoa_admin, is_hoa_admin, is_admin_in_same_hoa and is_in_same_hoa. Helper chains are cycle-safe and bounded to 16 edges; encountered limits are listed. Calls resolve by qualified name (unqualified names assume public) and compatible arity/defaults; ambiguous overloads are all considered, without type inference or search_path resolution. Dynamic SQL, variadic calls, SQL-standard BEGIN ATOMIC bodies and functions missing from migrations are not resolved. Body scope plus recognizable hoa-id arguments at every edge is a heuristic; parameter/data flow, function Boolean branches and actual community isolation are not proven. Function inventory lists all examined helpers even when no policy paths are found.
- All observed tables are conservatively considered potentially personal/community data for broad-access SELECT/ALL candidates, including PUBLIC policies inherited by anon/authenticated and baseline policies with unknown command/roles. Supported atoms: true (optional parentheses and boolean/text casts), 1=1, auth.uid() IS NOT NULL, auth.role() = authenticated (including parenthesized/text-cast calls). Authenticated-only atoms have a separate label. Expressions mentioning recognized community scope markers are excluded from this class. This is a finite pattern check, not general constant folding or a proof of access.
- No data classification, effective table privileges, restrictive/permissive policy composition or actual authorization is evaluated. Policy migration cites its last definition/alteration; function migration cites its last definition; disabled RLS cites its last toggle or first table observation. Hosted state can differ from all replayed states; use the read-only verification queries above.
