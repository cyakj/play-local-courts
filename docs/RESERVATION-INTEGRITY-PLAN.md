# Final reservation integrity, HOA timezones, query correctness and migration readiness - plan (2026-10-31)

Branch `v1/overnight-integration`. Local commits only. No push, no deploy, no migration applied to TENISX REAL, no hosted write. Hosted is READ only (migration list). SQL is rehearsed ONLY on the scratch Postgres 17 restore of the 2026-10-29 backup (`restore_test`, port 55432).

## Verified facts (repo + restore of the 10-29 backup + hosted migration list)
- `bookings` statuses (CHECK): confirmed, cancelled, pending, rejected. The only overlap protection is `bookings_no_overlapping_confirmed` = `EXCLUDE USING gist (court_id =, tsrange(date+start_time, date+end_time,'[)') &&) WHERE status='confirmed'`. A pending booking holds nothing in the database.
- **RLS lets a resident read ONLY their own bookings** ("Users can view their own bookings" `auth.uid()=user_id`; admins read their HOA). No policy or RPC exposes other residents' bookings, so the Reserve screen's "everyone's bookings for this date" query returns only the caller's rows: other residents' reservations have never been visible in the picker (the 23P01 conflict message was the only guard). A new SECURITY DEFINER read function is required for the first-come-first-served UX.
- Entry points that INSERT bookings: `courts.tsx` and `amenity-book.tsx` (Resident app) only. Admins have no INSERT policy (UPDATE only), so an HOA Manager cannot create a reservation for a resident; no admin override exists. All paths go through `enforce_amenity_booking_rules` (BEFORE INSERT OR UPDATE).
- Existing correct behaviour to preserve: daily cap counts confirmed + pending of the user/court/date; status transition guard (`enforce_booking_status_transitions`: admin pending->confirmed|rejected|cancelled, confirmed->cancelled; resident -> cancelled only); cancellation window (`enforce_booking_cancellation_window`, hard-coded America/Puerto_Rico); maintenance blockout conflicts.
- `hoas` has no timezone column. Restore data: 3 communities, all in Dorado, Puerto Rico (The Greens, DBE, The Fairways). Bookings in restore: 17 confirmed, 1 pending, 29 cancelled. `pg_cron`/`pg_net` are not installed on the scratch server; hosted availability of pg_cron must be checked at deployment.
- Hard-coded Puerto Rico: DB: cancellation-window trigger, `current_date` advance-booking check (UTC date, a latent defect), blockout "today" function (20261013110000). App: `COMMUNITY_TIME_ZONE`, `CALENDAR_TIME_ZONE`, `AmenityScheduleSheet`, weather hooks.
- Home query (original, before round 2): resident's own bookings (`user_id=me`, `courts!inner.hoa_id = active`), statuses confirmed+pending, `date >= UTC today`, ordered date/start asc, `limit(1)`, no end test. After round 2: from yesterday, `limit 50` then `200`, filtered client-side. The limit is a RETRIEVAL limit on the resident's own rows, not a booking or rate limit.

## Final product rules (user decisions)
1. FCFS: a valid **pending** request holds its time exclusively, same as confirmed. Approve = the same row becomes confirmed (same interval). Reject / cancel / expire releases the hold.
2. Every reservation is in the **HOA's** IANA timezone, never the device's.

## Design
### M1 `20261031100000_hoa_timezones.sql` (additive)
- `hoas.timezone text NULL` + validation trigger (`now() AT TIME ZONE tz` must succeed and the name must exist in `pg_timezone_names`).
- Backfill ONLY by evidence: address matches `Puerto Rico` / `, PR` / `Dorado` (the three known rows) -> `America/Puerto_Rico`; any other community stays NULL. Never overwritten if already set. The migration prints which rows were set/left NULL.
- `public.hoa_timezone_for_court(court uuid)`, `public.hoa_local_now(court uuid)` helpers (STABLE).
- `public.set_hoa_timezone(hoa uuid, tz text)` SECURITY DEFINER: only an HOA admin of that HOA or a platform reviewer; validates tz; audit via updated_at. Granted to authenticated, revoked from anon/public.
- Replace `enforce_booking_cancellation_window` (use the HOA tz via court->hoa) and the advance-booking window check (HOA-local date instead of UTC `current_date`). NULL timezone => the booking INSERT is refused with "This community's time zone is not set" (never a silent assumption); cancellation of an existing booking in a NULL-tz community falls back to refusing nothing new (cancel stays allowed).
- DST: all comparisons use `AT TIME ZONE` on timestamps built as local `date + time`; a nonexistent local time (spring gap) is normalised by Postgres forward; a repeated hour (fall back) resolves to the first occurrence. Reservations are stored as local wall-clock date+time (unchanged), so no stored instant moves.

