# Resident acceptance round 2 - implementation plan (2026-10-31)

Branch `v1/overnight-integration`. Local commits only. No push, no deploy, no migration applied, no hosted write, no TENISX REAL change.

## Verified facts (from the repo)
- Statuses in the schema: `pending`, `confirmed`, `rejected`, `cancelled` (CHECK in migration 20261012190000). "In progress" and "completed" are NOT stored; they are derived from time. No new DB status is invented.
- `bookings.date/start_time/end_time` are zone-less community wall-clock values. HOAs have no timezone column (only `coaches.timezone`). The documented community zone is the constant `COMMUNITY_TIME_ZONE = America/Puerto_Rico` (`src/lib/communityTime.ts`); the DB cancellation trigger uses the same zone. Rows satisfy end > start (no row crosses midnight); a defensive rule treats end <= start as ending the next day.
- A pending booking does NOT hold the slot in the database (exclusion constraint `bookings_no_overlapping_confirmed` is `WHERE status='confirmed'`), but pending + confirmed both count toward `max_reservations_per_day`. The app already draws other residents' pending requests as unavailable (conservative); that is kept, and the copy never claims the time is held for the requester.
- Root causes found:
  1. Resident Home (`src/app/(resident)/index.tsx`) loads `bookings` with `today = new Date().toISOString()` (UTC date), `.gte('date', today)`, `.limit(1)`, no end-time test, and the result is never re-evaluated as time passes. A booking that ended at 12:00 stays "upcoming" all evening; a UTC date shifts after 8 PM Puerto Rico.
  2. Court list (`courts.tsx`): `todayUserBooking` is "any booking dated today" (no time test) -> "MY RESERVATION" badge for an ended booking; `upcomingCount` is date-only; `computeCourtStatus` and `isToday`/`nowMins` use the DEVICE clock, not the community's. Pending vs confirmed is not selected, so ownership shows as one state.
  3. My Reservations splits upcoming/history with the end time (correct) but computes `now` once per data load, so it goes stale while open.
  4. Picker/schedule treat ownership as the only dimension (`isMine`); pending, past and confirmed are indistinguishable.

## Design
1. New pure module `src/lib/reservationState.ts` (single source of truth):
   - `deriveReservation({status,date,start_time,end_time}, now, timeZone?)` -> `{ status, phase: 'upcoming'|'in_progress'|'ended', kind }`.
   - `kind`: `confirmed` (upcoming) | `in_progress` (confirmed, start <= now < end) | `completed` (confirmed, ended) | `pending` (pending, not yet ended) | `request_expired` (pending, ended) | `rejected` | `cancelled`.
   - `isCurrentReservation` = status in (pending, confirmed) AND end > community now. Only current reservations appear in Upcoming, as "mine" in pickers/court cards, and count toward the Upcoming total.
   - `selectCurrentReservations(list, now)` sorted by start; `reservationBadge(kind)` -> label/tone/icon key used by every surface. Labels: "Confirmed", "In progress", "Pending approval", "Completed", "Request expired", "Declined", "Cancelled".
   - Time via `communityNowMs`/`wallClockMs` with an optional `timeZone` argument (default constant). No naive date-vs-UTC compare. `isUpcoming` in `reservations.ts` delegates here.
2. `src/hooks/useNow.ts`: ticking community clock (re-render every 30 s while mounted, immediately on AppState `active` and on screen focus). Home, Court list and My Reservations derive from raw rows + ticking `now`, never a mount-time snapshot. Those screens also re-fetch on focus, on app resume and every 60 s while mounted, so an approval/rejection by the HOA Manager appears without logout.
3. Home: query `status in (pending, confirmed)`, `date >= communityToday - 1 day`, limit 20, then pick the first CURRENT row. Card shows the status badge (Pending approval / Confirmed / In progress). No `toISOString()` date.
4. Court list: replace `todayUserBooking` by "current booking for this court today (community date)"; CourtCard shows MY RESERVATION (blue, check icon), PENDING APPROVAL (amber, clock icon) or IN PROGRESS; ended bookings never show it. `computeCourtStatus` uses community clock. `upcomingCount` counts current reservations only. The reservation sheet and schedule pass `status` through; `isToday`/`nowMins` use community time. The rules query adds `requires_admin_approval`; the primary button reads "Request Reservation" (not "Confirm Reservation") for approval-required amenities and the sheet explains "Needs administrator approval" - no "Confirmed" next to "Approval Required".
5. Slots (`slotAvailability.ts`): reservations carry `mineStatus`; a start inside the resident's own pending reservation yields `mine:true, pendingMine:true` (label "Pending"), confirmed -> "Yours". Ended reservations are not passed in as "mine". Behaviour of interval overlap/durations is unchanged.
6. Schedule rows (`scheduleRows.ts`): add type `mine_pending`; add `past` flag from a `{isPast,isToday,nowMins}` input: ended booked/mine rows are muted and labelled "COMPLETED"/"PAST" (history is kept, never deleted); open rows that have already passed are muted "PASSED" not "OPEN". Merging per booking preserved. Out-of-operating-hours time is not drawn; the legend states the hours.
7. Semantic colour system (`Availability` tokens in `design.ts`, one `ReservationLegend` component used by the picker and View Schedule; text + icon, never colour alone):
   - Available: mint `#2FD98B` (soft bg) + "Available".
   - Blocked/maintenance: coral `#FF5C6B` (soft bg) + Lock icon + "Blocked".
   - Reserved by someone else: neutral gray `#7A839A` + "Reserved".
   - My confirmed: blue `#2D6BFF` (soft bg) + Check icon + "My reservation".
   - My pending: amber `#F5B63D` (soft bg) + Clock icon + "Pending approval".
   - Selected available slot: solid blue fill + white label (already) + "Selected".
   - Past/completed: muted `#5A6379` fill, readable text `#7A839A`+, "Completed".
