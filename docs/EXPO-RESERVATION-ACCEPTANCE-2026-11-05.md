# Expo Go reservation acceptance & UI corrections — 2026-11-05

Branch `v1/overnight-integration`, local only. No push, no hosted Supabase access, no migration applied, no new migration written.

## 1–2. 90-minute "Limit" — root cause (a bug, not HOA configuration)
For non-tennis amenities (Greens Pool) the duration chips were built from `singles_duration_minutes` / `doubles_duration_minutes` (60 / 90),
while the cap the server enforces (`enforce_amenity_booking_rules`, migration 20260922005928) and the client mirrored is
`max_duration_minutes` (default 60). Choosing 90 > cap made `limitReason()` return `'duration'`, and `computeSlots` turned that into
`state: 'limit'` for every row, which the sheet explained with the *daily* limit sentence. Nothing to do with timezone, existing
bookings or the daily count. Tennis (fixed length by play type) was not affected; other non-tennis amenities with the same config were.

Fix: `src/lib/bookingDurations.ts` (pure) — offered durations = configured lengths ≤ the server cap (fallback: the cap itself); stale overrides
fall back to an allowed length; nothing hard-codes 60/90. Server enforcement is unchanged and already rejects over-cap durations.

## 3. Actual permitted durations (Greens Pool, The Greens Court)
**Not verified** — no hosted reads were made. From the symptom, Greens Pool has `max_duration_minutes` = 60 (or null → default 60) with
`doubles_duration_minutes` = 90. After the fix it shows a single informational "60 min reservations" label. If the HOA wants 90, an admin raises
"max duration" in Manage Amenities; the picker will then offer 60 and 90. The Greens Court is tennis: 60 singles / 90 doubles from its rules.

## 4. Duration selection / reason labels
- One allowed duration → compact label, not a button. Several → chips.
- `'limit'` now means only the resident's daily booking count (pending bookings count). The pill reads "Daily limit". When every offered time is
  daily-limited the wheel is replaced by one date-level message. A duration over the cap yields no rows (defensive).
- Daily reserved-minutes limits are **not supported** by the schema/trigger, so not modelled. Buffers/weekly caps unchanged (not enforced).

## 5. Wheel edge layout
The blank space was the scroller's `(height − row)/2` padding. It is now filled with inert **ghost rows** (hairline bars: no time, no weather,
`pointerEvents="none"`, hidden from accessibility, indexes outside the slot range) that roll with the same drum transform, so real rows stay
exactly where they were (`ghostLayout` keeps count·44 + remainder = original padding). No off-hours times are invented. Fades shortened
(≤1.5 rows, 0.7 alpha) and the opacity ramp raised (row 3 away: 0.3 → 0.42) so selectable rows are not near-invisible. Contours/band/haptics/sound untouched.

## 6. Legend root cause
`ReservationLegend` (the component `courts.tsx` renders for both the picker and View Schedule) had **never** been changed to dots: the earlier
"semantic colors/legend" commit introduced the outlined-square lucide-icon swatches and a test asserted them. Not a stale bundle or a duplicate
component. It now renders six solid 10px dots (mint, blue, gray, coral, blue, amber) beside one-word labels; full descriptions remain as accessibility labels.
The wheel rows still carry word pills (Reserved/Blocked/Yours/Pending/Daily limit), so state is not colour-only.

## 7–8. Reservation detail
- Hero card: name + status pill + one line (`detailSummary`). Pending → "Awaiting HOA approval. Your time is held until reviewed or the reservation starts." only when
  `get_amenity_busy_times` answers (the exclusive-hold migration is live); otherwise "…Your reservation is not confirmed yet."
- One cancellation message (`cancellationLine`): available → button + "Cancel before Nov 5 at 9:00 AM." (HOA zone, HOA `min_cancellation_hours`);
  closed → "Cancellation closed · Less than N hours before start."; started → its own wording; completed/expired/rejected/cancelled → none.
  `cancellationState` and the business rule are untouched.

## 9. Community Pulse regression — **found and fixed**
The neon-green "MAINTENANCE NOTICE" card (from `court_maintenance`) was still on Home. Removed (render, state, fetch, styles). Home keeps exactly one
Pulse announcement (`pickPulseAnnouncement`), no maintenance_reports access. Unread count not touched (no reliable per-resident read tracking).
Dependency: the maintenance/service announcement category needs the written-but-unapplied migration from commit d4baba9.

## 10. Tests
`npx playwright test -c playwright.logic.config.ts` → 629 passed (new `tests/expo-acceptance-logic.spec.ts`; three stale source-regex tests
updated: `workstream-b` ×2 for the moved duration/pad code, `workstream-c` ×2 for the removed maintenance state). `npx expo export --platform ios` succeeds.
`tsc` shows no errors in touched files (repo has unrelated pre-existing errors). Automated tests do not prove the iPhone appearance.

## 11. Codex findings
Independent Codex inspection (codex-cli 0.162.1, gpt-6.1-sol, read-only, fresh session; base 5ff92cb). Static review only.
Run 1 returned APPROVED with no findings but was recorded as failed ("code changed during inspection" - the tree was still being edited).
Run 2: REVISE, one medium finding **R-001**: the cancellation deadline omitted the HOA time zone, so a resident whose phone is in another zone could read
"9:00 AM" as local time. Fixed: the zone name is appended whenever the device zone differs (test added). The fix itself has not had a further Codex pass.

## 12. Migrations
None new. Still unapplied from earlier sprints: exclusive pending holds / `get_amenity_busy_times` (20261031110000) and the announcements
category migration (d4baba9). Without them the app shows the honest fallbacks above.

## 13. Verify on the iPhone (Expo Go)
1. Greens Pool: one "60 min reservations" label (or 60/90 chips if max duration is 90); times are "Select", not "Limit".
2. Open on the first time of the day and scroll to the last: no blank half; faint ghost bars continue the drum.
3. Legend: six solid dots, no squares.
4. Pending reservation detail: short line, then dates, one cancellation line.
5. Home: no green Maintenance Notice; one Pulse item.
6. If the old legend appears, fully close Expo Go and restart with `npx expo start -c`.

## 14. Commits
See `git log` (first commit `4655621`). Git status at completion: only `.claude/settings.local.json` modified (pre-existing).
