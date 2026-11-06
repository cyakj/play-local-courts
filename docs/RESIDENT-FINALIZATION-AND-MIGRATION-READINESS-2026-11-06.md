# Resident finalization and migration readiness — 2026-11-06

Local only. Nothing pushed, nothing applied to hosted, no hosted writes. `.claude/settings.local.json` is modified locally and not committed.
Starting HEAD: `ae1c43f`. Final HEAD: see section 18 (the last commit of this report).

## 1–2. Changes (commits after `ae1c43f`)
| Commit | Change |
|---|---|
| `0f24b7c`, `80c4188` | Wheel ghost rows removed |
| `eb495ed` | Singles/Doubles buttons carry duration; `bookingDurations.ts` rewritten around HOA lists; migration `20261106100000` (+rollback, SQL test) |
| `433ff9b` | Manage Amenities: length chips, per amenity and per Singles/Doubles |
| `6d6e7df` | Wheel sound pool + volume constant + stale-tick drop; Light/Medium haptics |
| `c40ff98` | Schedule fixes; migration `20261106110000` board-only events (+rollback) |
| (inspection fixes) x2 | Codex round 1 and 2 findings, see section 11 |
| (this report) | docs |

## 3. Root cause of the ghost bars
Commit `4655621` added `GhostRow` filler views (a 10 px `theme.border` bar at 70 % width, run through the same drum transform) to fill the scroll padding above the first and below the last time. They read as loading skeletons. Removed: the padding is empty again (`paddingVertical: pad`), faded by the existing edge masks. `ghostLayout/ghostIndexes` deleted from `wheelLayout.ts`. Nothing else in the wheel changed.

## 4. Singles/Doubles behaviour
- Shown only when `isRacquetType` (tennis, pickleball). Never for pools, clubhouses, rooms, etc. (Previously pickleball was not treated as racquet at all, in the UI or the DB.)
- Button = format name + duration subtext: one length → `90 min`; several → `60 · 90 min`. The separate floating label is gone. Equal widths.
- If the selected format allows several lengths a compact chip selector appears; one length shows no selector. Non-racquet amenities show chips for several lengths, or a plain `N min reservations` line for one.
- Labels always carry units. Nothing is hard-coded: durations come from the HOA configuration; legacy defaults (60/90) apply only where the server already applies them.
- Allowed duration is independent of the per-day booking quota.
- Configuration conflict (an explicit list whose lengths all exceed the server cap): booking is blocked with an explanatory line rather than offering a length the trigger would reject.

## 5. Amenity configuration — findings, capabilities, limits
Audit answers:
1. Stored: `amenity_rules.max_duration_minutes` (all amenities), `singles_duration_minutes` / `doubles_duration_minutes` (tennis).
2. Enforced: only as a **cap** by `enforce_amenity_booking_rules` (tennis → format minutes; everything else, including pickleball → `max_duration_minutes ?? 60`).
3. Independent Singles/Doubles: only by the two legacy numeric columns, and the admin screen could not edit them (only one "BOOKING DURATION" stepper → `max_duration_minutes`).
4. Explicit list: did not exist.
5. Conflicting saves: yes — the stepper changed only the cap, while the resident picker derived options from singles/doubles ≤ cap, so what the admin set and what residents saw could differ.
6/7. Picker and server agreed only on the cap.

Now: optional `allowed_durations`, `singles_allowed_durations`, `doubles_allowed_durations` (NULL = legacy, never back-filled). Enforced by a separate BEFORE INSERT trigger in addition to the cap (the big function is not copied). The admin screen writes the lists plus the legacy cap in step with the longest listed length, only when the admin changed durations, and degrades to saving the legacy cap when the columns do not exist yet (shows a notice).
Limits: the trigger checks INSERT only (as the existing cap does); administrator edits that move a booking are not re-checked. Chip choices are 30/45/60/90/120/150/180/240 (a saved odd value stays visible). Not applied to hosted; the admin multi-length feature is inert until the migration is.

