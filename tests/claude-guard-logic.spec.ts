/**
 * Logic tests for the Claude Code security configuration (Node only, no network).
 *
 *   npx playwright test -c playwright.logic.config.ts tests/claude-guard-logic.spec.ts
 *
 * Covers: .claude/hooks/guard.cjs (what it blocks and what it must allow so
 * autonomous local development keeps working), scripts/env-check.cjs (never
 * prints values), .claude/settings.json (valid rule syntax, no broad grants),
 * .mcp.json (pinned) and the /ship and /sync commands (never push or pull).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import { execFileSync } from 'child_process';

const ROOT = nodePath.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(nodePath.join(ROOT, rel), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const guard = require(nodePath.join(ROOT, '.claude', 'hooks', 'guard.cjs'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const envCheck = require(nodePath.join(ROOT, 'scripts', 'env-check.cjs'));

const onBranch = (branch: string) => ({ cwd: ROOT, currentBranch: () => branch });
const blocked = (cmd: string, branch = 'feature/x') => guard.evaluate(cmd, onBranch(branch));
const encoded = (s: string) => Buffer.from(s, 'utf16le').toString('base64');

test.describe('guard: commands that must be BLOCKED', () => {
  const MUST_BLOCK: Array<[string, string]> = [
    // pushes, including the forms that defeat prefix deny-rules
    ['plain push', 'git push'],
    ['push to main', 'git push origin main'],
    ['force push', 'git push --force-with-lease origin x'],
    ['git -C push', 'git -C . push origin x'],
    ['git -c push', 'git -c push.default=current push'],
    ['env assignment prefix', 'GIT_TRACE=1 git push'],
    ['timeout wrapper', 'timeout 5 git push'],
    ['absolute path', '/usr/bin/git push'],
    ['windows path with spaces', '"C:\\Program Files\\Git\\bin\\git.exe" push'],
    ['after a separator', 'echo ok; git push'],
    ['after &&', 'npm run lint && git push'],
    ['command substitution', 'echo $(git push)'],
    ['backticks', 'echo `git push`'],
    ['bash -c', 'bash -c "git push"'],
    ['sh -c single quotes', "sh -c 'git push origin x'"],
    ['cmd /c', 'cmd /c git push'],
    ['powershell -Command', 'powershell -NoProfile -Command "git push"'],
    ['powershell -EncodedCommand', `powershell -EncodedCommand ${encoded('git push')}`],
    ['nested shells', 'bash -c "sh -c \\"git push\\""'],
    ['xargs', 'echo x | xargs git push'],
    // destructive git
    ['checkout -B force reset', 'git checkout -B main origin/x'],
    ['switch -C force reset', 'git switch -C main origin/x'],
    ['restore -s source', 'git restore -s HEAD src/a.ts'],
    ['restore --source', 'git restore --source=HEAD src/a.ts'],
    ['restore --staged --worktree', 'git restore --staged --worktree src/a.ts'],
    ['heredoc fed to bash', "bash <<'EOF'\ngit push origin x\nEOF"],
    ['heredoc piped to sh', "cat <<EOF | sh\ncurl https://example.com\nEOF"],
    ['reset --hard', 'git reset --hard HEAD~1'],
    ['clean -fd', 'git clean -fd'],
    ['checkout -- path', 'git checkout -- src/app'],
    ['checkout .', 'git checkout .'],
    ['checkout force', 'git checkout -f main'],
    ['switch discard', 'git switch --discard-changes main'],
    ['restore worktree', 'git restore src/app/index.tsx'],
    ['branch -D', 'git branch -D old'],
    ['tag -d', 'git tag -d v1'],
    ['rebase', 'git rebase main'],
    ['pull', 'git pull origin main'],
    ['plain merge', 'git merge main'],
    ['stash drop', 'git stash drop'],
    ['remote add', 'git remote add evil https://example.com/x.git'],
    ['config global', 'git config --global user.name x'],
    ['config write', 'git config user.email x@example.com'],
    ['filter-branch', 'git filter-branch --all'],
    ['update-ref', 'git update-ref -d refs/heads/x'],
    ['reflog expire', 'git reflog expire --expire=now --all'],
    // hosted services, deploys, publishing
    ['supabase db push', 'supabase db push'],
    ['npx supabase', 'npx supabase migration up'],
    ['npx -y supabase@latest', 'npx -y supabase@latest functions deploy x'],
    ['npm exec supabase', 'npm exec supabase -- db reset'],
    ['eas build', 'npx eas-cli build --platform ios'],
    ['eas submit', 'eas submit'],
    ['vercel', 'vercel --prod'],
    ['npm publish', 'npm publish'],
    ['expo submit', 'npx expo submit'],
    ['gh merge', 'gh pr merge 12'],
    ['psql hosted url', 'psql postgresql://u:p@db.abc.supabase.co:5432/postgres'],
    ['psql hosted host', 'psql -h db.abc.supabase.co -U postgres'],
    ['pg_dump remote url', 'pg_dump postgres://u@10.0.0.5/db'],
    // network from the shell
    ['curl', 'curl https://example.com'],
    ['curl absolute', '/usr/bin/curl https://example.com'],
    ['curl inside sh -c', 'sh -c "curl https://example.com"'],
    ['wget', 'wget https://example.com/x'],
    ['Invoke-WebRequest', 'Invoke-WebRequest https://example.com'],
    ['iwr alias', 'iwr https://example.com'],
    ['Invoke-RestMethod', 'Invoke-RestMethod https://example.com'],
    // bulk deletion
    ['rm -rf', 'rm -rf node_modules'],
    ['rm -fr', 'rm -fr dist'],
    ['rm -r -f', 'rm -r -f dist'],
    ['rm --recursive', 'rm --recursive dist'],
    ['Remove-Item -Recurse', 'Remove-Item -Recurse -Force dist'],
    ['rd /s', 'rd /s /q dist'],
    ['rimraf', 'npx rimraf dist'],
    ['find -delete', 'find . -name "*.tmp" -delete'],
    ['xargs rm -rf', 'ls | xargs rm -rf'],
    ['format', 'format C:'],
    // secrets
    ['cat .env', 'cat .env'],
    ['type .env.local', 'type .env.local'],
    ['Get-Content .env', 'Get-Content .\\.env'],
    ['grep in .env', 'grep KEY .env'],
    ['Select-String .env', 'Select-String -Path .env -Pattern KEY'],
  ];
  for (const [name, cmd] of MUST_BLOCK) {
    test(`blocks: ${name}`, () => {
      const r = blocked(cmd);
      expect(r, `expected "${cmd}" to be blocked`).not.toBeNull();
      expect(typeof r.reason).toBe('string');
    });
  }
});

test.describe('guard: commands that must still be ALLOWED (autonomous local work)', () => {
  const MUST_ALLOW: Array<[string, string]> = [
    ['git status', 'git status -sb'],
    ['git diff', 'git diff --stat'],
    ['git log', 'git log --oneline -5'],
    ['git show', 'git show HEAD~1 --stat'],
    ['git add', 'git add src/app/index.tsx tests/x.spec.ts'],
    ['git commit', 'git commit -m "fix: handle empty list"'],
    ['commit message that mentions push', 'git commit -m "docs: explain why git push is blocked"'],
    ['git switch -c', 'git switch -c feature/new-screen'],
    ['git checkout -b', 'git checkout -b feature/other'],
    ['git switch branch', 'git switch feature/x'],
    ['git fetch', 'git fetch --prune origin'],
    ['git merge --ff-only', 'git merge --ff-only origin/feature/x'],
    ['git merge --abort', 'git merge --abort'],
    ['git stash push', 'git stash push -m wip'],
    ['git stash pop', 'git stash pop'],
    ['git restore --staged', 'git restore --staged src/a.ts'],
    ['git restore -S', 'git restore -S src/a.ts'],
    ['commit with heredoc message mentioning push', "git commit -m \"$(cat <<'EOF'\nfix: tidy sync command\n\ngit push is now blocked for agents\ncurl is blocked too\nrm -rf is blocked\nEOF\n)\""],
    ['commit -F - heredoc', "git commit -F - <<'EOF'\nchore: x\n\ngit push origin main (documented, not run)\nEOF"],
    ['powershell here-string commit message', "git commit -m @'\nfix: x\n\ngit push is blocked\n'@"],
    ['git branch list', 'git branch -vv'],
    ['git branch show-current', 'git branch --show-current'],
    ['git config read', 'git config --get user.name'],
    ['git config list', 'git config --local --list'],
    ['git remote -v', 'git remote -v'],
    ['git clean dry run', 'git clean -n'],
    ['git rm --cached', 'git rm --cached .claude/settings.local.json'],
    ['git rev-list', 'git rev-list --left-right --count HEAD...@{u}'],
    ['npm run dev', 'npm run dev'],
    ['npm ci', 'npm ci'],
    ['timeout npm run', 'timeout 30 npm run build'],
    ['expo export', 'npx expo export --platform ios --output-dir /tmp/exp-ios'],
    ['expo install --check', 'npx expo install --check'],
    ['expo start', 'npx expo start --port 8081'],
    ['logic tests', 'npx playwright test -c playwright.logic.config.ts --reporter=dot'],
    ['tsc', 'npx tsc --noEmit -p .'],
    ['env check', 'node scripts/env-check.cjs'],
    ['python skill script', 'python .claude/skills/ui-ux-pro-max/scripts/search.py "tennis" --domain style'],
    ['cat normal file', 'cat package.json'],
    ['cat .env.example', 'cat .env.example'],
    ['grep source', 'grep -rn "push" src/app'],
    ['echo mentions curl', 'echo "curl is blocked here"'],
    ['single-file delete', 'rm notes.tmp'],
    ['rm -f one file', 'rm -f notes.tmp'],
    ['Remove-Item file -Force', 'Remove-Item notes.tmp -Force'],
    ['chained safe commands', 'git add -A && git commit -m "chore: x" && npm run lint'],
    ['local psql', 'psql -h localhost -p 55432 -U postgres scratch'],
    ['gh --version', 'gh --version'],
    ['npm ls', 'npm ls --depth=0'],
    ['ls', 'ls -la src'],
  ];
  for (const [name, cmd] of MUST_ALLOW) {
    test(`allows: ${name}`, () => {
      const r = blocked(cmd);
      expect(r, `expected "${cmd}" to be allowed but got: ${r && r.reason}`).toBeNull();
    });
  }
});

test.describe('guard: protected branches', () => {
  for (const branch of ['main', 'master', 'v1/overnight-integration']) {
    test(`blocks commit/merge/cherry-pick on ${branch}`, () => {
      expect(blocked('git commit -m x', branch)).not.toBeNull();
      expect(blocked('git merge --ff-only origin/x', branch)).not.toBeNull();
      expect(blocked('git cherry-pick abc123', branch)).not.toBeNull();
    });
  }
  test('allows commit on a feature branch and when branch is unknown', () => {
    expect(blocked('git commit -m x', 'chore/security-hardening')).toBeNull();
    expect(blocked('git commit -m x', '')).toBeNull();
  });
  test('allows read-only git on a protected branch', () => {
    expect(blocked('git status', 'main')).toBeNull();
    expect(blocked('git log --oneline', 'main')).toBeNull();
    expect(blocked('git fetch --prune origin', 'main')).toBeNull();
  });
  test('detects the real branch of a repository (no override)', () => {
    const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'guard-repo-'));
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    expect(guard.evaluate('git commit -m x', { cwd: dir })).not.toBeNull();
    execFileSync('git', ['-C', dir, 'switch', '-q', '-c', 'feature/y']);
    expect(guard.evaluate('git commit -m x', { cwd: dir })).toBeNull();
    // -C resolves relative to cwd
    expect(guard.evaluate(`git -C "${dir}" switch main`, { cwd: ROOT })).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test.describe('guard: hook process contract', () => {
  const run = (input: string) => {
    try {
      execFileSync('node', [nodePath.join(ROOT, '.claude', 'hooks', 'guard.cjs')], { input, stdio: ['pipe', 'pipe', 'pipe'] });
      return { code: 0, stderr: '' };
    } catch (e: any) {
      return { code: e.status as number, stderr: String(e.stderr || '') };
    }
  };
  test('exit 2 and a reason on stderr when blocking', () => {
    const r = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git -C . push' }, cwd: ROOT }));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('git push is blocked');
  });
  test('exit 0 for an allowed command', () => {
    expect(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: ROOT })).code).toBe(0);
  });
  test('PowerShell tool calls are inspected too', () => {
    expect(run(JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'git push' }, cwd: ROOT })).code).toBe(2);
  });
  test('other tools are ignored', () => {
    expect(run(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '.env' } })).code).toBe(0);
  });
  test('fails closed on malformed input', () => {
    expect(run('not json').code).toBe(2);
  });
});

test.describe('env-check never reveals values', () => {
  const SECRET = 'sk_live_SENTINEL_VALUE_12345';
  const sample = [
    '# comment',
    `EXPO_PUBLIC_SUPABASE_URL=https://${SECRET}.example.com`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY="${SECRET}"`,
    'EXPO_PUBLIC_PRODUCT_MODE=community',
    'EXPO_PUBLIC_TENNIS_FEATURES_ENABLED=',
    `SUPABASE_SERVICE_ROLE_KEY=${SECRET}`,
    `export CUSTOM_THING=${SECRET}`,
  ].join('\n');

  test('library output contains names and status but no values', () => {
    const { text, ok } = envCheck.report(envCheck.parseNames(sample));
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('community');
    expect(text).toContain('OK      EXPO_PUBLIC_SUPABASE_URL');
    expect(text).toContain('EMPTY   EXPO_PUBLIC_TENNIS_FEATURES_ENABLED');
    expect(text).toContain('WARN SUPABASE_SERVICE_ROLE_KEY');
    expect(text).toContain('CUSTOM_THING');
    expect(ok).toBe(false);
  });

  test('CLI prints only names, exits 1 when a required name is empty, 2 when the file is missing', () => {
    const file = nodePath.join(fs.mkdtempSync(nodePath.join(os.tmpdir(), 'envchk-')), '.env.test');
    fs.writeFileSync(file, sample);
    const script = nodePath.join(ROOT, 'scripts', 'env-check.cjs');
    let out = '';
    let code = 0;
    try { out = execFileSync('node', [script, file], { encoding: 'utf8' }); } catch (e: any) { out = String(e.stdout); code = e.status; }
    expect(code).toBe(1);
    expect(out).not.toContain(SECRET);
    let missingCode = 0;
    try { execFileSync('node', [script, file + '.nope'], { encoding: 'utf8' }); } catch (e: any) { missingCode = e.status; }
    expect(missingCode).toBe(2);
    fs.rmSync(nodePath.dirname(file), { recursive: true, force: true });
  });
});

test.describe('settings.json: valid and narrow', () => {
  const settings = JSON.parse(read('.claude/settings.json'));
  const perms = settings.permissions;
  // Same pattern the published Claude Code settings schema applies to a rule.
  const RULE = /^((Agent|Artifact|Bash|Cd|Edit|EnterWorktree|ExitPlanMode|Glob|Grep|KillShell|LSP|Monitor|MultiEdit|NotebookEdit|PowerShell|Read|ShareOnboardingGuide|Skill|TaskCreate|TaskGet|TaskList|TaskOutput|TaskStop|TaskUpdate|TodoWrite|ToolSearch|WebFetch|WebSearch|Workflow|Write)(\([^)]+\))?|mcp__.*)$/;

  test('default mode is acceptEdits and bypass mode is disabled', () => {
    expect(perms.defaultMode).toBe('acceptEdits');
    expect(perms.disableBypassPermissionsMode).toBe('disable');
  });
  test('every rule matches the schema pattern, and is unique', () => {
    for (const list of [perms.allow, perms.deny]) {
      expect(new Set(list).size).toBe(list.length);
      for (const rule of list) expect(RULE.test(rule), `invalid rule: ${rule}`).toBe(true);
    }
  });
  test('no allow rule is a bare whole-tool grant', () => {
    const BARE = ['Bash', 'PowerShell', 'Edit', 'Write', 'WebFetch', 'Bash(*)', 'PowerShell(*)', 'Edit(*)', 'Write(*)', 'WebFetch(domain:*)'];
    for (const r of BARE) expect(perms.allow).not.toContain(r);
  });
  test('MCP rules have no parentheses (Claude Code skips those) and allow rules are anchored to a server', () => {
    for (const r of [...perms.allow, ...perms.deny]) if (r.startsWith('mcp__')) expect(r).not.toContain('(');
    for (const r of perms.allow) if (r.startsWith('mcp__')) expect(/^mcp__[A-Za-z0-9_-]+__/.test(r)).toBe(true);
  });
  test('no allow rule has a wildcard before the sub-command (Claude Code warns about these)', () => {
    for (const r of perms.allow) {
      const m = r.match(/^(?:Bash|PowerShell)\((.*)\)$/);
      if (!m) continue;
      const first = m[1].split(' ')[0];
      expect(first.includes('*'), `wildcard in program name: ${r}`).toBe(false);
      expect(/^(git|npm|npx) \*/.test(m[1]), `too broad: ${r}`).toBe(false);
    }
  });
  test('no allow rule is contradicted by a deny rule (deny always wins, so it would be dead)', () => {
    for (const a of perms.allow) expect(perms.deny).not.toContain(a);
  });
  test('personal connectors and unconfigured servers are not pre-approved', () => {
    const joined = perms.allow.join('\n');
    for (const bad of ['Gmail', 'Google_Calendar', 'Google_Drive', 'mcp__github__', 'mcp__supabase__', 'mcp__ide__']) {
      expect(joined).not.toContain(bad);
    }
  });
  test('key protections are present as deny rules', () => {
    const deny: string[] = perms.deny;
    for (const needle of [
      'Bash(git push *)', 'PowerShell(git push *)', 'Bash(git reset --hard *)', 'Bash(git clean *)',
      'Bash(supabase *)', 'Bash(npx supabase *)', 'Bash(curl *)', 'Bash(wget *)',
      'mcp__supabase__*', 'Read(/.env*)', 'Edit(/.claude/settings*.json)', 'Edit(/.claude/hooks/**)',
    ]) expect(deny, `missing deny rule ${needle}`).toContain(needle);
  });
  test('the default Playwright config (hosted login) is not allowed, only the logic config', () => {
    const pw = perms.allow.filter((r: string) => /^(Bash|PowerShell)\(.*playwright/.test(r));
    expect(pw.length).toBeGreaterThan(0);
    for (const r of pw) expect(r).toContain('playwright.logic.config.ts');
  });
  test('project settings never auto-approve project MCP servers', () => {
    expect(settings.enableAllProjectMcpServers).toBe(false);
    expect(settings.enabledMcpjsonServers).toBeUndefined();
  });
  test('the guard hook is registered for Bash and PowerShell and the script exists', () => {
    const entries = settings.hooks.PreToolUse;
    expect(entries.length).toBe(1);
    expect(entries[0].matcher).toBe('Bash|PowerShell');
    const hook = entries[0].hooks[0];
    expect(hook.type).toBe('command');
    expect(hook.command).toContain('.claude/hooks/guard.cjs');
    expect(fs.existsSync(nodePath.join(ROOT, '.claude', 'hooks', 'guard.cjs'))).toBe(true);
  });
});

