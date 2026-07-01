---
description: Authorize pushing/merging to the protected branch (main/master) for a 15-minute release window. The git-flow guard blocks main operations by default; run this first to release. /main-push or /main-push on = authorize (15 min window, covers merge+push); /main-push off = revoke; /main-push status = check.
argument-hint: '[on | off | status]'
---

The main-authorization has already been applied deterministically by the shell below — act on its result, do not re-run it yourself:

!{bash "$HOME/.qwen/commands/_main-push.sh" {{args}}}

Based on `MAIN_PUSH_RESULT`:
- **AUTHORIZED**: confirm briefly that main is unlocked for the next 15 minutes, then carry out the release the user asked for, following `/gitflow`'s exact sequence: `git switch main` + `git pull origin main` → `git merge dev` → `git push origin main` → `git switch dev` (never keep working on `main`; the window auto-expires; revoke early with `/main-push off`).
- **revoked / NOT authorized**: confirm the current state; main pushes/merges remain blocked until the user runs `/main-push`.

User argument: {{args}}
