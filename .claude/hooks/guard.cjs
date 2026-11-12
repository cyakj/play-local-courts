#!/usr/bin/env node
'use strict';
/**
 * Claude Code PreToolUse guard for Bash and PowerShell tool calls.
 *
 * Purpose: let long autonomous LOCAL development run without prompts, while
 * refusing commands that push, rewrite or discard Git history/work, deploy, or
 * change hosted services (Supabase etc.).
 *
 * Why a hook and not only permission rules: deny rules match command PREFIXES,
 * so `git -C . push`, `sh -c "git push"` or `/usr/bin/curl` slip past them.
 * This guard tokenizes the command (quotes, separators, `$()` and backticks,
 * wrappers like timeout/env, nested shells, npx/pnpx/bunx) and checks the real
 * program and sub-command.
 *
 * Contract (Claude Code hooks): reads one JSON object on stdin
 * ({ tool_name, tool_input: { command }, cwd, ... }). Exit 2 blocks the call and
 * shows stderr to Claude. Exit 0 lets normal permission rules decide. Any
 * internal error blocks (fail closed) so a bug is noticed instead of silent.
 *
 * LIMITS (best effort, not a sandbox): code that does the forbidden thing from
 * inside another interpreter (`node -e`, a Python script, an npm script) is not
 * inspected. Native Windows has no OS sandbox. See docs/CLAUDE-CODE-PERMISSIONS.md.
 */
const cp = require('child_process');
const path = require('path');

// Commits/merges onto these branches must be made by the user, not an agent.
const PROTECTED_BRANCHES = ['main', 'master', 'v1/overnight-integration'];

const HOSTED_OR_DEPLOY = new Set([
  'supabase', 'eas', 'eas-cli', 'vercel', 'netlify', 'netlify-cli', 'firebase', 'firebase-tools',
  'wrangler', 'flyctl', 'fly', 'heroku', 'aws', 'gcloud', 'az', 'doctl', 'railway', 'terraform',
  'pulumi', 'kubectl', 'helm',
]);
const NETWORK = new Set([
  'curl', 'wget', 'iwr', 'irm', 'invoke-webrequest', 'invoke-restmethod', 'start-bitstransfer',
  'ssh', 'scp', 'sftp', 'ftp', 'telnet', 'nc', 'ncat', 'netcat', 'socat',
]);
const DB_CLIENTS = new Set(['psql', 'pg_dump', 'pg_dumpall', 'pg_restore', 'mysql', 'mongosh', 'redis-cli', 'sqlcmd']);
const SYSTEM = new Set(['format', 'diskpart', 'dd', 'shutdown', 'reboot', 'restart-computer', 'stop-computer', 'mkfs', 'fdisk', 'bcdedit']);
const FILE_READERS = new Set([
  'cat', 'type', 'more', 'less', 'head', 'tail', 'sed', 'awk', 'grep', 'egrep', 'fgrep', 'rg', 'findstr',
  'select-string', 'sls', 'get-content', 'gc', 'copy', 'cp', 'copy-item', 'xcopy', 'strings', 'od', 'xxd', 'certutil',
]);
const WRAPPERS = new Set(['timeout', 'time', 'nice', 'nohup', 'stdbuf', 'command', 'builtin', 'env', 'sudo', 'xargs', 'exec', 'call']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'cmd', 'powershell', 'pwsh', 'wsl']);
const RUNNERS = new Set(['npx', 'pnpx', 'bunx']);
const PUBLISH_SUBCOMMANDS = new Set(['publish', 'unpublish', 'deprecate', 'dist-tag', 'owner', 'access', 'adduser', 'login', 'logout', 'token']);
const MUTATES_BRANCH = new Set(['commit', 'merge', 'cherry-pick', 'revert', 'am']);

const deny = (reason) => ({ reason });
const prog = (tok) => tok.split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1|com)$/, '');
const isAssign = (t) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(t);
const isEnvFile = (a) => /^\.env(?!\.(example|sample|template)$)/i.test(a.split(/[\\/]/).pop());

