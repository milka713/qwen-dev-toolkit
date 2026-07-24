---
description: [toolkit] DEPRECATED — folded into /status (which now also shows the active plan / development progress). Still works as an alias for one release. Prefer /status (or /status global). Read-only.
argument-hint: '[global]'
---

`/applied` is deprecated — its report is now part of `/status`. The same read-only snapshot has been computed by the shell below:

!{bash "$HOME/.qwen/commands/_applied.sh" {{args}}}

Relay the report above to the user as-is (it already starts with a short deprecation note). Do not run any other tools and do not change anything — this is a read-only snapshot. Suggest the user use `/status` (or `/status global`) from now on; it shows the same information plus the active plan/development progress.

User argument: {{args}}
