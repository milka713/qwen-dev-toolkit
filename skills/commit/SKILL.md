---
name: commit
description: Stage and commit the current work with a clean Conventional-Commits message written from the actual diff. Use PROACTIVELY when the user says "commit", "закоммить", "сделай коммит", or after a change is finished. Respects the gitflow policy (commits land on `dev`, never `main`, unless the user explicitly released). Invoke with /commit or /commit <hint>.
priority: 25
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
---

# /commit — a good commit from the real diff

Write the message from what actually changed, not from a guess. Keep it honest and small.

## Steps

1. **See the state.** Run `git status --short` and `git diff` (and `git diff --cached` if things are already staged). If there is nothing to commit, say so and stop.
2. **Branch check (gitflow).** You are committing to the **current** branch, which should be `dev` or a feature branch — never `main`/`master`. If `git rev-parse --abbrev-ref HEAD` is `main`/`master`, follow the [[gitflow]] policy: move the work to `dev` first (`git switch -c dev` if it does not exist) before committing. Do not commit straight onto the protected branch.
3. **Stage deliberately.** Stage the files that belong to this change (`git add <paths>`). Do **not** `git add -A` blindly — leave unrelated edits, build output, and anything that looks like a secret or local config out. The `secret-guard` hook will block an obvious secret, but you check first with `git diff --cached`.
4. **Write the message** in Conventional Commits form:
   - Header: `type(scope): summary` — ≤ 72 chars, imperative mood, lowercase summary.
   - `type` ∈ `feat, fix, refactor, docs, test, chore, perf, build, ci`. Pick from what the diff actually does.
   - Optional body (wrap ~72 cols): *why* the change was made and any non-obvious consequence — only if it adds information the header doesn't.
   - If a hint was passed as the argument, use it to steer the summary, but still ground it in the diff.
   - One logical change per commit. If the diff is really two unrelated things, make two commits.
5. **Commit** with the message. Prefer a real multi-line message via repeated `-m` (header, then body) so it is readable in `git log`.
6. **Report** the short hash, the header line, and which branch it landed on. Do **not** push unless the user asked — pushing is [[gitflow]]'s job (and `main` needs `/main-push`).

## Guardrails

- Never invent a scope or a change that isn't in the diff.
- Never commit secrets, `.env`, keys, or large generated artifacts.
- Use the repo's existing author/identity; don't set a different one.
- Match the repo's existing commit style if it clearly differs from Conventional Commits (look at recent `git log --oneline`).

The user's optional hint (a scope or focus for the summary) follows.