/** Split a command line into simple commands (arrays of unquoted tokens). */
function splitCommands(src) {
  const out = [];
  let cur = [];
  let tok = '';
  let has = false;
  let q = null;
  const pushTok = () => { if (has) cur.push(tok); tok = ''; has = false; };
  const endCmd = () => { pushTok(); if (cur.length) out.push(cur); cur = []; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q === '"' && c === '\\' && src[i + 1] === '"') { tok += '"'; i++; continue; } // \" inside double quotes
    if (q) { if (c === q) q = null; else tok += c; continue; }
    if (c === "'" || c === '"') { q = c; has = true; continue; }
    if (';|&\n\r(){}'.includes(c)) { endCmd(); continue; }
    if (c === ' ' || c === '\t') { pushTok(); continue; }
    tok += c; has = true;
  }
  endCmd();
  return out;
}

/** Contents of $(...) and `...` anywhere in the string (even inside double quotes). */
function substitutions(src) {
  const found = [];
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] === '$' && src[i + 1] === '(') {
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth > 0) { if (src[j] === '(') depth++; else if (src[j] === ')') depth--; j++; }
      found.push(src.slice(i + 2, depth === 0 ? j - 1 : j));
    }
  }
  const bt = src.split('`');
  for (let k = 1; k < bt.length; k += 2) found.push(bt[k]);
  return found;
}

function stripPrefix(tokens) {
  const t = tokens.slice();
  while (t.length) {
    if (isAssign(t[0])) { t.shift(); continue; }
    const p = prog(t[0]);
    if (!WRAPPERS.has(p)) break;
    t.shift();
    while (t.length && (t[0].startsWith('-') || isAssign(t[0]) || (p === 'timeout' && /^[0-9.]+[smhd]?$/.test(t[0])))) {
      const f = t.shift();
      if ((p === 'nice' && f === '-n') || (p === 'sudo' && (f === '-u' || f === '-g'))) t.shift();
    }
  }
  return t;
}

/** Inner command string of `bash -c "..."`, `cmd /c ...`, `powershell -Command ...`, `-EncodedCommand`. */
function shellPayload(p, args) {
  const lower = args.map((a) => a.toLowerCase());
  for (let i = 0; i < args.length; i++) {
    const a = lower[i];
    if (/^-[a-z]*c$/.test(a) && (p === 'bash' || p === 'sh' || p === 'zsh' || p === 'dash' || p === 'ksh')) return args.slice(i + 1).join(' ');
    if (a === '/c' || a === '/k') return args.slice(i + 1).join(' ');
    if (a === '-command' || a === '-c' || a === '-commandwithargs') return args.slice(i + 1).join(' ');
    if (a === '-enc' || a === '-e' || a === '-encodedcommand') {
      try { return Buffer.from(args[i + 1] || '', 'base64').toString('utf16le'); } catch { return ''; }
    }
  }
  if (p === 'wsl') { const d = lower.indexOf('--'); return args.slice(d >= 0 ? d + 1 : 0).join(' '); }
  return null;
}

function pkgName(spec) {
  const at = spec.startsWith('@') ? spec.indexOf('@', 1) : spec.indexOf('@');
  return at > 0 ? spec.slice(0, at) : spec;
}

function currentBranch(dir) {
  try {
    return cp.execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    }).trim();
  } catch { return ''; }
}

