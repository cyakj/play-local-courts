# Resident acceptance round 2 - report (2026-10-31)

Branch `v1/overnight-integration`. Local commits only. Nothing pushed, deployed or applied; TENISX REAL was only READ (migration list). No backups or scratch data touched.

## 1. Issues
| # | Issue | Result |
|---|---|---|
| 1 | Past reservation shown as Upcoming | **Fixed + verified** (logic + mocked browser) |
| 2 | Past reservation shown as "My Reservation" | **Fixed + verified** (court card, picker, schedule) |
| 3 | Pending approval shown as confirmed | **Fixed + verified** (Home, court card, picker, schedule, My Reservations, detail, booking button/notice) |
| 4 | Semantic colours + legend | **Fixed + verified** (shared `ReservationLegend`, tokens in `design.ts`) |
| 5 | Profile photo upload | **Code audited, one fix; end-to-end BLOCKED until migration `20261030120000`** |
| 6 | Redundant Account Settings in avatar menu | **Fixed + verified** |
| 7 | Back button | **Fixed + verified** (labelled pill, >= 44pt) |
| 8 | Consistency audit | **Done** (see section 2); stale-data refresh added |

## 2. Root causes
- Home: `new Date().toISOString()` (a UTC date) with `.gte('date')`, `limit(1)` and no end-time test, computed once per load -> a booking dated today stayed "upcoming" all day.
- Court list: "my booking" = any booking dated today; `now` frozen at mount; court status and "is today" used the phone clock; pending vs confirmed not even selected.
- My Reservations classified correctly but with a `now` frozen at the last load; `relativeDay` used the phone's calendar.
- Picker/schedule had one dimension (owner). The daily-cap rule needed ownership regardless of time.
- Nothing refreshed on focus/resume/over time, so an administrator's approval needed a re-login to show.

## 3. Exact status and timezone rules (`src/lib/reservationState.ts`)
- Stored status (unchanged, no new DB value): `pending`, `confirmed`, `rejected`, `cancelled`.
- Derived from the community clock (`America/Puerto_Rico`, the single documented zone; HOAs have no timezone column; all functions accept an explicit `timeZone`):
  - `confirmed` before start -> **Confirmed**; start <= now < end -> **In progress**; now >= end -> **Completed**.
  - `pending` before end -> **Pending approval**; now >= end -> **Request expired** (history only).
  - `rejected` -> **Declined**; `cancelled` -> **Cancelled**. Never current.
- "Current" (shown as Upcoming, as mine in a picker, counted) = pending or confirmed AND end > now. End is the END timestamp; a row with end <= start (not producible by the schema) ends next day; `24:00` works.
- Pending does not hold the slot in the database (exclusion constraint covers `confirmed` only) but counts toward the daily cap. The app keeps showing others' pending as unavailable (conservative) and says the time is not held for the requester.
- Daily cap: all of the resident's own pending/confirmed bookings of the day count, ended or not (matches the server trigger).
- Refresh: ticking clock every 30 s + on focus + app resume; data refetch every 60 s, on focus and on resume (Home, Reserve, My Reservations, Reservation detail).
- Queries: bookings are loaded from yesterday (community date) with limit 50 and the ended ones dropped client-side; Reserve scopes to the active community before limiting.

## 4. Colour and legend mapping
| State | Colour | Icon + text |
|---|---|---|
| Available | mint `#2FD98B` (soft tint) | dot - "Available" |
| Reserved by someone else | gray `#7A839A` | person - "Reserved by someone else" |
| Blocked / maintenance | coral `#FF5C6B` | lock - "Blocked by management" |
| My confirmed | blue `#2D6BFF` | check - "My reservation" / "My confirmed reservation" |
| My pending | amber `#F5B63D` | clock - "My request - pending approval" |
| Selected slot | solid blue | "Selected" (picker legend) |
| Past / completed | muted `#5A6379` | history - "Completed / passed" (schedule legend) |
Badges use per-theme text colours (light and dark) chosen for >= 4.5:1. Hours outside the amenity's operating hours are not drawn at all; the legend adds "Open for booking X - Y. Times outside these hours are not offered." so they are not mistaken for "blocked".

