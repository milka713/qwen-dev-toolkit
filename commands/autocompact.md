---
description: Control qwen-code auto-compaction (the toolkit disables it by default — /checkpoint compacts deliberately instead). /autocompact off = never auto-compact; /autocompact on = re-enable at the stable 0.7; /autocompact <0.3-0.99> = custom trigger share; /autocompact status = check. Edits ~/.qwen/settings.json deterministically; applies after a qwen-code restart.
argument-hint: '[off | on | <0.3-0.99> | status]'
---

The setting was applied deterministically by the shell below — act on its result, do not re-apply it:

!{bash "$HOME/.qwen/commands/_autocompact.sh" {{args}}}

Based on `AUTOCOMPACT_RESULT`:
- Auto-compaction **DISABLED**: confirm it, remind the user it takes effect after restarting qwen-code, and that from now on nothing compacts automatically — suggest `/checkpoint` before a long session approaches the context window.
- **ENABLED** or a **threshold set**: confirm the new trigger point and the restart requirement.
- **status / usage**: report it as-is.

User argument: {{args}}