function checkGit(args, ctx) {
  const GLOBAL_WITH_VALUE = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix']);
  let i = 0;
  let dir = ctx.cwd;
  while (i < args.length && args[i].startsWith('-')) {
    const f = args[i];
    if (f === '-C' && args[i + 1]) dir = path.resolve(dir, args[i + 1]);
    i += GLOBAL_WITH_VALUE.has(f) ? 2 : 1;
  }
  const sub = (args[i] || '').toLowerCase();
  const rest = args.slice(i + 1);
  // Git options are case-sensitive (-b creates a branch, -B force-resets one), so match raw tokens.
  const r = rest;
  const has = (...f) => f.some((x) => r.includes(x));

  switch (sub) {
    case 'push': case 'send-pack': return deny('git push is blocked. Pushing is done by the user: git push -u origin <branch>');
    case 'pull': return deny('git pull can merge or rebase silently. Use: git fetch --prune origin, then git merge --ff-only @{u}');
    case 'rebase': return deny('git rebase rewrites history and is blocked');
    case 'filter-branch': case 'filter-repo': case 'update-ref': case 'gc': case 'prune': case 'replace':
      return deny(`git ${sub} rewrites or destroys history objects and is blocked`);
    case 'reflog': if (has('expire', 'delete')) return deny('git reflog expire/delete is blocked'); break;
    case 'reset': if (has('--hard', '--merge', '--keep')) return deny('git reset --hard/--merge/--keep discards work and is blocked'); break;
    case 'clean': if (!has('-n', '--dry-run')) return deny('git clean deletes untracked files and is blocked (use -n to preview)'); break;
    case 'checkout':
      if (has('--', '.', '-f', '--force', '-B')) return deny('git checkout that discards or overwrites work is blocked. Use git switch for branches');
      break;
    case 'switch': if (has('--discard-changes', '-f', '--force', '-C', '--force-create')) return deny('git switch that discards or overwrites work is blocked'); break;
    case 'restore': if (!has('--staged', '-S') || has('--worktree', '-W') || r.some((a) => a === '-s' || a.startsWith('--source'))) return deny('git restore on the working tree discards edits and is blocked (only --staged is allowed)'); break;
    case 'branch': if (has('-d', '-D', '--delete', '-f', '--force', '-M')) return deny('deleting or force-moving branches is blocked'); break;
    case 'tag': if (has('-d', '--delete', '-f', '--force')) return deny('deleting or moving tags is blocked'); break;
    case 'stash': if (has('drop', 'clear')) return deny('git stash drop/clear is blocked'); break;
    case 'remote': if (r.length && !has('-v', 'show', 'get-url')) return deny('changing remotes is blocked'); break;
    case 'config': {
      const readFlags = has('--get', '--get-all', '--get-regexp', '--list', '-l', '--show-origin', '--show-scope', '--name-only');
      const writeFlags = has('--unset', '--unset-all', '--add', '--replace-all', '--edit', '-e', '--rename-section', '--remove-section', '--global', '--system');
      const positional = rest.filter((a) => !a.startsWith('-')).length;
      if (!readFlags && (writeFlags || positional >= 2)) return deny('writing git config is blocked');
      break;
    }
    default: break;
  }

  if (sub === 'merge' && !has('--ff-only', '--abort')) return deny('git merge is only allowed as: git merge --ff-only <ref>');
  if (MUTATES_BRANCH.has(sub) && !has('--abort')) {
    const branch = ctx.currentBranch ? ctx.currentBranch(dir) : currentBranch(dir);
    if (branch && PROTECTED_BRANCHES.includes(branch)) {
      return deny(`git ${sub} on protected branch '${branch}' is blocked. Create a feature branch: git switch -c <name>`);
    }
  }
  return null;
}

function isRecursiveDelete(p, args) {
  const l = args.map((a) => a.toLowerCase());
  const shortCluster = (a) => /^-[a-z]{1,4}$/.test(a) && a.includes('r');
  const psRecurse = (a) => /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/.test(a);
  if (p === 'rm' || p === 'remove-item' || p === 'ri') return l.some((a) => shortCluster(a) || psRecurse(a) || a === '--recursive');
  if (p === 'del' || p === 'erase' || p === 'rd' || p === 'rmdir') return l.includes('/s') || l.some(psRecurse);
  if (p === 'rimraf' || p === 'del-cli') return true;
  if (p === 'find') return l.includes('-delete');
  return false;
}

