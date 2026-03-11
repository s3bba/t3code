# Fork Sync Runbook

1. Fetch and sync `main`:
   - `git checkout main`
   - `git fetch --all --prune`
   - `git merge --no-edit upstream/main`
   - `git push origin main`

2. Rebase all local `feat/*` and `fix/*` branches onto `main`, then force-push:
   - `for b in $(git for-each-ref --format='%(refname:short)' refs/heads/feat refs/heads/fix | sort); do git checkout "$b" && git rebase main && git push --force-with-lease origin "$b"; done`
   - `git checkout main`

3. Build/update `stacks/all` from `main` with all rebased `feat/*` + `fix/*` commits:
   - `git checkout -B stacks/all main`
   - cherry-pick branch tips in desired order:
     - `git cherry-pick feat/nix-flake-support`
     - `git cherry-pick feat/nix-flake-devshell-integration`
     - `git cherry-pick feat/ctrl-enter-send`
     - `git cherry-pick fix/session-resume`
   - update nix hashes, so package can be installed from `stacks/all` branch
   - `git push --force-with-lease origin stacks/all`
   - `git checkout main`

4. Upstream overlap check (report result):
   - For each `feat/*` and `fix/*`, check if features and fixes have been added upstream, (NOTE: the upstream will probably create their own fix, so it probably won't be 1:1 match)
