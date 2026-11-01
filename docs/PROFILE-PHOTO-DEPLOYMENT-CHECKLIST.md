# Profile photos - deployment checklist (prepared 2026-10-31; NOTHING applied)

**Status: end-to-end upload, replace and remove remain BLOCKED until migration `20261030120000_profile_photos_private_bucket.sql` is applied to TENISX REAL.** The error on the Profile screen ("Profile photos are not enabled on this server yet") is the honest result of Storage answering `Bucket not found`; the app does not fake success.

## Verified dependencies (read-only)
- Hosted migration history (TENISX REAL, read via `list_migrations` on 2026-10-31) ends at `20261013190307 platform_approval_and_secure_messaging`. `20261030120000` is NOT applied. Nothing was written.
- The migration needs only: Postgres + the `storage` schema (always present on Supabase) and the existing `public.profiles` table with its row-owner UPDATE policy. It has no dependency on the other nine pending migrations, so it can be applied on its own (Stage D in the migration plan).
- It creates: private bucket `profile-photos` (5 MB, JPEG/PNG/WebP), four owner-only policies on `storage.objects` (first folder = `auth.uid()`), column `profiles.avatar_path` with a CHECK (`<uid>/avatar-<ms>.(jpg|png|webp)` and the folder must equal the row's own id). It stops loudly if a bucket of that name exists with different settings. `profiles.avatar_url` is untouched (Stage 2 screens still read it).

## Code audit (local, done)
| Area | Result |
|---|---|
| Permissions / owner-only | Upload path `<uid>/avatar-<ms>.<ext>` is built from the signed-in user id; delete only touches `isOwnPhotoPath` paths; storage policies enforce the same server-side. |
| MIME / size | Client sniffs magic bytes (not picker metadata), allows JPEG/PNG/WebP, rejects > 5 MB and empty files; the bucket enforces the same. |
| Replacement / caching | A fresh object name per upload (no stale cache); the old object is removed best-effort after the profile points at the new one; a failed profile update removes the new upload (no orphan). |
| Removal | Clears `avatar_path` and legacy `avatar_url`, then removes the object. |
| Display | Short-lived signed URL, refreshed a minute before expiry; falls back to initials if the object/bucket is missing. |
| Web / iPhone | `expo-image-picker` with `base64: true`, decoded to an exact-size `ArrayBuffer` (a Blob body does not work through supabase-js on React Native); same path on Expo Web. |
| Error handling | **Fixed in this round:** any "not found" used to be reported as "not enabled on this server". Only `Bucket not found` is now (`friendlyStorageError`, unit-tested); other failures show their own message. |

No further code change is needed for uploads once the migration is applied.

## What could NOT be tested here
No isolated Supabase Storage service (Storage API) is available locally, so an actual upload, signed URL, replace and delete have not been exercised end to end. The migration SQL itself was rehearsed earlier on the restored database copy (see `docs/RESIDENT-FINAL-VERIFICATION-2026-10-30.md`). Treat the first post-deploy upload as the real test.

## Deployment steps (after the verified fresh backup and your staged-migration approval)
1. Confirm the fresh backup exists and restores (migration plan section 0).
2. Apply only `20261030120000` (Stage D) with the Supabase MCP `apply_migration` - never `db push`. If it raises "bucket profile-photos already exists with different settings", STOP and review.
3. Verify: `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='profile-photos'` -> private, 5242880, three types; `select column_name from information_schema.columns where table_name='profiles' and column_name='avatar_path'`; four policies named "Owners can ... their profile photo".
4. Smoke test with a TEST resident: add a JPEG (header avatar, account menu and Me update); replace it (old object gone, new one shown); remove it (initials return); try a 6 MB file and a PDF (both refused with clear text); confirm a second account cannot read the first account's object path.
5. Roll back if needed: clear `avatar_path` values, drop the four policies and the bucket (only if empty), drop the column and CHECK - none of this affects `avatar_url`.

## Update 2026-10-31 (reservation integrity round)
- The migration order is now in `docs/MIGRATION-PLAN-2026-10-31.md`: profile photos are Stage D, independent of the reservation migrations (E, F). They can be
  applied on their own; if you apply D alone, the profile screen's "not enabled" message disappears and uploads start working.
- Re-verified: the migration still has no dependency on any other pending migration; it applied cleanly in the full-chain rehearsal (10 earlier migrations + E + F) on the
  restore of the 2026-10-29 backup, and none of the new functions are executable by anon. Storage-API behaviour (MIME/size) is still untestable locally.
- YOUR exact steps: (1) Gate 0 fresh backup + restore verification; (2) tell me to apply Stage D, or run it yourself from the SQL editor; (3) run the verification
  queries in step 3 above; (4) with a TEST resident: add a JPEG, replace it, remove it, try a 6 MB file and a PDF (both refused), and check the avatar updates in the header and the Me tab.
- Separate and still open: the profile READ exposure (Stage G in the migration plan).