### M2 `20261031110000_exclusive_pending_reservations.sql`
- **Pre-flight (aborts, never alters data):** raises if any two rows with status pending/confirmed overlap on the same court (shows counts only). A separate read-only conflict-detection query is shipped in the deployment plan.
- Add status `expired` to `bookings_status_check` (a pending request that was never approved before its start). Not user-settable (transition guard).
- Replace the exclusion constraint: `bookings_no_overlapping_active` EXCLUDE ... WHERE `status IN ('pending','confirmed')`; drop `bookings_no_overlapping_confirmed` in the same transaction. Exclusion constraints serialize concurrent inserts: of two simultaneous requests one commits and the other fails 23P01, atomically.
- **Expiry rule (V1):** a pending request expires at its start time in the HOA's timezone (no earlier documented deadline exists: none found in migrations/docs). Enforcement without relying on a timer:
  1. `expire_pending_bookings()` SECURITY DEFINER, idempotent: `UPDATE ... SET status='expired'` for pending rows whose local start <= HOA-local now; granted to the backend (privileged API) role only.
  2. BEFORE INSERT trigger on bookings runs the same sweep for the NEW row's court first, so an expired-but-unswept row can never block a new request.
  3. The transition guard refuses `pending -> confirmed` when the local start has passed (the admin sees "this request has expired").
  4. The busy-times function ignores pending rows whose start has passed.
  5. Optional tidy-up job (pg_cron, every 5 minutes calling `expire_pending_bookings()`; only if the extension is enabled by the owner). Correctness does NOT depend on it. Deployment SQL provided in the plan; not auto-created.
- Released holds: rejected / cancelled / expired are not in the exclusion WHERE.
- Approve vs concurrent booking: approval changes only status within the same constraint; the rows are locked by the UPDATE, a competing INSERT waits and then succeeds or fails on the constraint. No window where both pass.
- **`public.get_amenity_busy_times(p_court_ids uuid[], p_date date)`** SECURITY DEFINER STABLE: caller must be an approved member (or admin) of each court's HOA; returns `court_id, start_time, end_time, status, is_mine` for pending/confirmed non-expired rows; never returns user ids. Granted to authenticated only.
- Admin-created bookings: not supported and not added. If added later they must go through the same triggers (all constraints are table-level, so they would).

