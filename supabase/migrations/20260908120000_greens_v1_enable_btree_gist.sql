-- Greens V1: enable btree_gist so a GiST exclusion constraint can use
-- equality comparison (=) on non-range types (e.g. uuid court_id)
-- alongside a range overlap (&&) operator in the same index.
-- Prerequisite for 20260908120100_greens_v1_prevent_double_booking.sql.
create extension if not exists btree_gist with schema extensions;
