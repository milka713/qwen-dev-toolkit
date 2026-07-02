---
name: gitflow
description: The project's git branch & deploy discipline. Use PROACTIVELY and follow it WHENEVER you are about to commit, push, merge, tag, or deploy — or when the user says "commit", "push", "залей", "выкати", "deploy", "merge". Core rule: all new work goes to the `dev` branch (or a feature branch) by default; the `main`/`master` branch is updated ONLY on the user's explicit approval. Invoke with /gitflow to review the policy.
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
   - Even with a clear verbal go-ahead, the guard hook requires an authorization token: ask the user to run **`/main-push`** (it opens a **15-minute window**, not consumed per command, so it covers the whole merge + push sequence). Do not attempt to bypass or self-authorize.
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
  If a step is blocked because the window expired, ask the user to run `/main-push` again — don't retry blindly.
- **Before any push:** sanity-check you are not about to push `main` unintentionally — `git rev-parse --abbrev-ref HEAD` if unsure.

## Standing hygiene (applies alongside this flow)

- Commit/push under the identity the project uses; do not invent a different author.
- Never commit or push secrets (keys, tokens, passwords, private hosts) — the `secret-guard` hook backs this up, but check `git diff --cached` first.
- Keep commit messages concise and factual (what changed + why) — `/commit` does this properly.

When in doubt about which branch, the answer is **`dev`**. `main` waits for an explicit word from the user.
