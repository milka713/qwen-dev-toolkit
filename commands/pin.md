---
description: Pin an important fact (server IP/port, deploy/run command, env quirk, where credentials live) into a compaction-proof FACTS.md — always in context, never compacted, and gitignored so it can't leak to the repo. Usage: /pin <fact>, or /pin list.
---

The shell below has already applied the change deterministically — act on its result:

!{bash "$HOME/.qwen/commands/_pin.sh" "{{args}}"}

Based on `PIN_RESULT`:
- If a fact was **pinned**: confirm briefly what is now in `FACTS.md`, and note it stays in context across compaction/restarts and is gitignored (won't be committed). If the same fact is clearly already present, say so instead of duplicating.
- If it was a **list** request: present the pinned facts.

Only pin durable specifics worth always having on hand (hosts, ports, deploy commands, env quirks, credential *locations* — never the secret values themselves). Transient task state belongs in `.qwen/PROGRESS.md`, not here.

User argument: {{args}}
