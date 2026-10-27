# How to take the TENISX REAL backup (plain-English steps)

Why: the Supabase project is on the free plan, so Supabase keeps **no automatic backups**. Before any database change we take our own copy of all accounts and data, then prove on this computer that the copy can be restored. Nothing is changed in Supabase; the backup only reads.

The tools are already on this computer (`C:\Users\info\tenisx-tools\pgbin17-11`). You only need to type the database password once.

## Before you start
1. Close the TenisX app on every phone, simulator and browser, and do not use it until the backup finishes (about 5 minutes). The backup compares the data before and after copying; if anyone changes something in between, it stops and asks you to run it again.
2. Have the **database password** for the TENISX REAL project ready. If you do not know it:
   1. Open https://supabase.com/dashboard and sign in.
   2. Click the project **TENISX REAL**.
   3. Click **Project Settings** (gear icon, bottom left) -> **Database**.
   4. Under **Database password**, click **Reset database password**. A new password is shown once. Copy it into your password manager. *Resetting the password does not touch accounts or data, but it will break anything that uses the old password (the app itself does not use it).*
   Never paste this password into the chat, an email, or a file in the project.

## Take the backup
1. Press the **Windows key**, type `PowerShell`, and open **Windows PowerShell** (a normal window; do **not** choose "Run as administrator").
2. Copy this line, paste it into the window (right-click pastes), and press **Enter**:

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\info\tenisx-native\scripts\hosted-backup\backup.ps1
   ```
3. When it says **"Type the database password"**, paste or type the password and press **Enter**. Nothing appears on screen while you do this; that is normal.
4. Wait. It prints `ok` lines and finally `BACKUP COMPLETE` and a folder name like `C:\Users\info\tenisx-backups\20261026-...`.
5. Tell Claude: **"backup done"**. Claude will run the restore test (it needs no password) and tell you the result.

### If it says it could not connect
- Check the password (no spaces at the end).
- In the Supabase dashboard click **Connect** (top of the project page) -> **Session pooler**. Copy only the **host** (looks like `aws-0-us-east-1.pooler.supabase.com`) and run the same line with ` -PoolerHost <that host>` added at the end.

### If it says data changed during the backup
Someone used the app. Close it everywhere and run the same line again.

## After the backup
- The folder under `C:\Users\info\tenisx-backups\` contains copies of password hashes. It is locked to your Windows account. Do not email or upload it, and do not put it in the project folder.
- Optional but wise: copy the whole folder to a USB drive or an encrypted cloud folder you trust.
- Not included in this backup (stored outside the database): uploaded files in Storage buckets (report photos), the Auth settings in the dashboard, and Edge Function secrets. Claude will list what the bucket inventory shows.
