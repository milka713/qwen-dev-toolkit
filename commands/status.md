---
description: [toolkit] One glance at everything the toolkit is doing in THIS project — mode toggles (/dev, /cover, /bro, /maxagents, /versioning, /reality), the active plan / development progress (goal, done/remaining, next task), the global guards & automation hooks, pinned facts, and the toolkit version. Read-only. /status = this project; /status global = the global (~/.qwen) state.
argument-hint: '[global]'
---

The full toolkit-state report has already been computed deterministically (read-only) by the shell below:

!{bash "$HOME/.qwen/commands/_status.sh" {{args}}}

Relay the report above to the user as-is — it is already formatted. Do not run any other tools and do not change anything; this is a read-only snapshot. When presenting:
- The **Active plan / development** section is the live progress of `/dev` or any other plan being executed (from `.qwen/PROGRESS.md`): the goal, how many tasks are done vs remaining, and the next unchecked task. If a build is active, end by offering to continue it from that next task.
- **Modes** are per-scope: `/status` reads this project's `./QWEN.md`, `/status global` reads `~/.qwen/QWEN.md`.
- **Guards/prohibitions and automation hooks are global** (they live in `~/.qwen/settings.json` and apply to every project) — that's why they show in both scopes.
- If the user asks how to change any of these, point them at the matching command (`/dev`, `/cover`, `/bro`, `/maxagents`, `/versioning`, `/reality`).

User argument: {{args}}