## 6. Audio synchronisation
Before: one shared player; each tick did `await seekTo(0)` then `play()` (async latency per tick), no volume setting (full volume), 70 ms sound gap, no handling of late JS delivery, never released.
Now: pool of 4 preloaded players, `play()` immediately from a rewound player, rewound ~30 ms later (the clip is 22 ms); no free player → tick dropped (no queue/backlog/overlap); UI-thread timestamp passed with each row change and ticks older than 80 ms are dropped; volume `PICKER_SOUND_VOLUME = 0.35` (≈ −9 dB, roughly half perceived loudness) in `pickerFeedback.ts`; sound gap 30 ms; players released when the last wheel unmounts; silent-switch, mixing, background and off-by-default preserved. Sound asset unchanged (original). **Not claimed synchronised until tested on an iPhone.**

## 7. Haptics
Tick: `selectionAsync` → `impactAsync(Light)`; select-a-time: Light → Medium. One call per event, 40 ms gap, nothing on initial load / programmatic scroll / refresh / when disabled; works with sound off. Constants in `pickerFeedback.ts`. Needs physical tuning.

## 8. Schedule audit
| Category | Finding | Action |
|---|---|---|
| Community events / board meetings / maintenance events (`hoa_events`) | **Bug:** resident Schedule and Home filtered `status = 'approved'`; the table CHECK only allows `active`/`cancelled`, so no HOA event could ever show | Fixed to `active` |
| Amenity reservations | Only `confirmed`; own pending missing | Own `confirmed` + `pending` (labelled "Pending approval"); cancelled/expired/denied excluded; only the user's own rows are queried |
| Maintenance | Planned closures (`court_maintenance`, which already blocks booking) not shown | Added as Maintenance, one item per day, hours + reason; private maintenance reports are never queried |
| Board meetings | No way to hide internal/executive sessions; every active event visible to all members | Migration `20261106110000` (audience column, narrowed resident SELECT); admin "Board only" toggle (also suppresses the resident notification) |
| Time zones | timestamptz events rendered in the device zone | Converted at render to the active community's zone; **other communities' events remain in device zone** (their zones are not loaded client-side) |
| Realtime | Bookings/matches only | closure/events changes appear on next load (not changed) |
Not done: Community Pulse ↔ closure linkage. A published closure notice (announcement) and the blockout remain two records; they are not auto-linked and a `maintenance_scheduled` hoa_event for the same closure would duplicate it. Empty/loading states and date navigation were read, not changed.

## 9. Community Pulse / Phase 7 regression
No Home, legend, announcement or reservation-detail code was edited except the Home events `status` filter. The existing logic suites that pin these behaviours (six-dot legend, one Pulse announcement, urgent-first, no Home maintenance card, HOA-local cancellation line, upcoming/history) all pass (section 10). Visual confirmation needs the iPhone.

## 10. Tests actually run
`npx playwright test -c playwright.logic.config.ts` — **689 passed, 0 failed** (Node-only: pure logic and source-level assertions; **no live backend, no browser, no device**). `npx tsc --noEmit` — no errors in touched files (repo has unrelated pre-existing errors, e.g. file-name casing, `app-tabs.web.tsx`). **Not run:** iOS export (RAM ≈ 2 GB free), browser suites, any PostgreSQL/rehearsal. The two new migrations and `supabase/tests/amenity_allowed_durations.sql` have never been executed.

