# TenisX V1 — Session Handoff, 2026-11-01

Local checkpoint only. Nothing has been pushed to GitHub; these commits exist only on this computer.

## 1. Repository state
- Repo: `C:\Users\info\tenisx-native`, branch `v1/overnight-integration` (no upstream pushes made).
- Latest commit: `e08661d`. Previous: `d4baba9` (UI polish), `abd56d2`, `fd5c52c`, `81b7efe`, `0846e2e` (earlier session: timezones, Stage G, docs).
- Working tree clean except `.claude/settings.local.json` (user-specific; deliberately left untouched and uncommitted).

## 2. Implemented (committed, local)
Verified only by Node logic tests (600 pass), tsc on touched files and a successful `expo export --platform ios`. NOT verified on a device.

| Area | What exists |
|---|---|
| Reservation sheet | Compact one-row legend (full text kept as accessibility labels); single "Available to book: 7 AM–7 PM" line; duration shown as a small label on the play-type row; approval notice promises a hold only after `get_amenity_busy_times` answered successfully. Files: `src/lib/reservationCopy.ts`, `src/components/ui/ReservationLegend.tsx`, `src/app/(resident)/courts.tsx`. |
| My Reservations | Badge/chevron overlap fixed: shrinkable card body, wrapping title row, fixed 20px chevron slot, badge `maxWidth:'100%'`. Files: `src/app/my-reservations.tsx`, `ReservationBadge.tsx`. |
| Time wheel | Custom reanimated drum (`TimeSlotWheel.tsx`): ~7–9 rows, curvature, fade masks, fixed centre band, snaps per 30-minute row. Focus is not selection; only the Select button selects; disabled rows never select. Existing testIDs preserved. Curvature constants `DRUM_DEG_PER_ROW` / `DRUM_MAX_DEG` may need on-device tuning. |
| Haptics / sound | `expo-haptics` tick per user-driven row change (throttled 40 ms), firmer confirm on select (only if haptics on). Optional `expo-audio` tick (22 ms original click, off by default, respects silent switch, mixes with others). Settings card "TIME PICKER FEEDBACK". Files: `pickerFeedback.ts`, `pickerFeedbackRuntime.ts`, `settings.tsx`, `assets/sounds/picker-tick.wav`. |
| Community Pulse | Home shows exactly ONE announcement (urgent first, else newest); hides when none. |
| Urgency / categories | Coral dot only when `is_urgent` is true in data (never inferred from text). Maintenance/service category chip, distinct from individual maintenance reports. Both need the Stage H migration; without it the app silently shows neither. |
| Announcements / Survey Results | Source already themed (tokens, inner header, back nav); black-screen could not be reproduced from source. Lists show dot + chip. Not seen on a device. |
| Timezones (earlier) | Per-HOA IANA zones in `(cm)` screens and reminder Edge Function (`_shared/reminderWindow.ts`). Reminder function is deployed separately. |
| Privacy (earlier) | Stage G migration written; app uses `community_member_names` directory via `src/lib/memberNames.ts`. |

## 3. Written but NOT applied (blocked on migrations)
Hosted history ends at `20261013190307`. Nothing below is on TENISX REAL (`hqqlrliakttqsbalvuyz`).

| Stage | Migration | Unlocks |
|---|---|---|
| D | `20261030120000_profile_photos_private_bucket.sql` | Profile photos. **BLOCKER.** Do not weaken Storage or use the public `avatars` bucket. Needs fresh backup, restore verification, Gate-1 SQL, rehearsal, explicit approval, live Expo Go smoke test. |
| G | `20261031120000_profiles_member_read_gap.sql` (+ rollback, `supabase/tests/profiles_read_gap.sql` NOT run) | Closes resident profile read gap (own row + community admins only). Rehearsal on PG15/17 still to do. |
| A/B/C | `20261013…`–`20261030…` series (see `docs/MIGRATION-PLAN-2026-11-01.md`) | Admin workflow, join hardening, report photos, etc. |
| E | `20261031100000_hoa_timezones.sql` | Authoritative per-HOA zones. |
| F | `20261031110000_exclusive_pending_reservations.sql` | Exclusive pending holds, busy-times RPC (hold promise + other residents' bookings on the wheel). |
| H | `20261101100000_announcement_urgency_and_category.sql` (+ rollback; additive; NOT rehearsed) | Urgent dot, Maintenance/Service chips. |

Planned order: D → G → A → B → C → E → F → H. One reviewed file at a time; never `supabase db push`. Details: `docs/MIGRATION-PLAN-2026-11-01.md`.

## 4. Backup and Gate-1 (still required)
- No fresh backup exists. Latest: `C:\Users\info\tenisx-backups\20261029-235117-04c5d3`.
- You run: `scripts/hosted-backup/backup.ps1 -SkipVerify` (reads the password hidden; never paste it in chat).
- A restore verification is memory-heavy and needs your explicit approval; do not call the backup verified until a restore succeeds.
- Gate-1 read-only SQL (a), (b), (c), (f) is in the migration plan; run it in the Supabase SQL editor and paste the output (the connector has no SQL tool).

## 5. Tests and limitations
- Logic suite `npx playwright test -c playwright.logic.config.ts`: 600 passed.
- Browser suites NOT run (dev server cold/low memory). Four mocked specs edited but unexecuted: `courts.spec.ts`, `reservation-holds-mocked-ui.spec.ts`, `reservation-status-mocked-ui.spec.ts`, `slots-mocked-ui.spec.ts`.
- tsc: only pre-existing errors. `expo install --check`: 3 pre-existing patch updates.
- No tactile, visual or audio verification on a device.
- Codex reviewed both sessions' work; fixes made; fixes not re-reviewed.

## 6. Outstanding
- Physical-iPhone acceptance checklist: `docs/RESIDENT-UI-POLISH-REPORT-2026-11-01.md` section 11 (wheel curvature direction, tick feel, silent switch, badge layout, sheet density, Pulse card).
- Administrator announcement-editing UI is deferred; until then `is_urgent`/`category` are set in the Supabase editor (after Stage H).
- Stage G DB test and Stage H migration rehearsals not done.
- Hosted deployment: NO-GO.

## 7. Recommended next steps
1. Test the build on a physical iPhone in Expo Go using the checklist; send feedback.
2. Run `backup.ps1 -SkipVerify`; then approve a restore verification when memory allows.
3. Run Gate-1 SQL and paste results.
4. Rehearse G and H on scratch PG; decide on Stage G.
5. Apply Stage D first, with explicit per-write approval, then run the Expo Go photo smoke test.
6. Build the admin announcement editor.
7. Push to GitHub only when you explicitly say so.

## 8. Safety attestation (this checkpoint)
No hosted Supabase writes, no migrations applied, no GitHub push, no deployment, no backups or scratch data deleted, no secrets committed, no user changes discarded.
