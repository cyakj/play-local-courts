-- Greens V1: prevent overlapping confirmed bookings on the same court at the
-- database level. Client-side slot-greying only reflects a stale snapshot
-- fetched before render and is not re-checked at insert time, so two
-- concurrent overlapping INSERTs for the same court currently both succeed.
--
-- bookings schema (as verified live against project hqqlrliakttqsbalvuyz):
--   court_id   uuid not null references courts(id)
--   date       date not null
--   start_time time without time zone not null
--   end_time   time without time zone not null
--   status     text check (status in ('confirmed','cancelled')) default 'confirmed'
--
-- There is no single start/end timestamp column, so the range expression is
-- built from date + start_time / date + end_time. A half-open range ('[)')
-- is used so back-to-back bookings (end of A == start of B) are NOT treated
-- as overlapping and remain allowed. Only 'confirmed' bookings participate —
-- 'cancelled' rows are excluded entirely via the WHERE clause, so cancelling
-- a booking always frees the slot for a new confirmed booking to reuse.
--
-- Verified pre-apply against live data: 16 total rows (15 confirmed, 1
-- cancelled), zero rows with end_time <= start_time, and zero overlapping
-- pairs among confirmed bookings on the same (court_id, date) — so this
-- constraint applies cleanly with no pre-existing violations.
alter table public.bookings
  add constraint bookings_no_overlapping_confirmed
  exclude using gist (
    court_id with =,
    tsrange((date + start_time), (date + end_time), '[)') with &&
  )
  where (status = 'confirmed');