## 11. Independent review (Codex, via `claudex-loop` `inspect`, base `ae1c43f`, effective model gpt-6.1-sol, read-only)
Round 1: REVISE, 6 medium findings, all accepted/fixed (R5 partially):
- R1 changing amenity type left the draft empty → draft rebuilt on racquet↔other change.
- R2 no-rules-row + old server: list columns rejected → retry with legacy cap (`isMissingColumnError`).
- R3 saving unrelated fields rewrote duration config → durations written only when edited.
- R4 explicit list vs lower cap fell back to an unlisted length → `[]` conflict, booking blocked with message.
- R5 events converted once at fetch with stale zone → converted at render from raw timestamp; **limitation: only the active community's zone is known**.
- R6 closure 60-day cap counted from start → counted from today, 120 days.
Round 2 (fresh session, fixed snapshot): REVISE, 3 medium findings:
- R2-1 the missing-column retry still sent the list keys → fixed (keys stripped).
- R2-2 non-racquet legacy-only save changed only the cap while residents still got the old singles/doubles minutes → fixed (`legacyColumnsFor` also sets those two columns to the longest length).
- R2-3 events of a non-active community are converted in the device zone, not their own → **NOT fixed**: each community's zone is not loaded on this screen and `hoas.timezone` does not exist on hosted until Stage E, so a select would fail without a fallback. Open limitation (section 16).
The inspection budget (2 rounds) is exhausted: the R2-1 and R2-2 fixes have **no independent review**; they are covered only by the new logic tests.

## 12. Migration dependency map (hosted history ends `20261013190307`, re-read 2026-11-06; PG 15.8.1; `btree_gist` installed; `pg_cron` available, not installed)
Nothing below is applied. SQL existing in the repo ≠ deployed.
```
D  20261030120000 profile_photos_private_bucket     (independent)              -> unlocks profile photos
G  20261031120000 profiles_member_read_gap          (independent; needs rehearsal of supabase/tests/profiles_read_gap.sql)
A  20261022120000, 20261023100000, 20261023110000, 20261023120000
B  20261013130000 -> 20261023140000
C  20261023130000 -> 20261030140000 -> 20261030130000
E  20261031100000 hoa_timezones                     -> required by F, by correct HOA-local reservations
F  20261031110000 exclusive_pending_reservations    (needs E; Gate-1 overlap query = 0) -> exclusive holds, accurate availability
H  20261101100000 announcement_urgency_and_category (independent)              -> Pulse urgency/category
AD 20261106100000 amenity_allowed_durations         (independent; NEW)         -> multi-length / per-format lengths
EV 20261106110000 hoa_event_audience                (independent; NEW, narrows an RLS policy) -> board-only events
Unread announcement counts: NOT implemented (no read-tracking table exists); no migration prepared.
```
Note: E redefines `enforce_amenity_booking_rules`; AD does not touch that function (separate trigger), so AD is order-independent of E/F. Old plan order (D → G → A → B → C → E → F → H) is still valid; AD and EV append after H. Rev-3 plan: `docs/MIGRATION-PLAN-2026-11-01.md`.

