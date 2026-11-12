---
description: Verify the current branch is ready to push (never pushes)
---
Check that the CURRENT branch is ready for the user to push or submit. This
command only verifies and reports. It never pushes, merges, deploys or submits.

1. Run `git branch --show-current` and `git status --short`.
   - If the branch is `main`, `master` or `v1/overnight-integration`: stop. Tell
     the user to work on a feature branch (`git switch -c <name>`). Do not commit.
   - If there are uncommitted changes: list them and stop. Do not commit or stash
     on the user's behalf unless they ask.
2. Run the checks that need no network and no hosted services:
   - `npx expo export --platform ios --output-dir <a new directory OUTSIDE the repo, for example under the system temp directory>`
   - `npx playwright test -c playwright.logic.config.ts` (Node-only logic suite).
     Never run the default Playwright config: it signs in to the hosted
     Supabase project with test accounts.
   - `npx expo install --check`
   `npx tsc` is informational only: the legacy web code produces known errors.
   Report how many of its errors are in files reachable from `src/app`.
3. Fix only failures caused by this branch's own changes, then re-run the check
   that failed. Do not touch Stage 2 hidden components. Never edit tests to make
   them pass.
4. Report: branch, commits not on the upstream (`git log --oneline @{u}..HEAD`,
   or the last 5 commits if there is no upstream), and each check's result.
5. End with the exact command for the USER to run (do not run it yourself): `git push -u origin <current-branch>`
   Pushing, merging into other branches, EAS builds,
   store submission and anything that touches the hosted Supabase project are
   the user's decision.
