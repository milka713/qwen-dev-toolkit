---
description: "[toolkit] Save the durable checkpoint by hand — curate goal / decisions / done-todo into .qwen/PROGRESS.md so the work survives lossy auto-compaction, a restart or a /clear. /checkpoint = save, /checkpoint restore = reload and continue from the first unchecked task. Same procedure as the checkpoint skill, just invocable on demand."
argument-hint: '[restore]'
---

Run the **`checkpoint` skill** now — invoke it through the skill tool with the name `checkpoint`, passing the argument below. It holds the canonical procedure and the `.qwen/PROGRESS.md` template that `/plan` and `/implement` also write, so the "continue from the first unchecked task" contract keeps holding.

Do not improvise your own checkpoint format, and do not skip straight to writing the file — the value of this command is that one curated shape is used everywhere.

If the skill genuinely cannot be invoked, fall back to doing it by hand, keeping the contract intact:

- **`restore`** — read `.qwen/PROGRESS.md`, sanity-check it against `git status` / `git log --oneline -3` (where they disagree, **the working tree wins**), then restate the goal, the decisions still in force, what is done, and the first unchecked task — and continue from there.
- **save (default)** — create or merge `.qwen/PROGRESS.md` with the sections `🎯 Goal`, `📐 Decisions & constraints`, `🗺️ Codebase map`, `📋 Task plan` (`- [x]` / `- [ ]`, mid-task detail on a `↳ state:` sub-line), `🔄 Log`, `⚠️ Gotchas / open questions`. Merge into an existing file rather than clobbering it: tick the boxes that are genuinely done, refresh the `↳ state:` line, append to the Log, update the timestamp from `date '+%F %H:%M'`. Never write secrets into it — reference where they live instead.

Afterwards tell the user it is checkpointed and that it reloads automatically after a compaction or restart. If the context window was the reason for checkpointing, this is also the moment to suggest continuing heavy work through `/implement` so it does not refill immediately.

User argument: {{args}}
