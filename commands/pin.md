---
description: [toolkit] Remember ANY important info compaction-proof — server IP/port, deploy/run commands, decisions, URLs, snippets, gotchas, anything you want kept in context and surviving compaction. Stored in a gitignored project FACTS.md (won't leak to the repo). Usage: /pin <anything>, /pin list, /pin remove <text>, /pin clear.
---

The change below was applied deterministically by the shell — act on its result:

!{bash "$HOME/.qwen/commands/_pin.sh" {{args}}}

Based on `PIN_RESULT`:
- A fact was **pinned**: confirm briefly what is now remembered, and note it stays in context across compaction/restarts and is gitignored (won't be committed). The shell appends without checking — if the new pin duplicates an existing one, say so and offer to drop the older line (`/pin remove <text>`).
- **list**: present the pinned memory.
- **remove/clear**: confirm what was removed.

Pin durable specifics worth always having on hand (hosts/ports, deploy commands, env quirks, key decisions, credential *locations* — never the secret values themselves). Transient task state belongs in `.qwen/PROGRESS.md`, not here. This is per-project; the file lives in the project root.

User argument: {{args}}