8. My Reservations / Reservation detail / Notifications: badges from `reservationBadge`; derived `completed` / `in_progress` / `request_expired` shown; cancel offered only for current pending/confirmed within the window (existing rule). Grep for contradictory copy ("Confirmed" with "Approval") and fix.
9. Account menu: remove the "Account Settings" row (and `goAccount`); keep identity, community, Switch Community (only if > 1 approved community), Switch Role (only if > 1 authorized shell, from backend roles), Sign Out. Bottom Me tab remains the account destination.
10. Back button: `BackButton` becomes a rounded pill with arrow + visible "Back" label, min 44x44 (kept 48 high); label hidden only when the window is < 340 px wide (icon-only chip, still 48x48). Header logo layout adjusted so neither logo is cropped at 320/390 px. Same component everywhere, same `router.back()` / safe fallback handlers.
11. Profile photos: code audit + fixes: narrow the "not enabled" message to `Bucket not found` only (today any "not found" is reported as unsupported backend), confirm the upload body is a correctly sliced ArrayBuffer (no larger backing buffer), and keep the honest error while the backend lacks the bucket. No faking. Deliver `docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md`; state that end-to-end upload stays BLOCKED until migration `20261030120000` is applied. Verify the migration SQL and policies on the scratch Postgres if reachable (read-only on hosted).

## Verification
- Node logic suite (`npx playwright test -c playwright.logic.config.ts`) with new `tests/reservation-state-logic.spec.ts`: before/during/after on 2026-10-31 11:00-12:00 at 19:00 PR; statuses; midnight (end 00:00 / 24:00 and end<=start); UTC date rollover at 20:00 PR; another zone (Asia/Tokyo, America/New_York DST); 90-minute booking = exactly 3 rows; pending never labelled confirmed; every transition (pending->confirmed, ->rejected, ->cancelled, confirmed->cancelled, confirmed->ended) for list/court-card/pickers.
- Tests that fail on the old code: Home selector with the old UTC logic, court-card with an ended booking, schedule row for an ended booking.
- Mocked-browser specs (Chromium): Home at simulated 19:00 with an 11:00-12:00 booking (no card -> empty state), pending shows "Pending approval" on Home/court card/schedule/sheet/My Reservations, legend text, account menu (no Account Settings, Sign Out works, switching hidden for single choice), back-button label and >= 44 hit area at 320/390, plus existing 175 browser tests and 496 logic tests stay green.
- `npx expo export --platform web`/iOS export, `expo-doctor`, `tsc` no new errors, `expo lint` on touched files.
- Codex: plan review (this document) then a fresh-session inspection of the final diff focused on status/timezone logic and security.

## Non-goals
No migrations, no hosted writes, no HOA Manager work, no per-HOA timezone column (reported as a recommendation), no Stage 2 changes.

## Revision 1 - Codex plan review dispositions (R2-01..04, all accepted)
- R2-01 Daily cap: ownership display and daily-cap accounting are separated. `limitReason` counts ALL persisted pending/confirmed bookings of the resident for the date (ended ones included), via a new `countsTowardDailyCap` flag on reservations; ended own bookings are not drawn as "mine" but still count, and submit-time revalidation uses the same list.
- R2-02 Query bounds: Home filters `date >= window start` and, instead of `limit(20)` over everything, fetches with `.gte('date', windowStart)` ordered ascending with a generous limit (50) AFTER the date filter (ended rows can only be today/yesterday, so at most a few) - current rows can no longer be hidden by old rows. Court list user-bookings query is scoped to the active community's courts before the limit, and the Upcoming count is computed from the same complete result (limit 50).
- R2-03 Reservation detail joins the ticking clock + focus/resume/60 s refresh; badge and description both derive from the same row + clock.
- R2-04 `relativeDay` takes the community calendar date (`communityToday(now)`); tested with a device in Asia/Tokyo at 20:30 PR on Oct 31 (device already Nov 1).
Not re-reviewed by Codex as a plan after this revision (time-boxed); the final diff gets a fresh Codex inspection.
