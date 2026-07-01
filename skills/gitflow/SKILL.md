---
name: gitflow
description: The project's git branch & deploy discipline. Use PROACTIVELY and follow it WHENEVER you are about to commit, push, merge, tag, or deploy — or when the user says "commit", "push", "залей", "выкати", "deploy", "merge". Core rule: all new work goes to the `dev` branch by default; the `main`/`master` branch is updated ONLY on the user's explicit approval. Invoke with /gitflow to review the policy.
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

1. **All new work goes to `dev` by default.** Whenever you commit or push and the user did **not** explicitly name a target branch, the destination is `dev` — never `main`/`master`.
   - If `dev` does not exist yet, create it from the current work: `git switch -c dev` (or `git checkout -b dev`), then push it: `git push -u origin dev`.
   - If you are currently on `main`/`master` with uncommitted or just-committed work, move it to `dev` before pushing: create/switch to `dev` and push there. Do not push `main`.

2. **`main`/`master` is updated ONLY on the user's explicit approval.** "Explicit" means the user clearly said so in words like *"выкатывай в main"*, *"мержи в main"*, *"push to main"*, *"release to prod"*. Ambiguous requests ("залей изменения", "запушь это") are **not** main approval — they mean `dev`.
   - Even with a clear verbal go-ahead, the guard hook requires an authorization token. So when the user approves a main release: **ask them to run `/main-push`** (it opens a 15-minute window covering the main merge and push), then perform the merge/push. Do not attempt to bypass or self-authorize.
   - Never merge `dev → main` on your own initiative, even if everything looks green.

3. **Deploy order** (when the project has a deploy step): push to `dev` → deploy to the test/staging environment → **wait for the user to confirm** it works → only then (with `/main-push`) merge to `main` → deploy to prod. If the project ships deploy scripts, use them instead of manual restart/rsync.

## How to act on a commit/push request

- **Default (no branch named):** ensure you are on `dev` (create it if missing), commit there, `git push origin dev`. Report which branch you pushed to.
- **User explicitly wants main:** confirm you understood it as a main release, ask them to run `/main-push`, then merge/push to `main`. If they haven't approved, stay on `dev` and say so.
- **Before any push:** sanity-check you are not about to push `main` unintentionally — run `git rev-parse --abbrev-ref HEAD` if unsure.

## Standing hygiene (applies alongside this flow)

- Commit/push under the identity the project uses; do not invent a different author.
- Never commit or push secrets (keys, tokens, passwords, private hosts) — the `secret-guard` hook backs this up, but check `git diff --cached` first.
- Keep commit messages concise and factual (what changed + why).

When in doubt about which branch, the answer is **`dev`**. `main` waits for an explicit word from the user.