test.describe('repo configuration', () => {
  test('.mcp.json pins firecrawl-mcp to an exact version', () => {
    const mcp = JSON.parse(read('.mcp.json'));
    const args: string[] = mcp.mcpServers.firecrawl.args;
    const spec = args.find((a) => a.startsWith('firecrawl-mcp'));
    expect(spec).toMatch(/^firecrawl-mcp@\d+\.\d+\.\d+$/);
  });
  test('settings.local.json is git-ignored and not tracked', () => {
    expect(read('.gitignore')).toMatch(/^\.claude\/settings\.local\.json$/m);
    const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '.claude/settings.local.json'], { encoding: 'utf8' }).trim();
    expect(tracked).toBe('');
  });
  test('/ship and /sync never run push, pull, install or reset as steps', () => {
    for (const f of ['.claude/commands/ship.md', '.claude/commands/sync.md']) {
      const text = read(f);
      expect(text, f).toMatch(/^description:/m);
      // A step line is a backticked command; "Never run ..." lines are prohibitions.
      const runnable = text.split('\n').filter((l) => !/never|do not|don't/i.test(l)).join('\n');
      expect(runnable, f).not.toMatch(/`git (push|pull|reset|clean|rebase)\b/);
      expect(runnable, f).not.toMatch(/`npm install\b/);
    }
  });
  test('/sync uses fetch and fast-forward only; /ship avoids the hosted-login Playwright config', () => {
    const sync = read('.claude/commands/sync.md');
    expect(sync).toContain('git fetch --prune origin');
    expect(sync).toContain('git merge --ff-only @{u}');
    const ship = read('.claude/commands/ship.md');
    expect(ship).toContain('playwright.logic.config.ts');
    expect(ship).toMatch(/do not run it yourself/i);
  });
});
