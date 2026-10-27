# TENISX REAL backup: plain-English guide

**Why:** the Supabase organization is on the **free plan**, so Supabase keeps **no automatic backups**. Before any database change we take our own copy of all accounts and data, then prove on this computer that the copy restores. The backup only *reads* from Supabase; it changes nothing there.

**What you need:** about 10 minutes, the database password, and nobody using the TenisX app during that time. The tools are already on this computer (`C:\Users\info\tenisx-tools\pgbin17-11`, official PostgreSQL 17.11 files, checked against an independent published SHA-256). No installer, no administrator rights, no cost.

---

## Step 1 - Close the app everywhere
Close TenisX on every phone, simulator and browser. The backup reads the data twice (before and after copying); if anything changes in between, it stops and tells you to run it again.

## Step 2 - Get the database password
It is **not** your Supabase login password. It is the password of the database's `postgres` user, chosen when the project was created.
- If you know it (or it is in your password manager): use it.
- If not, reset it (this does **not** touch accounts or data; it only changes the database password, which the app does not use):
  1. Go to https://supabase.com/dashboard and sign in.
  2. Click the project **TENISX REAL**.
  3. In the left menu open **Database**, then **Settings** (on older dashboards: the gear icon **Project Settings** -> **Database**). Supabase's own steps: https://supabase.com/kb/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB
  4. Find **Database password** and click **Reset database password**, choose **Generate a password**, click **Copy**, then **Reset password**.
  5. Save it in a password manager (or write it on paper). Supabase will not show it again.
- Never paste this password into the chat, an email, a text file, or anything inside the project folder.

## Step 3 - Run ONE command
1. Press the **Windows key**, type `PowerShell`, and open **Windows PowerShell**. Open it normally; do **not** use "Run as administrator".
2. Copy this entire line, paste it into the window (right-click pastes), and press **Enter**:

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\info\tenisx-native\scripts\hosted-backup\backup.ps1
```
3. When it says *Type the database password*, paste or type it and press **Enter**. **Nothing appears while you type or paste. That is normal.** The password is held in memory only, handed to the database tools for that one run, and cleared at the end. It is never written to a file or shown on screen.
4. Wait. You will see `ok` lines (backup), then "Now proving the backup can be restored", then one of:
   - **`RESTORE VERIFIED - the backup is recoverable.`** (green) - success.
   - **`RESTORE NOT VERIFIED`** or **`Restore test stopped: ...`** (red) - do not continue; tell Claude exactly what the screen says. The backup folder is kept either way.
5. Tell Claude **"backup done"** (and the result). Claude will check the numbers below with you.

### If it cannot connect
- Check the password has no extra space.
- In the Supabase dashboard click **Connect** (top of the project page) -> choose **Session pooler**. Copy only the **host**: the part after the `@` and before the `:` (for example `aws-0-us-east-1.pooler.supabase.com`). Ignore the rest and **do not copy any password part**. Then run the same command with the host added at the end, replacing only the host name in this example:

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\info\tenisx-native\scripts\hosted-backup\backup.ps1 -PoolerHost aws-0-us-east-1.pooler.supabase.com
```

### If it says data changed during the backup
Someone or something used the app. Close it everywhere and run the same command again.

---

## Step 4 - Checklist: does the backup contain what matters?
The folder `C:\Users\info\tenisx-backups\<date-time>\` is created automatically. Ask Claude to read `restore-test.report.txt` and `BACKUP-COMPLETE.txt` with you, or check yourself:

| Check | Where to look | Expected |
|---|---|---|
| Backup finished | file `BACKUP-COMPLETE.txt` exists | yes |
| Restore proven | file `RESTORE-VERIFIED.txt` exists | yes (it names the dump's SHA-256) |
| Accounts | `restore-test.report.txt` line `auth.users live=N restored=N` | N equals the number of test accounts you expect, both numbers identical |
| Logins / identities | `auth.identities live=N restored=N` | identical |
| Profiles | `public.profiles` | identical |
| Memberships | `public.hoa_memberships` | identical |
| Reservations | `public.bookings` | identical |
| Communities | `public.hoas` | identical |
| Issue reports | `public.maintenance_reports` | identical |
| Everything else | `strict comparison lines: N; differences: 0` | differences must be **0** |
| Photos / documents | `storage-buckets.txt` (bucket name, public?, object count) | note the counts; the files themselves are NOT in the backup (see below) |

The restore test compares a hash of every row of every table in the five backed-up database schemas (`public`, `auth`, `storage`, `supabase_migrations`, `backup_20261013`), plus the definitions of policies, functions, triggers, indexes, constraints, views, enums and sequences in those schemas, between the live project and a copy rebuilt on this computer. "Differences: 0" means the rebuilt copy matches the live database content in those schemas. It does **not** prove recovery of the whole Supabase project: privileges (grants) are compared for information only, login-token tables are compared strictly only if they were stable during the backup, materialized-view contents are rebuilt rather than compared, and the items in the next section are outside the database dump.

## What the backup does NOT contain (do these separately)
- **Storage files** (uploaded report photos, documents). The database only stores their names. Download any you care about from Dashboard -> Storage before running the migration that changes bucket settings (`20261023110000`).
- **Auth dashboard settings** (providers, email templates, redirect URLs, leaked-password protection) and **Edge Function secrets**: re-enter from the dashboard if the project is ever rebuilt.
- **Supabase-managed internals**: roles' passwords, extension code, and settings Supabase controls. Role *names* and settings are recorded (`roles.txt`, `extensions.txt`, `role-settings.txt`) for reference.
- **Privileges (grants)** are recorded and compared for information only; the exact owner roles Supabase uses cannot be reproduced on a plain local server.
- Login sessions/refresh tokens are copied but treated specially: they are compared strictly only if no device refreshed a login during the backup.

## If something goes wrong later: recovery outline
1. Never "fix forward" blindly. Stop and tell Claude.
2. Create a **new** empty Supabase project (a second free project; do not overwrite TENISX REAL unless Claude confirms it is the only way).
3. Restore into it using this backup's `full.dump` (Claude prepares the exact `pg_restore` command; it needs that new project's database password, which you type yourself, hidden, as above).
4. Re-upload Storage files, re-enter Auth settings and secrets, then point the app's environment (URL and anon key) at the new project.
Accounts, password hashes, memberships and bookings come back from the dump, so existing test users can log in with their existing passwords.

## Looking after the backup
- The folder contains password hashes. It is locked to your Windows user. Do not email it, upload it, or commit it. It is outside the project folder on purpose.
- Copy the whole folder to a USB drive or an encrypted drive you trust as a second copy.
- Older folders named `selftest-...` in that location are mock practice data from tool testing and can be ignored.

## Not done yet (for tomorrow, after the backup is verified)
- Running the read-only verification SQL (`HOSTED-VERIFY-READONLY.sql`) and applying the seven migrations. See `MIGRATION-RISK-REVIEW.md` for the order and risks. Nothing has been applied.
