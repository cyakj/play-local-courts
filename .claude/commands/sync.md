---
description: Safely sync the current branch with its upstream (fetch + fast-forward only)
---
Bring the CURRENT branch up to date with its upstream without ever merging,
rebasing, discarding work, or touching any other branch.

1. Run `git branch --show-current` and `git status -sb`.
   - Detached HEAD: stop and report.
   - Any uncommitted change to tracked files: stop and report. Never stash,
     reset, checkout or discard anything to make the sync work.
2. Run `git fetch --prune origin`. Never run `git pull`.
3. If the branch has no upstream, report that and stop. Otherwise run
   `git rev-list --left-right --count HEAD...@{u}` and report "ahead / behind".
4. Decide from the counts:
   - 0 behind: nothing to do.
   - Behind and 0 ahead: run `git merge --ff-only @{u}`. Do this ONLY if the
     current branch is not `main`, `master` or `v1/overnight-integration`.
     On those protected branches only report the counts and print the exact
     command for the user to run themselves: `git merge --ff-only @{u}`.
   - Ahead and behind (diverged): stop and explain. Do not merge or rebase.
     The user decides.
5. If `package-lock.json` changed in the update, run `npm ci` (never `npm install`),
   then `npx expo install --check`, and report any difference.
6. Report: branch, ahead/behind before and after, files changed, and whether the
   working tree is ready for development.

Never run `git push`, `git reset`, `git clean`, `git rebase` or `git checkout --`.
