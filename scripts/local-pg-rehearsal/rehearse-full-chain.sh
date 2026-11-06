#!/usr/bin/env bash
# Applies the migrations that are PENDING on TENISX REAL (by name, not by version: the hosted history uses different timestamps)
# to a disposable copy of a restore of a verified backup, each in its own transaction, then re-applies each one (idempotency).
# Never connects to Supabase. Output: one line per migration, no row contents.
# usage (repo root): bash scripts/local-pg-rehearsal/rehearse-full-chain.sh <port> <rehearsal-db> <restored-source-db> <order: file|plan>
#   order=file : ascending file-name order.  order=plan : D first, then G, A, B, C, E, F, H, then the two newest (the documented deploy order).
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"
SRC="${3:-}"; ORDER="${4:-file}"
[[ "$SRC" =~ ^restore[a-z0-9_]{0,40}$ ]] || { echo "source database name must match ^restore[a-z0-9_]{0,40}\$" >&2; exit 2; }
M=supabase/migrations
FILE_ORDER=(
  20261013100100_admin_reports_scrub_legacy_admin_notes
  20261013130000_revoke_anon_execute_on_admin_rpcs
  20261022120000_resident_join_flow_hardening
  20261023100000_admin_booking_review_notifications
  20261023110000_hoa_application_hardening
  20261023120000_community_interest_requests
  20261023130000_report_photo_attach
  20261023140000_lock_down_anon_definer_rpcs_and_email_prefs
  20261030120000_profile_photos_private_bucket
  20261030130000_report_insert_requires_membership
  20261030140000_report_photos_bucket_hardened
  20261031100000_hoa_timezones
  20261031110000_exclusive_pending_reservations
  20261031120000_profiles_member_read_gap
  20261101100000_announcement_urgency_and_category
  20261106100000_amenity_allowed_durations
  20261106110000_hoa_event_audience
  20261106120000_announcement_archive
  20261106130000_amenity_rules_hoa_integrity
)
PLAN_ORDER=(
  20261030120000_profile_photos_private_bucket
  20261031120000_profiles_member_read_gap
  20261013100100_admin_reports_scrub_legacy_admin_notes
  20261022120000_resident_join_flow_hardening
  20261023100000_admin_booking_review_notifications
  20261023110000_hoa_application_hardening
  20261023120000_community_interest_requests
  20261013130000_revoke_anon_execute_on_admin_rpcs
  20261023140000_lock_down_anon_definer_rpcs_and_email_prefs
  20261023130000_report_photo_attach
  20261030140000_report_photos_bucket_hardened
  20261030130000_report_insert_requires_membership
  20261031100000_hoa_timezones
  20261031110000_exclusive_pending_reservations
  20261101100000_announcement_urgency_and_category
  20261106100000_amenity_allowed_durations
  20261106110000_hoa_event_audience
  20261106120000_announcement_archive
  20261106130000_amenity_rules_hoa_integrity
)
if [ "$ORDER" = plan ]; then LIST=("${PLAN_ORDER[@]}"); else LIST=("${FILE_ORDER[@]}"); fi
pq -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB TEMPLATE $SRC"
rc=0
for f in "${LIST[@]}"; do
  out="$(pq -d "$DB" -1 -f "$M/$f.sql" 2>&1)" && echo "PASS apply   $f" || { echo "FAIL apply   $f"; echo "$out" | grep -v NOTICE | head -6; rc=1; }
done
echo "-- re-apply (idempotency)"
for f in "${LIST[@]}"; do
  out="$(pq -d "$DB" -1 -f "$M/$f.sql" 2>&1)" && echo "PASS re-apply $f" || { echo "NOTE re-apply fails (not idempotent) $f"; echo "$out" | grep -v NOTICE | head -3; }
done
exit $rc
