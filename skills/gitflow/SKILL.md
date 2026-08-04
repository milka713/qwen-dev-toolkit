---
name: gitflow
description: [toolkit] The project's git branch & deploy discipline. Use PROACTIVELY and follow it WHENEVER you are about to commit, push, merge, tag, or deploy — or when the user says "commit", "push", "залей", "выкати", "deploy", "merge". Core rule: all new work goes to the `dev` branch (or a feature branch) by default; the `main`/`master` branch is updated ONLY on the user's explicit approval. Invoke with /gitflow to review the policy.
priority: 30
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
  - glob
---

# gitflow — dev by default, main only on explicit approval

This is a **hard workflow policy**, not a suggestion. It protects the stable branch from accidental or premature changes by a fast, sometimes-forgetful local model. A deterministic hook (`git-branch-guard`) also enforces the main-protection part at the engine level, so trying to "just push to main" will be blocked until the user authorizes it with `/main-push` — do not fight the hook, follow the policy.

## The rule

1. **All new work goes to `dev` (or a feature branch) by default.** When the user did **not** explicitly name a target branch, the destination is `dev` — never `main`/`master`.
   - Already on `dev` or a feature branch → stay there; don't move work between branches unasked.
   - `dev` does not exist yet → create it from the current work: `git switch -c dev`, then `git push -u origin dev`.
   - On `main`/`master` with uncommitted or just-committed work → move it to `dev` before pushing. Do not push `main`.
2. **`main`/`master` is updated ONLY on the user's explicit approval.** "Explicit" means the user clearly said so: *"выкатывай в main"*, *"мержи в main"*, *"push to main"*, *"release to prod"*. Ambiguous requests ("залей изменения", "запушь это") are **not** main approval — they mean `dev`.
   - Even with a clear verbal go-ahead, the guard hook requires an authorization token: ask the user to run **`/main-push`** (**single-use** — authorizes exactly ONE *successful* push to main; the merge before it does not consume it, so one authorization covers the whole "merge dev → push" release, and a blocked/failed push does not waste it; a second successful push needs a fresh `/main-push`; an unused token expires after 15 minutes). For a run of back-to-back releases the user can instead run **`/main-push on`** (**persistent** — every main push allowed until they run `/main-push off`; no expiry). Do not attempt to bypass or self-authorize, and do not run `/main-push off` on the user's behalf.
   - Never merge `dev → main` on your own initiative, even if everything looks green.
3. **Deploy order** (when the project has a deploy step): push to `dev` → deploy to test/staging → **wait for the user to confirm** it works → only then (with `/main-push`) release to `main` → deploy to prod. If the project ships deploy scripts, use them instead of manual restart/rsync.

## How to act on a commit/push request

- **Default (no branch named):** commit on the current `dev`/feature branch (create `dev` if missing), then `git push origin <branch>`. Report which branch you pushed to.
- **Push rejected (non-fast-forward):** `git pull --rebase origin <branch>`, resolve, push again. **Never force-push** a shared branch; if the rebase conflicts beyond a trivial fix, stop and ask the user.
- **User explicitly approved a main release** — after they run `/main-push`, execute the sequence exactly:
  1. `git switch main` && `git pull origin main`
  2. `git merge dev` (resolve conflicts if trivial; otherwise stop and ask)
  3. `git push origin main`
  4. `git switch dev` — never keep working on `main`.
  - **First release (no `main` anywhere):** if `main` exists neither locally nor on the remote, step 1 fails (`fatal: invalid reference: main`). Don't loop on it — create `main` from `dev` instead: `git push origin dev:main` (or `git branch main dev` && `git push origin main`), then `git switch dev`.
  - The token is consumed only when a push to main **succeeds**, so a blocked or failed attempt does **not** waste it — fix the actual error and retry under the same authorization; only ask for a fresh `/main-push` if you need a genuinely second successful push (or the unused token expired after 15 min).
  - If the push is refused with **`Blocked by auto mode policy`** (not the `[toolkit] git-flow guard` message), that is qwen-code's Auto-Mode classifier running ahead of the hook — do not reroute around it; the user should run **`/main-push-hint`** once per machine (then restart qwen) so the classifier defers main pushes to the deterministic hook.
  - **If this main update is a release** (the `VERSION` file changed): cut the tag + GitHub Release with **`/release`** so the published release never lags the code. `/release check` reports whether main is ahead of the latest tag.
- **Before any push:** sanity-check you are not about to push `main` unintentionally — `git rev-parse --abbrev-ref HEAD` if unsure.

## Standing hygiene (applies alongside this flow)

- Commit/push under the identity the project uses; do not invent a different author.
- Never commit or push secrets (keys, tokens, passwords, private hosts) — the `secret-guard` hook backs this up, but check `git diff --cached` first.
- Keep commit messages concise and factual (what changed + why) — `/commit` does this properly.

When in doubt about which branch, the answer is **`dev`**. `main` waits for an explicit word from the user.
