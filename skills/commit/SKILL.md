---
name: commit
description: Stage and commit the current work with a clean Conventional-Commits message written from the actual diff. Use PROACTIVELY when the user says "commit", "закоммить", "сделай коммит", or after a change is finished. Respects the gitflow policy (commits land on `dev`, never `main`, unless the user explicitly released). Invoke with /commit or /commit <hint>.
argument-hint: '[hint]'
priority: 25
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
---

# /commit — a good commit from the real diff

Write the message from what actually changed, not from a guess. Keep it honest and small.

## Steps

1. **See the state.** Run `git status --short` and `git diff` (plus `git diff --cached` if things are already staged). If there is nothing to commit, say so and stop.
2. **Branch check (gitflow).** Commits go on `dev` or a feature branch — never `main`/`master`. The branch-guard hook only blocks *pushes/merges*, so not committing on main is **your** job here. If `git rev-parse --abbrev-ref HEAD` says `main`/`master`:
   - `dev` missing → `git switch -c dev` (takes the uncommitted work along) and continue.
   - `dev` exists → `git switch dev`. If the switch fails because local changes conflict, **stop and ask the user** — don't improvise with stash/reset around uncommitted work.
3. **Stage deliberately.** Stage the paths that belong to this change (`git add <paths>`), including new untracked files that are part of it. Do **not** `git add -A` blindly — leave unrelated edits, build output, and anything secret-looking or local-config out. Then check what you staged: `git diff --cached --stat` (no giant generated files) and `git diff --cached` (no secrets — the `secret-guard` hook backs you up, but you check first).
4. **Write the message.** First look at `git log --oneline -10`: if the repo clearly uses a different style, match it. Otherwise use Conventional Commits:
   - Header: `type(scope): summary` — ≤ 72 chars, imperative mood, lowercase summary.
   - `type` ∈ `feat, fix, refactor, docs, test, chore, perf, build, ci` — pick from what the diff actually does.
   - Optional body (wrap ~72 cols): *why*, and any non-obvious consequence — only if it adds information the header doesn't.
   - If a hint was passed as the argument, let it steer the summary, but still ground it in the diff.
   - **One logical change per commit.** If the diff is really two unrelated things, split by files and make two commits (interactive hunk staging isn't available; if unrelated changes share one file, commit them together and say so in the body).
5. **Commit.** Prefer a real multi-line message via repeated `-m` (header, then body). If a pre-commit hook fails or reformats files: read its output, re-stage the reformatted files, retry **once**; still failing → show the user the error instead of forcing (`--no-verify` only if the user asks).
6. **Report** the short hash, the header line, which branch it landed on — and list anything you deliberately left uncommitted. Do **not** push unless the user asked: pushing is `/gitflow`'s call, and `main` needs `/main-push`.

## Guardrails

- Never invent a scope or a change that isn't in the diff.
- Never commit secrets, `.env`, keys, or large generated artifacts.
- Use the repo's existing author/identity; don't set a different one.

The user's optional hint (a scope or focus for the summary) follows.
