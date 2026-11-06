# Sprint pause checkpoint — 2026-11-06

## State
- Branch `v1/overnight-integration`. Code and docs are committed at `525bbe7`, apart from this file (committed in the next commit). No database transaction is open and no background task is running. Nothing is pushed, deployed or applied to TENISX REAL.
- Uncommitted: only `.claude/settings.local.json` (the user's local file; deliberately kept out of commits).
- Scratch PostgreSQL servers (15.8 on port 55433, 17.11 on 55432) may still be running; the scratch folders are in `C:\Users\info\tenisx-scratch`. Stop with `pg_ctl -D <dir>\data -m fast stop` if you want the memory back.

## Completed (committed)
- Migration `20261106140000` (revoke anon EXECUTE on 10 RLS-helper definer functions) with rollback and test (21/21 on PG 15.8 and 17.11).
- Cross-HOA booking-rules fix `20261106130000` proven standalone on an untouched restore (12/12 on both versions).
- Fixtures `admin_blockouts.sql` (34 PASS) and `booking_approval.sql` (10 PASS, no SKIP) repaired; they were fixture defects, not product defects.
- The 20-file chain applies and re-applies in file and plan order on both versions.
- Codex round-5 fixes (Schedule clock ticker, trusted community zones, late-evening fixture).
- `docs/TENISX-HOSTED-DEPLOYMENT-GATE-2026-11-06.md`: security audit, Stage D preflight SQL, staged rollout, device test sequence, approval steps.

## Tests at the checkpoint
- Node logic suite: 717 passed.
- SQL tests last run on scratch restores as listed above. No long tests were started for this checkpoint.

## Outstanding
- Codex has returned REVISE five times and never APPROVED; the round-5 fixes are not re-inspected.
- No hosted verification: the Stage D preflight (gate doc §5) has not been run.
- Device testing and the iOS export (needs about 4 GB free RAM) not done. Edge function not deployed.
- Low residual: `check_hoa_admin` anon probe and the signed-in probe on 5 helpers.
- Decision needed on opt-in `20261013100100` (rewrites legacy report admin notes).

## Exact next task
1. You run the SQL in gate doc §5 in the Supabase SQL editor and paste the output.
2. I read it and report whether Stage D's preconditions hold.
3. On your explicit approval, apply `20261106130000` then `20261106140000` (security), then Stage D, one file per transaction, verifying after each (gate doc §6). Never `supabase db push`.