function checkSimple(tokens, ctx, depth) {
  const p = prog(tokens[0]);
  const args = tokens.slice(1);
  const lower = args.map((a) => a.toLowerCase());

  if (SHELLS.has(p)) {
    const inner = shellPayload(p, args);
    return inner ? analyze(inner, ctx, depth + 1) : null;
  }

  if (RUNNERS.has(p) || ((p === 'npm' || p === 'pnpm' || p === 'yarn') && (lower[0] === 'exec' || lower[0] === 'dlx'))) {
    const start = RUNNERS.has(p) ? 0 : 1;
    for (let i = start; i < args.length; i++) {
      const a = args[i];
      if (a === '-c' || a === '--call') return analyze(args[i + 1] || '', ctx, depth + 1);
      if (a === '-p' || a === '--package') { i++; continue; }
      if (a === '--') continue;
      if (a.startsWith('-')) continue;
      return checkSimple([pkgName(a), ...args.slice(i + 1)], ctx, depth + 1);
    }
    return null;
  }

  if (HOSTED_OR_DEPLOY.has(p)) return deny(`'${p}' can modify hosted services or deploy. Run it yourself after review`);
  if (NETWORK.has(p)) return deny(`'${p}' network access from the shell is blocked (use WebFetch for docs)`);
  if (SYSTEM.has(p)) return deny(`'${p}' is a system-level destructive command and is blocked`);
  if (DB_CLIENTS.has(p)) {
    const joined = args.join(' ');
    const hostIdx = lower.findIndex((a) => a === '-h' || a === '--host');
    const host = hostIdx >= 0 ? lower[hostIdx + 1] || '' : '';
    const remoteHost = host && !/^(localhost|127\.0\.0\.1|::1)$/.test(host);
    const remoteUrl = /(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/(?!(localhost|127\.0\.0\.1|\[::1\]))/i.test(joined);
    if (/supabase/i.test(joined) || remoteHost || remoteUrl) return deny('database clients may only target a local database, never a hosted one');
  }
  if (p === 'gh' && !(args.length === 1 && lower[0] === '--version')) return deny('GitHub CLI can push, merge or delete remotely and is blocked');
  if ((p === 'npm' || p === 'pnpm' || p === 'yarn' || p === 'bun') && PUBLISH_SUBCOMMANDS.has(lower[0])) return deny(`'${p} ${lower[0]}' publishes or changes registry state and is blocked`);
  if (p === 'expo' && ['publish', 'submit', 'login', 'logout'].includes(lower[0])) return deny(`'expo ${lower[0]}' is blocked`);
  if (isRecursiveDelete(p, args)) return deny('recursive/bulk deletion is blocked. Ask the user to run it');
  if (FILE_READERS.has(p) && args.some(isEnvFile)) return deny('.env files hold secrets. Use: node scripts/env-check.cjs (reports names and presence only)');
  if (p === 'git') return checkGit(args, ctx);
  return null;
}

/** Drop heredoc bodies and PowerShell here-strings: they are data (commit messages, file text), not commands. */
// A heredoc whose header names a shell (`bash <<EOF`, `cat <<EOF | sh`) is executed, so it is kept and inspected.
const SHELL_HEADER = /\b(bash|sh|zsh|dash|ksh|pwsh|powershell|cmd)(\.exe)?\b/i;
function stripDataBlocks(src) {
  const out = src.replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, '@x');
  const re = /<<[-~]?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n/g;
  let result = '';
  let pos = 0;
  let m;
  while ((m = re.exec(out))) {
    const lineStart = out.lastIndexOf('\n', m.index) + 1;
    const header = out.slice(lineStart, m.index + m[0].length);
    const bodyStart = m.index + m[0].length;
    const e = new RegExp(`^[ \\t]*${m[2]}[ \\t]*$`, 'm').exec(out.slice(bodyStart));
    const bodyEnd = e ? bodyStart + e.index : out.length;
    if (!SHELL_HEADER.test(header)) {
      result += out.slice(pos, bodyStart);
      pos = bodyEnd;
      re.lastIndex = bodyEnd;
    }
  }
  return result + out.slice(pos);
}

function analyze(srcRaw, ctx, depth = 0) {
  const src = stripDataBlocks(srcRaw);
  if (depth > 4) return deny('command nesting is too deep to inspect');
  for (const inner of substitutions(src)) {
    const r = analyze(inner, ctx, depth + 1);
    if (r) return r;
  }
  for (const raw of splitCommands(src)) {
    const t = stripPrefix(raw);
    if (!t.length) continue;
    const r = checkSimple(t, ctx, depth);
    if (r) return r;
  }
  return null;
}

/** Returns null when the command is acceptable to this guard, else { reason }. */
function evaluate(command, ctx = {}) {
  return analyze(command, { cwd: ctx.cwd || process.cwd(), currentBranch: ctx.currentBranch });
}

function block(msg) {
  process.stderr.write(`BLOCKED by .claude/hooks/guard.cjs: ${msg}\n`);
  process.exit(2);
}

function main() {
  let raw;
  try { raw = require('fs').readFileSync(0, 'utf8'); } catch (e) { return block(`could not read hook input (${e.message})`); }
  let input;
  try { input = JSON.parse(raw); } catch { return block('hook input was not valid JSON'); }
  if (input.tool_name !== 'Bash' && input.tool_name !== 'PowerShell') process.exit(0);
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || !command.trim()) process.exit(0);
  let verdict;
  try { verdict = evaluate(command, { cwd: input.cwd }); } catch (e) { return block(`internal error: ${e.message}`); }
  if (verdict) return block(verdict.reason);
  process.exit(0);
}

module.exports = { evaluate, PROTECTED_BRANCHES };
if (require.main === module) main();
