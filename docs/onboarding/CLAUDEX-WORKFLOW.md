# Claudex Loop workflow — TenisX signup/onboarding

Plugin: `claudex-loop@claudex-loop` v2.1.0 (user scope). Python 3.12 at
`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`. Codex CLI logged in via ChatGPT.

## Milestones

| Milestone | Builder | Plan reviewer | Final inspector | Working tree |
|---|---|---|---|---|
| 1 | Claude (`builder=claude`) | Codex | Codex (fresh session) | Main checkout, branch `greens-iphone-v1-fixes` or a feature branch cut from it |
| 2 | Codex (`builder=codex`) | Claude | Claude (fresh session) | Separate git worktree on its own branch |

## Safety rules

1. One writer per working tree at any time. Reviewers/inspectors are read-only
   (Codex `-s read-only`; Claude `Read,Glob,Grep` only).
2. Codex builds need a clean checkout. Use a worktree:
   `git worktree add ..\tenisx-native-onboarding-m2 -b onboarding/m2 <base-branch>`
   Never run Claude edits in that worktree while Codex builds.
3. Do not run milestone 1 and milestone 2 builds concurrently.
4. No commits, pushes, deploys, DB migrations, or hosted-data changes unless the
   user explicitly asks. Migrations are written to `supabase/migrations/` only and
   applied by the user.
5. Stage 1 scope only (see CLAUDE.md); never touch Stage 2 hidden components.
6. Do not commit runner diagnostics (they can contain private code/plans). Pass
   `--artifacts` outside the repo if persisting them.
7. Plan edits invalidate an approval (SHA256-bound). Re-review after changing the plan.

## Files

- Plan: `docs/onboarding/PLAN.md`
- Log: `docs/onboarding/PLAN-REVIEW-LOG.md` (append-only)

## Invoke

Milestone 1:
`/claudex-loop:claudex-loop signup/onboarding milestone 1 for TenisX, mode=full, builder=claude, rounds=3, plan=docs/onboarding/PLAN.md, log=docs/onboarding/PLAN-REVIEW-LOG.md`

Milestone 2 (from the worktree, after milestone 1 is merged/based):
`/claudex-loop:claudex-loop signup/onboarding milestone 2 for TenisX, mode=full, builder=codex, rounds=3, plan=docs/onboarding/PLAN-M2.md, log=docs/onboarding/PLAN-REVIEW-LOG.md`
