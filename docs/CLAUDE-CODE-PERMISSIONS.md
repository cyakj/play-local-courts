# Claude Code permissions for TenisX

Goal: long autonomous **local** development (edit, test, export, commit) without
prompts, while Claude cannot push, rewrite or discard Git work, deploy, or change
hosted services such as the TENISX REAL Supabase project.

## Files

| File | Role |
|---|---|
| `.claude/settings.json` (tracked) | Mode, allow and deny rules, hook registration |
| `.claude/hooks/guard.cjs` (tracked) | `PreToolUse` hook that parses every Bash/PowerShell command |
| `.claude/settings.local.json` (git-ignored) | Per-machine approvals. Never commit it |
| `.mcp.json` (tracked) | Project MCP servers. `firecrawl-mcp` is pinned to an exact version |
| `scripts/env-check.cjs` | Reports `.env` variable names and presence, never values |
| `tests/claude-guard-logic.spec.ts` | Regression tests for all of the above |
| `.claude/commands/ship.md`, `sync.md` | `/ship` verifies only; `/sync` is fetch + fast-forward only |

## What runs without a prompt

`defaultMode: acceptEdits` auto-accepts file edits and simple filesystem commands
in the repo. Claude Code's built-in read-only commands (`ls`, `cat`, `grep`,
`git status`, `git diff`, `git log`, ...) never prompt. The allow list adds:
`git add/commit/switch/branch/fetch/stash/rm/mv/cherry-pick/revert`,
`git merge --ff-only`, `npm run *`, `npm ci`, `npx expo start|export|install|config`,
`npx tsc`, the Node-only logic tests (`npx playwright test -c playwright.logic.config.ts`),
`node scripts/env-check.cjs`, the ui-ux-pro-max skill scripts, docs WebFetch for
a few domains, Firecrawl scrape/search, and the Playwright browser plugin.

Anything else prompts. Bypass mode is disabled for this repo
(`disableBypassPermissionsMode: "disable"`).

## Protections: enforced vs best effort

| Protection | Mechanism | Strength |
|---|---|---|
| No pushes, pulls, rebases, hard resets, `git clean`, discarding checkouts/restores, branch/tag deletion, remote or config changes, history rewriting | Deny rules plus the guard hook | **Best effort.** The hook catches `git -C . push`, `-c` options, wrappers, `bash -c`, `cmd /c`, `powershell -Command/-EncodedCommand`, `$()`, backticks, absolute paths and heredocs fed to a shell. It cannot see Git run from inside `node -e`, a Python script or an npm script. |
| No commits/merges onto `main`, `master`, `v1/overnight-integration` | Guard hook (checks the current branch) | Best effort, same limits |
| No pushes at all from unattended sessions | No GitHub credential is stored on the desktop (Git Credential Manager prompts interactively) | **Enforced by environment** as long as no token is saved. Signing in at a GCM prompt stores one |
| No hosted Supabase changes | Deny rules (`supabase`, `npx supabase`, `mcp__*supabase*`, `execute_sql`, `apply_migration`, `deploy_edge_function`), hook blocks DB clients pointed at non-local hosts, no Supabase MCP or CLI login exists, and `.env` holds only the RLS-limited anon key | Rules and hook are best effort. **The real boundary is credentials:** keep service-role keys, DB passwords and `supabase login` tokens off this machine |
| No deploys or publishing (EAS, Vercel, Netlify, Firebase, Wrangler, cloud CLIs, `npm publish`, `expo submit`, `gh`) | Deny rules plus hook | Best effort |
| No shell network tools (`curl`, `wget`, `Invoke-WebRequest`, `ssh`, ...) | Deny rules plus hook | Best effort (an interpreter can still open sockets) |
| No recursive deletes | Deny rules plus hook | Best effort |
| `.env` secrets are not read by Claude | `Read(/.env*)`, `Edit(/.env*)` deny rules plus hook for `cat`/`type`/`Get-Content`/`grep`/... | **Enforced for Claude's file tools and recognized shell readers.** A subprocess that opens the file itself (dotenv in tests) is not affected, which is intended |
| Claude cannot loosen its own guardrails | `Edit` deny on `.claude/settings*.json`, `.claude/hooks/**`, `.mcp.json` | **Enforced for Claude's edit tools and shell redirects.** An interpreter writing the file directly is not covered |
| Only the Node-only Playwright config runs unprompted | Allow rule is limited to `playwright.logic.config.ts` | The default config signs in to hosted Supabase and creates data, so it always prompts |
| New project MCP servers are not auto-approved | `enableAllProjectMcpServers: false`, explicit `enabledMcpjsonServers` only in local settings | Enforced |
| Firecrawl MCP supply chain | Exact pin `firecrawl-mcp@3.36.1` (npm provenance attested; 28 tools verified) | Enforced (no silent upgrades) |

Native Windows has **no OS-level sandbox** in Claude Code (sandboxing exists on
macOS, Linux and WSL2 only). For a hard boundary, run Claude Code inside WSL2
with sandboxing enabled.

The hook fails closed: if it crashes or receives malformed input it blocks the
command. If Node is missing or the hook file is deleted, the hook errors in a
non-blocking way and only the deny rules remain, so keep Node on the PATH.

## Changing the rules

Claude is denied from editing these files. Change them yourself, then run:

```
npx playwright test -c playwright.logic.config.ts tests/claude-guard-logic.spec.ts
```

To bump Firecrawl: check the new version's age and provenance, list its tools,
then edit the pin in `.mcp.json`.
