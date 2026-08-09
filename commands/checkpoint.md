---
description: "[toolkit] Save the durable checkpoint by hand — curate goal / decisions / done-todo into .qwen/PROGRESS.md so the work survives lossy auto-compaction, a restart or a /clear. /checkpoint = save, /checkpoint restore = reload and continue from the first unchecked task. Same shape as the checkpoint skill, invocable on demand."
argument-hint: '[restore]'
---

**Do this now, directly. Your FIRST tool call is the write.** This is a snapshot of what you already know, not an investigation — everything needed is in this conversation. Measured failure mode: asked to "curate" a checkpoint, a small model spends dozens of turns walking the tree with `glob`/`grep`/subagents and never writes the file at all. Do not do that.

Hard limits, in force for this command:

- **No subagents** (`agent`), no `tool_search`, no `glob`/`grep_search` sweeps, no directory walks.
- **Run no shell command at all before the file exists** — not even `date`. A shell call can raise an approval prompt, and a checkpoint that stalls waiting for one is the exact failure this command exists to avoid (measured: the run sat on `Allow execution of: 'date'?` and never wrote anything). Put your best-known date in the `_Updated:_` line, or write `_Updated: (timestamp pending)_`; correct it *after* the file is on disk if you like.
- At most **one cheap read** before writing, and only an existing `.qwen/PROGRESS.md` (so you merge instead of clobbering). Everything else waits until the file exists.
- If a section is unknown, write one honest placeholder line and move on. An imperfect checkpoint on disk beats a perfect one you ran out of time to write.

## If the argument is `restore`

Read `.qwen/PROGRESS.md`. If it does not exist, say so and stop. Otherwise sanity-check it against `git status` / `git log --oneline -3` — where they disagree, **the working tree wins** — then restate, briefly: the goal, the decisions still in force, what is done, and **the first unchecked task** (with its `↳ state:` line). Continue the work from there; do not redo completed tasks.

## Otherwise (save — the default)

`mkdir -p .qwen`, then write or update `.qwen/PROGRESS.md` in exactly this shape — the same one `/plan` and `/implement` use, so the "continue from the first unchecked task" contract keeps holding:

```markdown
# PROGRESS — <short name>
_Updated: <YYYY-MM-DD HH:MM>. Durable state — re-read after any compaction/restart. Continue from the first unchecked task._

## 🎯 Goal
<the objective + how we'll know it's done>

## 📐 Decisions & constraints
- <decision — why>  (only ones still in force)

## 🗺️ Codebase map
- <path — role>  (the files this work actually involves)

## 📋 Task plan
- [x] T1 — <finished task>
- [ ] T2 — <task underway>
  ↳ state: <what's written, what's failing, the next concrete step>
- [ ] T3 — <upcoming tasks, ordered>

## 🔄 Log
- <one line per finished task: outcome + how it was verified>

## ⚠️ Gotchas / open questions
- <traps, blockers, decisions awaiting the user>
```

Rules that matter: **merge into an existing file** rather than clobbering it (tick the boxes that are genuinely done, refresh the `↳ state:` line, append to the Log, update the timestamp — only running `date '+%F %H:%M'` once the file already exists); preserve the goal, still-relevant decisions and exact paths verbatim; drop tool-call noise and anything reconstructable from the code; **never write secrets** — reference where they live. Keep it lean: the auto-restore hook injects only the first ~12k characters.

The `checkpoint` **skill** holds the same procedure with the full rationale, and is what the model reaches for on its own. Consult it only if something here is ambiguous — do not invoke it just to re-read these instructions.

Afterwards tell the user it is checkpointed and that it reloads automatically after a compaction or restart.

User argument: {{args}}
