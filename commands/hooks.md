---
description: Turn the toolkit's hooks off or on when they get in the way — guards (secret-guard, git-branch-guard, release-guard, toolkit-reset-guard, the subagent cap) and non-blocking automation hooks. /hooks or /hooks status = show every hook ON/OFF; /hooks off <name> = disable one; /hooks on <name> = re-enable; /hooks off guards = disable all guards at once; /hooks off all = disable everything; /hooks on = re-enable everything. Disabling is sticky (until you turn it back on) and disabled guards are shown loudly here and in /applied so you never silently lose protection. Deterministic; global (~/.qwen).
argument-hint: '[status | off <name|guards|all> | on [<name>|all]]'
---

The hook on/off change has already been applied deterministically by the shell below — act on its result, do not re-toggle it:

!{bash "$HOME/.qwen/commands/_hooks.sh" {{args}}}

Relay the report above to the user as-is (it is already formatted). Notes when presenting:
- Hooks are **global** — off/on affects every project. Off hooks stay wired in `settings.json` but no-op via `~/.qwen/.hooks-disabled`; the change takes effect immediately (no restart needed).
- If a **guard** was just turned OFF, call that out plainly: that protection is not active until `/hooks on <name>` (e.g. with `secret-guard` off, nothing stops a hardcoded secret from being written/committed). Suggest re-enabling it when the blocking situation has passed.
- `/applied` also shows which guards are currently disabled.

User argument: {{args}}