| Stage | File | Preflight (read-only) | Data risk | Rollback | Smoke test | Approval |
|---|---|---|---|---|---|---|
| D | `20261030120000_…` | bucket list / profiles columns (plan Gate 1 a) | none (new bucket, policies, nullable column) | plan §3-D | `PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md` step 4 | yours |
| G | `20261031120000_…` | profiles policies = the expected three | read-access narrowing | `rollbacks/20261031120000_…` | resident cannot read co-member phone | yours, after rehearsal |
| E/F | see rev 2/3 | overlap query = 0 | slot behaviour changes | `rollbacks/` | rev 2 §3 | yours |
| H | `20261101100000_…` | columns absent | none (defaults) | `rollbacks/` | rev 3 §6 | yours |
| AD | `20261106100000_…` | `select column_name from information_schema.columns where table_name='amenity_rules' and column_name like '%allowed_durations'` → 0 rows | none (nullable, no back-fill) | `rollbacks/20261106100000_…` (drops the 3 lists) | admin sets Pool=60/90; resident sees both; 45-min insert refused | yours |
| EV | `20261106110000_…` | `select policyname, qual from pg_policies where tablename='hoa_events'` (hosted may differ from the repo's initial migration) | **RLS narrowing**; rollback exposes board-only events again | `rollbacks/20261106110000_…` (read its WARNING) | create board-only meeting; resident Schedule must not list it | yours |

## 13. Backup status
`scripts/hosted-backup/backup.ps1` re-read: project ref hard-coded `hqqlrliakttqsbalvuyz` (TENISX REAL), new timestamped folder (no `-Force`), read-only sessions, hidden password, never printed. **No fresh backup exists.** Only `C:\Users\info\tenisx-backups\20261029-235117-04c5d3` (old; do not treat as current hosted data).
Command for you (new PowerShell window, repo root; close heavy apps first):
```powershell
cd C:\Users\info\tenisx-native
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\backup.ps1 -SkipVerify
```
Then, when memory is free and you approve: `powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\verify-restore.ps1 -BackupDir C:\Users\info\tenisx-backups\<new folder>` — the backup is not verified until it prints `RESTORE VERIFIED`.

## 14. Restore / rehearsal status
Not performed this session (no fresh backup; RAM ≈ 2 GB; needs your approval). Earlier rehearsals (PG 17 on the 10-29 restore) cover D/E/F etc. but **not** G, H, AD or EV, and none on PG 15. Hosted preflight: only `list_migrations`, `list_extensions`, `get_project` were possible (the connector has no SQL tool); policies, storage buckets, announcement/amenity schema, reservation conflicts were **not** read — run `docs/onboarding/HOSTED-VERIFY-READONLY.sql` and the Gate-1 queries in the plan in the Supabase SQL editor.

## 15. Deploying Stage D (profile photos) safely — what you do
1. Run the backup command (section 13), then the restore verification; confirm `RESTORE VERIFIED`.
2. Run Gate-1 (a) and (c) in the SQL editor and send me the output.
3. Tell me explicitly to apply `20261030120000` (or paste it in the SQL editor yourself). Never `supabase db push`.
4. Run the verification queries and the iPhone smoke test (section 17 B).
Profile-photo design verified by reading: private `profile-photos` bucket, owner-only policies (folder = `auth.uid()`), 5 MB, JPEG/PNG/WebP (bucket + client magic-byte sniff), signed URLs refreshed before expiry, add/replace/remove flows, accurate "bucket not found" message only for that error. No public-avatars workaround. Storage API behaviour has never been exercised end to end.

## 16. Remaining resident launch blockers
Hosted migrations D, G, A–C, E, F, H (+AD, EV) all unapplied; fresh backup + restore verification; Gate-1 hosted reads; PG15 rehearsal; no device verification of anything in this report; unread-announcement counts unimplemented; per-community time zone for the Schedule's non-active communities; Community Pulse ↔ closure not linked.

## 17. iPhone acceptance checklist (Expo Go)
A. Wheel: no grey bars at top/bottom; blank faded space instead; first and last real times readable and selectable; curves, band, snapping, weather, availability unchanged; narrow and wide iPhone.
B. Reservation sheet — Tennis/Pickleball: Singles/Doubles buttons show durations (`60 min`, `90 min`); no floating label; Pool/Clubhouse show no Singles/Doubles; Pool with one length shows no selector.
C. Sound (Settings → Sound on): quiet tick per row on slow scroll; follows a moderate scroll; fast flick → no late burst; silent switch silences; off by default.
D. Haptics: clearly firmer than before but refined; none on opening the sheet or refreshing; firmer on Select; haptics off in Settings → none.
E. Schedule: All/Reservations/Events/Board/Maintenance filters; own pending reservation visible and labelled; a closure appears under Maintenance and its dates are unbookable; event times correct for the community zone (try a device in another zone).
F. Admin (after AD): Manage Amenities length chips per amenity/format; before AD, the notice "Saved with one length".
G. Regression: six solid legend dots; one Pulse announcement on Home; no Home maintenance card; HOA-local cancellation deadline.
H. After Stage D only: profile photo add / replace / remove, 6 MB and PDF refused, second account cannot read the first's object.

## 18. Final Git status and second inspection
Inspection round 2 result is in section 11. After the final commit, `git status` shows only `.claude/settings.local.json` modified (intentionally uncommitted). Final HEAD = the commit titled `docs: resident finalization and migration readiness report`.