## 5. Answers
- **Is the Oct 31 bug resolved?** Yes in code and tests: an 11:00-12:00 booking at 19:00 PR is Completed, absent from Home Upcoming, not "My Reservation" on the court list, a muted "COMPLETED" row in View Schedule, and in History. Verified with logic tests and a mocked-browser test that generates the same situation relative to the real clock. Not verified against your real hosted booking in a browser.
- **Pending represented correctly everywhere?** Everywhere that renders a reservation status now reads from the single badge table. Notifications text was not reworded (it describes events, not state). Admin screen `manage-amenities` uses the same pill (stored status only).

## 6. Profile photos
See `docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md`. Blocked until `20261030120000` is applied (hosted list read-only: not applied). It has no dependency on the other pending migrations. Not tested against a live Storage service (none available locally).

## 7. Tests
- Logic suite: **521 passed, 0 failed** (was 496; +25).
- New mocked-browser specs: 8 passed. Targeted browser run (reservation, slots, booking flow, corrections, responsive audit, home, navigation, account switch, help): everything passed except 3 tests, all pre-existing: `courts.spec:449` and `reservations-ui:37` fail identically on the base commit (verified by checking out the old `src`); `courts.spec:137` clicks "day 1 of the current month" and breaks on month boundaries. Two older tests asserting the old labels were updated intentionally (`Booked` legend, `Yours` legend).
- The full 1,000+ test browser suite was not completed (it was started, then the code changed under it).
- `eslint` is not installed in this checkout (`@eslint/js` missing, pre-existing), so lint was not run. TypeScript: no errors in touched files; the repo's pre-existing casing errors remain.
- Codex: plan review (4 findings, all accepted); fresh code inspection round 1 (5 findings, all fixed); round 2 outcome in section 8.

## 8. Codex outcomes
See the end of this file (appended after round 2).

## 9. Screens to verify in your browser
1. Home: no card for a finished booking; a pending request reads "Pending approval" in amber; in progress reads "In progress".
2. Reserve: court cards show "My pending request" (amber) or "My confirmed reservation" (blue) only for bookings not over; open a court -> legend; a 90-minute booking = 3 rows; pending rows say "Pending".
3. View Schedule: today shows finished bookings muted ("COMPLETED"), pending amber, blocked coral with a lock; legend at the bottom with operating hours.
4. An approval-required amenity: button says "Request Reservation" and a notice says it is not confirmed until approved.
5. My Reservations / a reservation: badges, and have the HOA Manager approve a pending one: it should flip within ~1 minute or when you return to the screen.
6. Avatar menu: no Account Settings; Sign Out works; Switch Community / Role only if you have more than one.
7. Back button on Notifications / Report / My Reservations: "Back" label at 390 px, arrow only at 320 px.
8. After migrations only: profile photo add / replace / remove.

## 10. Migration plan
No change. The plan's addendum (2026-10-31) already lists `20261030120000` for profile photos; nothing new is required by this round's code. Recommendation (not done): a per-community `timezone` column on `hoas` would remove the single-zone assumption; it needs its own migration and rehearsal.

## Codex outcomes (appendix)
- Plan review: 4 findings (daily cap vs ownership, query truncation, detail-screen refresh, community-calendar relative day) - all accepted and built. The revised plan was not re-reviewed; both code inspections therefore ran as "unreviewed-spec" inspections.
- Code inspection round 1: 5 findings (wheel ignored pending styling; in-progress booking split into past/future rows; stale loader on focus after a community switch; slot list not re-derived with the clock and past dates selectable; no refetch on focus) - all fixed.
- Code inspection round 2: 3 findings (open future-date sheets kept stale pending rows after an administrator action; own-bookings count truncated at 50; an old legend assertion) - all fixed after the round (re-fetch of the open sheet date on refresh; own bookings paged to completion; Home limit 200; test updated). **These last fixes were not re-inspected by Codex** (inspection budget of 2 used).
- Final local gate: logic 522 passed; 19 targeted browser tests passed (new status specs, slots, booking flow, legend). iOS export succeeded. `expo install --check` now reports three patch updates available (expo, expo-router, @expo/ui) - unrelated to this work, not applied.
