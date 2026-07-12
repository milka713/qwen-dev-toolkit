---
description: 🧰 Authorize ONE push to the protected branch (main/master). The git-flow guard blocks main operations by default; run this first to release. The authorization is single-use — it covers the merge and the one push, then is consumed (a second push needs running this again). /main-push or /main-push on = authorize one push; /main-push off = revoke; /main-push status = check.
argument-hint: '[on | off | status]'
---

The main-authorization has already been applied deterministically by the shell below — act on its result, do not re-run it yourself:

!{bash "$HOME/.qwen/commands/_main-push.sh" {{args}}}

Based on `MAIN_PUSH_RESULT`:
- **AUTHORIZED**: confirm briefly that main is unlocked for exactly ONE push, then carry out the release the user asked for, following `/gitflow`'s exact sequence: `git switch main` + `git pull origin main` → `git merge dev` → `git push origin main` → `git switch dev`. The push consumes the authorization, so do it once and get it right; if you need to push to main again, the user must run `/main-push` again. Never keep working on `main`; revoke early with `/main-push off`.
- **revoked / NOT authorized**: confirm the current state; main pushes/merges remain blocked until the user runs `/main-push`.

User argument: {{args}}
