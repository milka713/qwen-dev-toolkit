---
description: Toggle per-project Development Mode (architect + delegate to implementer subagents). /dev or /dev on = enable, /dev off = disable, /dev status = check, /dev <what to build> = enable and start building. The flag is pinned in QWEN.md so it survives compaction with no re-declaration.
---

The development-mode switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it yourself:

!{bash "$HOME/.qwen/commands/_mode-toggle.sh" devmode "$HOME/.qwen/commands/_devmode.block" "Development mode" "{{args}}"}

Now respond based on that `MODE_RESULT`:

- **ON and the user gave a goal** (their argument describes something to build): start the build the `/implement` way — `mkdir -p .qwen`, capture the goal and a decomposed, dependency-ordered task plan in `.qwen/PROGRESS.md`, then delegate each small task to a fresh `implementer` subagent (awaitable, **not** `fork`), recording each result; explore via the `scout` subagent; finish with the canonical test/build command from the repo root. Use as many implementer subagents as the work needs.
- **ON with no goal** (`/dev` or `/dev on`): briefly confirm development mode is on and pinned in `QWEN.md` (so it persists across compaction/restarts), and ask for the goal or suggest `/plan <goal>`. Don't start building without a goal.
- **OFF**: confirm you'll now answer normally as a single agent.
- **status**: report ON/OFF, and if `.qwen/PROGRESS.md` exists, the goal and the next unchecked task.

User argument: {{args}}
