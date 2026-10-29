"""Best-effort replay of the repo migration history onto a DISPOSABLE local PostgreSQL (127.0.0.1 only).
The history is not self-contained (early files reference tables created later, hosted objects pre-date the repo), so
files that fail are retried in later passes until a pass makes no progress. Output lists what applied and what did not.
usage: python replay-tolerant.py <port> <rehearsal-db-name> <to_prefix> [skip-substring ...]"""
import subprocess, sys, pathlib, re
PSQL = r'C:\Users\info\tenisx-tools\pgbin17-11\pgsql\bin\psql.exe'
port, db, hi, skip = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
if not re.fullmatch(r'[0-9]{4,5}', port) or not (1024 <= int(port) <= 65535): sys.exit('bad port')
if not re.fullmatch(r'rehearsal[a-z0-9_]{0,40}', db): sys.exit('database name must start with "rehearsal" (disposable scratch databases only)')
pending = [f for f in sorted(pathlib.Path('supabase/migrations').glob('*.sql'))
           if f.name <= hi and not any(s in f.name for s in skip)]
done, errs = [], {}
passno = 0
while pending:
    passno += 1
    progress, still = False, []
    for f in pending:
        r = subprocess.run([PSQL, '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1',
                            '-q', '-1', '-f', str(f)], capture_output=True, text=True)
        if r.returncode: still.append(f); errs[f.name] = (r.stderr or r.stdout).strip().splitlines()[-1][:200]
        else: done.append(f.name); progress = True; errs.pop(f.name, None)
    print(f'pass {passno}: applied so far {len(done)}, still failing {len(still)}', flush=True)
    if not progress: break
    pending = still
print('APPLIED_ORDER_COUNT', len(done))
for f in pending: print('NEVER APPLIED', f.name, '|', errs[f.name])
