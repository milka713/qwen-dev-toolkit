---
description: [toolkit] Authorize ONE push to the protected branch (main/master). The git-flow guard blocks main operations by default; run this first to release. The authorization is single-use — it covers the merge and the one push, then is consumed (a second push needs running this again). /main-push or /main-push on = authorize one push; /main-push off = revoke; /main-push status = check.
argument-hint: '[on | off | status]'
---

The main-authorization has already been applied deterministically by the shell below — act on its result, do not re-run it yourself:

!{bash "$HOME/.qwen/commands/_main-push.sh" {{args}}}

Based on `MAIN_PUSH_RESULT`:
- **AUTHORIZED**: confirm briefly that main is unlocked for exactly ONE push, then carry out the release the user asked for, following `/gitflow`'s exact sequence: `git switch main` + `git pull origin main` → `git merge dev` → `git push origin main` → `git switch dev`. The authorization is consumed **only when a push to main actually succeeds** — a push that is blocked or fails does **not** waste it, so just fix the error and retry (do not ask for a fresh `/main-push` after a failed attempt). If you need a genuinely *second* successful push, the user must run `/main-push` again. Never keep working on `main`; revoke early with `/main-push off`.
  - **First release (no `main` yet):** if `main` does not exist locally *or* on the remote, do **not** `git switch main` (it fails with `fatal: invalid reference: main`). Create it from `dev` instead — e.g. `git push origin dev:main` (or `git branch main dev` then `git push origin main`) — then `git switch dev`.
  - **Blocked by "auto mode policy" (not the toolkit hook):** if the push is refused with `Blocked by auto mode policy: …` rather than the `[toolkit] git-flow guard` message, that is qwen-code's Auto-Mode classifier, which runs before the hook. Do not fight it or reroute — tell the user to run **`/main-push-hint`** once (per machine) and restart qwen so the classifier defers main pushes to the deterministic hook.
- **revoked / NOT authorized**: confirm the current state; main pushes/merges remain blocked until the user runs `/main-push`.

User argument: {{args}}