### App
- `reservationState`: pending expires at START (was end): `request_expired` once start <= now; pending never "In progress". New status `expired` maps to `request_expired`. Time zone is always an explicit parameter taken from the community.
- `useActiveCommunity` loads `hoas.timezone` tolerantly (separate query, like `avatar_path`): column missing (pre-migration) => documented legacy fallback America/Puerto_Rico; column present and NULL => `timeZone = null` => reservation actions disabled with a clear message.
- Thread the community timezone through Home, Reserve (court list, picker, schedule, revalidation), My Reservations, Reservation detail, cancellation rules, `relativeDay`, and the admin pending-requests / schedule / manage-amenities screens. Show "All times shown in <zone name>" in the picker/schedule when the device zone differs from the HOA zone.
- Availability for the picker/schedule/court status comes from `get_amenity_busy_times` (pending + confirmed, others' times gray, mine blue/amber), eliminating the "pending shown but not enforced" inconsistency. If the RPC is missing (pre-migration), the screen falls back to own-bookings only and shows "other reservations may not be shown" (honest degraded mode), never "all free".
- Booking conflict message (23P01): "That time was just taken by another reservation. Pick another time." (exists; verify it is shown for both pending and confirmed holders).
- Home query: server-side filter for CURRENT rows (`and(status.eq.confirmed, date.gt.D | date.eq.D & end_time.gt.T)` or `and(status.eq.pending, date.gt.D | date.eq.D & start_time.gt.T)`), ordered by date/start, `limit(5)`; client re-validates with `selectCurrentReservations`. Own bookings on Reserve use the same filter and keyset pages. My Reservations: server-side pagination (`range`) with "Load more" for history; Upcoming loaded by the same current-filter, complete. HOA Manager lists: page until exhausted (no silent cap) and show counts.
- Tests: >200-row fixtures through the pure filter builder and a mocked-browser Home/My Reservations, DB scenarios (below), zone scenarios (resident NY booking California HOA, California resident booking PR HOA, DST gap/overlap).

### Database verification (scratch restore only)
`supabase/tests/reservation_integrity.sql` + rehearsal script run on a copy of `restore_test`: two overlapping pending inserts (second fails 23P01), partial overlap, different durations, pending vs confirmed overlap, approve keeps interval, reject/cancel/expire free the slot, approve-after-start refused, concurrent inserts via two psql sessions, daily cap unchanged, NULL-timezone refusal, DST dates, conflict pre-flight aborting on seeded overlapping rows without modifying them, idempotent re-apply, mutation check (without the constraint swap the assertions fail).

### Tests repair
- `courts.spec:137` (month-boundary: clicks day number of tomorrow in the current month): compute the target cell from the calendar's own month/disabled state.
- `courts.spec:449` (tab bar not visible after report back): determine from the page whether the Report screen has no tab bar; fix the test navigation or the app, whichever is wrong.
- `reservations-ui:37` (asserts a blocked-cancellation text via `toContainText` on the element whose visible text is the short chip while the long text is in aria-label): fix the assertion to match the short chip plus the aria-label contract.

### Migration plan
New staged order (documented in `docs/MIGRATION-PLAN-2026-10-31.md`): existing A, B, C, D (profile photos) unchanged; new Stage E (timezones, M1), Stage F (exclusive pending + busy-times RPC, M2, after the conflict query returns zero), Stage G (profiles read-gap, recommended, separate migration to be written/rehearsed). Conflict-detection queries, fresh backup + restore verification steps, and which results rely on the 10-29 backup are listed.

## Non-goals
No admin override bookings, no payments, no Stage 2 changes, no hosted writes, no cron enablement on hosted, no profile read-gap migration unless time allows (documented as Stage G otherwise).

## Revision 1 - Codex plan review dispositions (RI-01..05, all accepted)
- **RI-01 trusted expiry path.** `expire_pending_bookings()` (and the insert-time sweep, which calls it) set a transaction-local flag `app.booking_expiry='on'` before the UPDATE. `enforce_booking_status_transitions` accepts `pending -> expired` ONLY when that flag is on AND the booking's local start has passed; any client transition to `expired` (resident or admin) is still refused with 42501. Verified in the DB test while authenticated as a different resident (the sweep succeeds; a direct `UPDATE ... SET status='expired'` by a resident or admin fails).
- **RI-02 DST policy (replaces the earlier "Postgres resolves it" text).** ONE policy, enforced in the database and mirrored in the app: a reservation whose start or end local time does not exist (spring-forward gap) or occurs twice (fall-back hour), or whose interval spans a UTC-offset change, is REFUSED at creation ("daylight saving time: choose another time"). Therefore every stored reservation maps to exactly one instant and wall-clock comparison (`date+start_time <= HOA local now`) is consistent in SQL and in `reservationState`. The picker hides such starts. Expiry compares wall-clock local start with HOA-local now; there is no normalised-time case left to mis-expire. The earlier sentence about AT TIME ZONE resolving a repeated hour to its first occurrence is withdrawn.
- **RI-03 daily cap.** `get_amenity_busy_times` returns, for the CALLER's own rows, every pending/confirmed row of that court/date including ended ones (`is_mine=true`, `counts_toward_cap=true`), and for other residents only non-expired, non-ended rows. The picker keeps `ownForCap` from those rows, so the cap behaviour from round 2 is preserved.
- **RI-04 blockout.** `admin_create_blockout()` is replaced in M1 (derives "today" from the court's HOA zone after authorization; NULL zone raises via the strict helper). Done in the migration.
- **RI-05 copy.** `statusDisplay`/`kindDescription` pending text now says the time is HELD while awaiting approval, not confirmed, released on rejection, cancellation or when the start time passes. Booking-sheet notice and any other pending copy updated; a test forbids "not held".
