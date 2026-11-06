# Stage D — profile photos: deployment package (prepared 2026-11-06, NOTHING applied)

Nothing in this document has been run against TENISX REAL. Everything marked "rehearsed" ran on **scratch PostgreSQL 15.8 and 17.11 restores of the verified backup** `C:\Users\info\tenisx-backups\20261106-084850-760831` (RESTORE VERIFIED). Hosted facts below are **as of that backup (2026-11-06 08:48)**, not live: re-check them with section 3 immediately before applying.

## 1. What it is
| | |
|---|---|
| Migration file | `supabase/migrations/20261030120000_profile_photos_private_bucket.sql` |
| Rollback | `supabase/rollbacks/20261030120000_rollback_profile_photos_private_bucket.sql` (new this session, re-runnable) |
| Depends on | the `storage` schema (always on Supabase), `public.profiles` and its owner UPDATE policy. **No dependency on any other pending migration** (rehearsed alone on the untouched restore, PG 15.8 and 17.11). |
| Creates | private bucket `profile-photos` (5 242 880 bytes; `image/jpeg`, `image/png`, `image/webp`); four policies on `storage.objects` named `Owners can {read,upload,replace,delete} their profile photo` (bucket = `profile-photos` and first folder = `auth.uid()`); `profiles.avatar_path text` + CHECK `profiles_avatar_path_check` (`<uid>/avatar-<ms>.(jpg|png|webp)`, folder must equal the row's own id). |
| Does NOT touch | `profiles.avatar_url`, the public `avatars` bucket or its policies, any other table, function, grant or trigger. |
| Safety stop | If a bucket `profile-photos` already exists with different settings the migration raises and changes nothing (it neither keeps nor overwrites it). |

## 2. Hosted preconditions (as of the backup — re-verify, section 3)
- `profile-photos` bucket: **absent** (buckets present: `avatars` public, `branding` public, `hoa-documents` private, `hoa-verification-documents` private 10 MB, `score-photos` public).
- `profiles.avatar_path`: **absent**. 3 of 7 profiles have a legacy `avatar_url` (2 objects in the public `avatars` bucket); they are unaffected and are not migrated.
- No `storage.objects` policy mentions `profile-photos`.
- Hosted Postgres 15.8; the SQL uses nothing newer (executed on a real 15.8 server).
- Hosted migration history still ends at `20261013190307`; Stage D is independent of that.

## 3. Gate-1 read-only SQL (paste into the Supabase SQL editor; each statement is a SELECT)
```sql
-- (a) must show NO row for profile-photos (or exactly: private, 5242880, {image/jpeg,image/png,image/webp})
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
-- (b) must return 0 rows
select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_path';
-- (c) must return 0 rows (no policy about this bucket yet)
select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' and (qual ilike '%profile-photos%' or with_check ilike '%profile-photos%' or policyname ilike '%profile photo%');
-- (d) the storage delete guard exists (rollback relies on its flag)
select tgname from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal;
-- (e) baseline for after-the-fact comparison
select count(*) as profiles, count(avatar_url) as with_legacy_avatar from public.profiles;
```
If (a) shows a differently configured `profile-photos` bucket, or (b)/(c) return rows: **stop**, send me the output.

## 4. Apply (only after you approve; one file; never `supabase db push`)
1. Fresh backup exists and is restore-verified: **done** (`20261106-084850-760831`). If hosted data has changed meaningfully since, take another.
2. Apply the file `20261030120000_profile_photos_private_bucket.sql` verbatim, in one transaction, via the Supabase SQL editor (or the Supabase MCP `apply_migration` once a write connection is authorised). The file is the SQL to apply.
3. Register it so tooling knows it ran (the hosted history uses apply-time versions; use the real apply time, not the file name):
```sql
insert into supabase_migrations.schema_migrations (version, name)
values (to_char(now() at time zone 'utc','YYYYMMDDHH24MISS'), 'profile_photos_private_bucket');
```
Why not `db push`: 13 older local files (`20260821010000…20261013120000`) are already applied under **different** version numbers; a push would try to re-run them and hit duplicate-object errors, and it would also run the 18 other pending files in one go.

## 5. Post-deployment checks (read-only)
```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='profile-photos';   -- false | 5242880 | {image/jpeg,image/png,image/webp}
select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'Owners can % their profile photo' order by 1;   -- 4 rows
select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_path';   -- 1 row
select conname from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_avatar_path_check';   -- 1 row
select count(*) as profiles, count(avatar_url) as with_legacy_avatar from public.profiles;   -- same as the baseline
```

## 6. iPhone smoke test (Expo Go, a TEST resident account, after the checks pass)
1. Profile → add photo: choose a JPEG. The header avatar, account menu and Me tab show it.
2. Replace it with a PNG: the new one shows everywhere; the old object disappears (check Storage dashboard).
3. Remove it: initials return; `avatar_path` is NULL.
4. Pick a ~6 MB image: refused with a clear size message. Pick a PDF/other type: refused with a clear type message.
5. Sign in as a **second** account: it must not see the first account's photo (no signed URL for another user's path).
6. Airplane mode during upload: an honest failure message; no half-saved state.
7. Existing legacy photos (3 profiles with `avatar_url`) are unchanged.

## 7. Rollback
`supabase/rollbacks/20261030120000_rollback_profile_photos_private_bucket.sql` — clears `avatar_path` values, drops the four policies, the CHECK and the column, and deletes the bucket **only if it is empty**. Storage files cannot be deleted by SQL (Supabase blocks direct deletes from `storage.objects`): if photos exist the bucket is kept (with no policies, nobody can read it) and a NOTICE says so; delete the files through the dashboard/Storage API, then run the script again. Rehearsed on PG 15.8 and 17.11: restores exactly the pre-D policies, buckets, column and constraint; re-runnable; D re-applies afterwards.

## 8. Security notes
- Private bucket, owner-only on all four commands (verified with real RLS, 15 checks in `supabase/tests/profile_photos_storage.sql`: own folder only; another user — including a community administrator — cannot read, modify or delete; anon sees nothing; objects outside a user folder are refused; `avatar_path` cannot point at another user's folder or a non-image extension).
- The app reads photos through short-lived signed URLs, refreshed before expiry; it never uses the public `avatars` bucket for new photos.
- Administrators cannot see residents' profile photos (deliberate: owner-only). If product later wants administrators to see them, that needs a new reviewed policy.
- Size/MIME limits are enforced by the bucket and the client; **the Storage API enforcement itself has never been exercised** (no Storage service locally). The smoke test steps 4 and 5 are the real test.

## 9. Known limitations
- Hosted facts are from the backup, not live (section 3 re-checks them).
- The backup does not contain Storage file contents, Auth dashboard settings or Edge Function secrets.
- Signed-URL generation, upload size/MIME rejection and real file bytes are untested until the first live upload.
- Stage D does not change `profiles` read privacy: that is Stage G (`20261031120000`), independent, rehearsed (12 checks).
- Profile photos are not shown to other residents in this version (owner-only by design).
