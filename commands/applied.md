---
description: [toolkit] Show what from the toolkit is currently applied — modes (like /dev, /cover, /bro, /maxagents, /versioning, /reality), plus the global hooks and guards/prohibitions (secret-guard, git-branch-guard, release-guard, toolkit-reset-guard, subagent limit). Read-only. /applied = this project's state (default); /applied global = the global (~/.qwen) state. Marker-block modes are per-scope; hooks and guards live globally and apply to every project.
argument-hint: '[project | global]'
---

The applied-state report has already been computed deterministically (read-only) by the shell below:

!{bash "$HOME/.qwen/commands/_applied.sh" {{args}}}

Relay the report above to the user as-is (it is already formatted). Do not run any other tools and do not change anything — this is a read-only snapshot. Notes when presenting:
- **Modes** are per-scope: `/applied` reads this project's `./QWEN.md`, `/applied global` reads `~/.qwen/QWEN.md`.
- **Guards/prohibitions and automation hooks are global** (they live in `~/.qwen/settings.json` and apply to every project, including this one) — that's why they show in both scopes.
- If the user asks how to change any of these, point them at the matching command (`/dev`, `/cover`, `/bro`, `/maxagents`, `/versioning`, `/reality`) or note that hooks/guards come with the toolkit install.

User argument: {{args}}
