---
description: "[toolkit] Development-mode escape hatch — authorise ONE direct architect edit while /dev is on (normally all source is written by implementer subagents). Requires a reason, logs it to .qwen/PROGRESS.md, and is single-use (auto-expires in 15 min). Use only when delegating one tiny edit is genuinely pointless."
argument-hint: '<why delegating this one edit is pointless>'
---

The escape token has already been staged deterministically by the shell below — act on `DEVEDIT_RESULT`, do not try to bypass the guard any other way:

!{bash "$HOME/.qwen/commands/_devedit.sh" {{args}}}

Based on `DEVEDIT_RESULT`:
- **"ONE direct edit authorised"**: you may now make **exactly one** `write_file`/`edit` yourself; the next guarded write consumes the authorisation. Do only the specific edit you justified — then you are back to delegating. Prefer delegating to an `implementer`/`debugger` subagent whenever the change is more than a trivial one-liner; this hatch exists for the rare case where spinning up a subagent for one line is pure overhead.
- **"refused — a reason is required"**: nothing was authorised. Re-run with a concrete reason, or just delegate the edit to a subagent as usual.

This does not turn development mode off (use `/dev off` for that) — it only lets a single direct edit through, on the record.

User argument: {{args}}
