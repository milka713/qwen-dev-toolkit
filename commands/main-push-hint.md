---
description: "[toolkit] One-time per-machine setup so Auto Mode stops blocking authorized main pushes. In Auto Mode qwen-code's LLM classifier runs BEFORE the git-branch-guard hook and independently blocks main/master pushes (making up its own single-use-token bookkeeping), so even after /main-push a release is refused by auto mode policy. This adds a permissions.autoMode.hints.allow entry telling the classifier to defer main pushes to the deterministic git-branch-guard hook. Needs a qwen restart. /main-push-hint or on = add; off = remove; status = check."
argument-hint: '[on | off | status]'
disable-model-invocation: true
---

The settings edit has already been applied **deterministically** by the shell below — act on its result, do not re-run it or edit settings.json by hand:

!{bash "$HOME/.qwen/commands/_main-push-hint.sh" {{args}}}

This is a **one-time, per-machine** setup, separate from `/main-push` (which authorizes a single release). It writes one natural-language entry to `permissions.autoMode.hints.allow` in `~/.qwen/settings.json`. Why it is needed: in **Auto Mode**, qwen-code sends each shell command to an LLM classifier BEFORE the toolkit's `git-branch-guard` PreToolUse hook runs — so the classifier, not the hook, is what actually gates a `git push` to main. The classifier tends to block main pushes on its own (and, reading `/main-push`'s "single-use, then consumed" text in the transcript, invents a belief that the token is already spent), giving `Blocked by auto mode policy` even right after `/main-push`. The hint tells the classifier to approve main-flow pushes and let the deterministic hook be the real gate.

Based on `MAIN_PUSH_HINT_RESULT`:

- **added / already ON** — the hint is in place. Tell the user they must **restart qwen** for Auto Mode to re-read settings (it is `requiresRestart`); until then the current session still classifies with the old prompt. After restart, an authorized `/main-push` release will not be blocked by the classifier, while unauthorized main pushes are still denied by the `git-branch-guard` hook.
- **removed / already OFF** — the hint is not set. Warn that in Auto Mode the classifier may block even an authorized main push.
- **ON / OFF (status)** — report whether the hint is set; note it only takes effect in a qwen session started after it was set.
- **ERROR** — relay the reason verbatim (invalid or non-object settings.json, or a write failure). Do not try to patch settings.json another way.

Scope: this only affects the **Auto-Mode classifier's** view of main pushes. It does **not** weaken the deterministic protection — the `git-branch-guard` hook and the single-use `/main-push` token still gate every push to `main`/`master`. `permissions.deny`/`allow` and the git-flow policy are untouched.

User argument: {{args}}
