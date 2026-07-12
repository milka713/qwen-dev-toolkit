---
description: 🧰 Toggle per-project Development Mode (architect + delegate to implementer subagents). /dev or /dev on = enable, /dev off = disable, /dev status = check, /dev <what to build> = enable and start building. The flag is pinned in QWEN.md so it survives compaction with no re-declaration.
---

The development-mode switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it yourself:

!{bash "$HOME/.qwen/commands/_mode-toggle.sh" devmode "$HOME/.qwen/commands/_devmode.block" "Development mode" {{args}}}

Now respond based on that `MODE_RESULT`:

- **ON and the user gave a goal** (their argument describes something to build): **build it now in this same turn — do not stop after planning and do not tell the user to run `/implement` themselves; you ARE the implement flow** (the `/implement` skill is the full protocol — follow it, including a scaffold first task on greenfield builds and escalating repeated failures to the `debugger` subagent). If `.qwen/PROGRESS.md` already has a task plan, resume from its first unchecked task instead of re-planning. Steps: `mkdir -p .qwen`, capture the goal + a decomposed, dependency-ordered task plan in `.qwen/PROGRESS.md`, then **immediately start delegating**: for each task call the `agent` tool with `subagent_type: "implementer"` (awaitable, **not** `fork`), and after each one returns **tick its `- [ ]` → `- [x]` in PROGRESS.md** before delegating the next; explore via the `scout` subagent; finish with the canonical test/build command from the repo root **and an independent contract check delegated to the `tester` subagent — give it only the acceptance criteria; it verifies each one literally (every named public API importable exactly as the spec states, CLI commands present, entry points working), not merely that the subagents' own tests passed**. **You must NOT write the source code yourself** — every source/test file is written by an implementer subagent, never by your own `write_file`/`edit` (which are only for PROGRESS.md); delegate every task even if it looks small. Keep going task after task until the build is complete and verified — writing the plan is the first step, not the deliverable. Respect any `/maxagents` limit. Use as many implementer subagents as the work needs.
- **ON with no goal** (`/dev` or `/dev on`): briefly confirm development mode is on and pinned in `QWEN.md` (so it persists across compaction/restarts), and ask for the goal or suggest `/plan <goal>`. Don't start building without a goal.
- **OFF**: confirm you'll now answer normally as a single agent.
- **status**: report ON/OFF, and if `.qwen/PROGRESS.md` exists, the goal and the next unchecked task.

User argument: {{args}}
