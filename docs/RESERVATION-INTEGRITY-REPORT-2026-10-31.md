# Reservation integrity, HOA time zones, query correctness, migration readiness - report (2026-10-31)

Branch `v1/overnight-integration`. Local commits only. Nothing pushed, deployed or applied; TENISX REAL was only READ (migration list, earlier in the session).
Plan: `docs/RESERVATION-INTEGRITY-PLAN.md`. Deployment: `docs/MIGRATION-PLAN-2026-10-31.md`. Profile photos: `docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md`.

## 1-2. What changed
**Code:** busy-times availability for the Reserve picker (other residents' pending/confirmed holds are finally visible); HOA-zone times everywhere a reservation
is shown (Home, Reserve, My Reservations, detail, cancel rules, manager pending list, amenity schedule sheet, manage-amenities); "Pending approval" copy now says the time
is HELD; pending expires at START; server-side "current reservations" filter for Home / My Reservations / Reserve; server-paged History; DST-invalid times hidden in the picker;
the second booking screen (`amenity-book`) now forwards to Reserve; zone label "All times shown in Pacific Time" when the phone's zone differs; honest degraded mode when the server lacks the new function.
**Migrations (written, rehearsed on a scratch restore, NOT applied):** `20261031100000_hoa_timezones.sql` (M1) and `20261031110000_exclusive_pending_reservations.sql` (M2); rollbacks in `supabase/rollbacks/`.

## 3. The exact first-come-first-served rules
- A request on an approval-required amenity is stored `pending` and HOLDS its interval exactly like a confirmed reservation (`EXCLUDE ... WHERE status IN ('pending','confirmed')`, half-open `[start,end)`; back-to-back is allowed).
- Overlap in any way (partial, contained, enclosing, different duration, identical) on the same amenity fails with 23P01 -> "That time was just taken by another reservation or pending request."
- Atomic: the constraint serialises concurrent inserts (tested with real parallel sessions: exactly one wins). Approval racing a competitor: approved row keeps its interval, competitor refused. Rejection racing a competitor: competitor waits, then succeeds.
- Approval changes only the status, never the time (an approval that also changes court/date/time is refused). Reject / cancel / expire release the hold.
- Daily cap unchanged (pending + confirmed of the resident/amenity/day, ended confirmed ones included) and now race-proof: concurrent non-overlapping requests by one resident take an advisory lock, so only one commits (proven by a mutation: without the lock two rows commit).
- Administrators cannot create bookings for residents (no INSERT policy; nothing added). The only INSERT paths are the Reserve screen and the retired `amenity-book` screen (now a redirect); every path is covered by table-level constraints/triggers.

## 4. Pending-request expiry
A pending request expires at its **start time in the HOA's zone** (no earlier deadline exists anywhere in the schema, rules or docs). Enforced in the database without a timer:
(1) a BEFORE INSERT trigger sweeps expired pending rows of that amenity first, running as the inserting resident through a narrow trusted path (a transaction-local flag accepted only for pending rows whose local start has passed; a resident or admin setting `expired` by hand gets 42501);
(2) the transition guard refuses approving a started request ("This request has expired");
(3) busy-times ignores expired rows and an unswept expired request stops counting toward the daily cap.
`expire_pending_bookings()` is idempotent and callable only by the backend role. A scheduled job is OPTIONAL (tidies stored statuses); SQL for pg_cron is in the migration plan, hosted pg_cron was not checked and enabling it needs your approval. New stored status `expired` (shown "Request expired").

## 5. HOA time zones
`hoas.timezone` (IANA, validated by trigger). Backfill by address evidence only (Puerto Rico / PR / Dorado); anything else stays NULL and **refuses new reservations** with a plain message - never silently Puerto Rico. Setting/correcting: `select set_hoa_timezone(hoa, 'America/Los_Angeles')` (that HOA's admin or TenisX staff).
The database uses the zone for the cancellation window (measured between real instants), the advance-booking window, blockout "today", expiry and busy times. The app reads it tolerantly: a server WITHOUT the column (today's hosted) falls back to Puerto Rico; any other read failure blocks reservation actions with "could not be loaded"; a NULL zone blocks them with "not set".
DST policy (one rule, SQL and app): a reservation whose start/end local time does not exist, repeats, or spans an offset change (30- and 60-minute shifts) is refused and hidden in the picker, so every stored reservation maps to one instant. Tested: New York spring-forward/fall-back, Lord Howe 30-minute shift, a New York resident vs a California HOA, a California resident vs a Puerto Rico HOA, phone zone switched to Tokyo/Auckland/Anchorage.
**Still on the Puerto Rico default (documented, not done):** the HOA Manager portfolio screens `(cm)/alerts`, `(cm)/calendar`, `(cm)/index`, `(cm)/community/[hoaId]` and `adminCalendar`. Notifications/reminder emails (edge functions) were not changed.

## 6. The original 200-record Home query
Original (before round 2): the resident's OWN bookings (`user_id = me`) in the active community, statuses confirmed + pending, `date >= UTC today`, ordered date/start ascending, **`limit(1)`**, no end-time test, never refreshed. That limit-1 plus the missing end test was the real defect: an ended 11:00-12:00 booking was returned first and shown as upcoming. The "200" appeared only in my round-2 version (`limit 200` retrieval cap on the resident's own rows from yesterday); it was never a booking or rate limit and could not realistically truncate (a resident has at most one booking per amenity per day), but it was still wrong in principle.
Now: the server returns only CURRENT rows (confirmed not over / pending not started, in the HOA zone) soonest first, `limit(5)`; My Reservations loads Upcoming to completion (paged) and History in server-side pages with "Load older" (history is the exact complement of current); the manager pending list and manage-amenities page to exhaustion. Tested with a 900+ row dataset (600 historical, 300 other residents, 80 future): the next booking is found on the first page, identical to full client classification; the old logic is shown to return the ended booking.

## 7. Tests
- Logic: **550 passed, 0 failed** (was 522).
- DB (scratch restore of the 10-29 backup): `reservation_integrity.sql` **37/37**, 4 real parallel-session races, pre-flight abort leaves data untouched, mutation checks detect removal of the constraint and of the cap lock, idempotent re-apply, **full chain** (the 10 earlier migrations + M1 + M2) applies, new functions not executable by anon, rollbacks verified apply -> rollback -> re-apply.
- Browser (Chromium, full suite, source untouched during the run): **1007 passed, 24 failed, 26 skipped, 1 did not run.** Serial re-run of the failing files: 3 passed (flaky under parallel load: `calendar:61`, the Back-label spec, `slots-mocked:43`). 20 still fail and **fail identically on the previous commit's source** (16 `book.spec.ts` - the hidden Book screen renders no amenity cards, `blockout-enforcement:149`, `community-branding:22`, 2 `edit-profile-location`): pre-existing, not investigated further, not caused by this work. One e2e spec (`e2e/messaging`) failed in the parallel run and was not re-run (it is not part of this work). The three failures you listed are repaired: `courts.spec` date-picker (month-boundary brittle test), `courts.spec` Report back (outdated: /report has no tab bar), `reservations-ui:37` (outdated assertion about chip vs aria-label).
- iOS export succeeded. `expo-doctor`/`expo install --check` show three pre-existing patch updates available (unchanged). ESLint is not installed in this checkout (pre-existing), so lint did not run; `tsc` shows only the pre-existing errors.
- Not tested: real Supabase Storage uploads, pg_cron, hosted data, a physical device.

## 8. Independent Codex review
Plan review: 2 rounds, 8 findings (expiry authorisation, DST policy, daily cap preservation, blockout zone, stale "not held" copy, 30-minute DST shifts, DST validation on moves, cancellation lead time between instants) - all accepted and built; the final plan revision was not re-reviewed.
Code inspections (fresh sessions, budget of 2 used): round 1 - 8 findings (the live second booking screen, expired pending counted toward the cap, late history response across accounts, DST starts offered, zone fallback on any error, manage-amenities, missing doc [a snapshot-timing artifact]) - fixed. Round 2 - 4 findings (history query included today's upcoming rows, concurrent daily-cap race, approval could move a booking, schedule sheet date before zone loaded) - fixed. **The round-2 fixes were NOT re-inspected by Codex.** Both inspections ran as "unreviewed-spec" (the plan never reached an APPROVED verdict).

## 9. Hosted data conflicts
Hosted could not be queried this round (the Supabase connector disconnected after the migration-history read). On the 10-29 backup: zero overlapping pending/confirmed bookings, one pending booking (2026-10-13, long past). The conflict queries to run on hosted before Stage F are in the migration plan (Gate 1). I changed no data anywhere.

## 10-12. Migration order, profile photos, GO/NO-GO
Order: A (4) -> B (2) -> C (3) -> D profile photos -> E timezones -> F exclusive pending -> G profiles read-gap (NOT written; needs your decision). See `docs/MIGRATION-PLAN-2026-10-31.md`.
Profile photos - your steps: fresh backup + restore verification; apply only Stage D (or ask me to); run its verification queries; test with a TEST resident (add, replace, remove, 6 MB file, PDF, second account cannot read); details in the checklist.
**GO/NO-GO: NO-GO for hosted today.** Missing: the fresh verified backup and rehearsal on it, hosted Gate-1 query results, your approval per stage, the Stage G decision, and checks of Storage/pg_cron on hosted. The code and migrations are otherwise ready to stage in order.

## Browser screens to verify next
Reserve (other resident's pending slot shows Reserved/gray; yours Pending/amber), approval-required amenity ("Request Reservation" + the held-time notice), conflict message, View Schedule, My Reservations (Load older), reservation detail, manager Pending Requests (expired ones disappear), amenity schedule sheet, avatar menu/Back label - and after Stage E, a non-Puerto-Rico community's "All times shown in ..." label.
