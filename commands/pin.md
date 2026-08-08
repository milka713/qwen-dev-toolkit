---
description: "[toolkit] Remember ANY important info compaction-proof — server IP/port, deploy/run commands, decisions, URLs, snippets, gotchas, anything you want kept in context and surviving compaction. Stored in a gitignored project FACTS.md (won't leak to the repo). Usage: /pin <anything>, /pin list (show everything, pins nothing), /pin remove <text>, /pin clear."
argument-hint: '[<anything> | list | remove <text> | clear]'
---

The change below was applied deterministically by the shell — act on its result:

!{bash "$HOME/.qwen/commands/_pin.sh" {{args}}}

Based on `PIN_RESULT`:
- A fact was **pinned**: confirm briefly what is now remembered, and note it is gitignored (won't be committed). If a `PIN_NOTE` line is present, pass its point on honestly — the new fact is **not** in this session's loaded context and gets auto-loaded from the next session onward; for now the line in this transcript is what you have. The shell appends without checking — if the new pin duplicates an existing one, say so and offer to drop the older line (`/pin remove <text>`).
- **list** (bare `/pin`, or `list` / `show` / `status`): the pinned memory is printed between the `PIN_BEGIN` and `PIN_END` markers. **Reproduce every one of those lines to the user verbatim** — do not summarise, reorder or drop any, and never claim you cannot see them. If the count is 0, say plainly that nothing is pinned yet. This is also the reliable way to recover facts that were pinned earlier in this same session.
- **remove/clear**: confirm what was removed.

The file is `FACTS.md` in the project root — capitalised, and on Linux that spelling matters. Do not go looking for `facts.md`.

Pin durable specifics worth always having on hand (hosts/ports, deploy commands, env quirks, key decisions, credential *locations* — never the secret values themselves; the file is gitignored but still sits in the working tree as plain text). Transient task state belongs in `.qwen/PROGRESS.md`, not here. This is per-project; the file lives in the project root.

User argument: {{args}}
