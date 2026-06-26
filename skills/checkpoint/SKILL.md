---
name: checkpoint
description: Smart, durable context compaction. Curate the important state of the current work into .qwen/PROGRESS.md so it survives the engine's lossy auto-compression, a restart, or a /clear — and reload it to recover. Use when context is getting full, before a risky long task, or when the session feels like it's forgetting earlier decisions. Invoke /checkpoint to save, /checkpoint restore to reload.
argument-hint: '[restore]'
priority: 20
allowedTools:
  - read_file
  - write_file
  - edit
  - glob
  - grep_search
  - run_shell_command
---

# /checkpoint — durable, semantic context compaction

The engine's built-in compression (at `compressAt`) is a lossy summary — it routinely drops the goal, earlier decisions, and what's already done, which is why long sessions "forget" and break. This skill does compaction the *smart* way: **you** decide what matters and write it to disk, where it survives compression, restart, and `/clear`. The SessionStart hook reloads it automatically; this skill lets you drive it on demand.

## Mode: restore

If the argument is `restore` (or the user asks to reload/recover state):

1. Read `.qwen/PROGRESS.md` (try `./.qwen/PROGRESS.md`; if absent, `glob` for `**/.qwen/PROGRESS.md` and pick the one under the current working tree).
2. If it doesn't exist, tell the user there's no checkpoint here and stop.
3. Otherwise restate, briefly: the goal, the decisions still in force, what's done, and the next unchecked task — then continue the work from there. Do not redo completed tasks.

## Mode: save (default)

Write or update `.qwen/PROGRESS.md` (`mkdir -p .qwen` first). Curate, don't dump — the value is in *selection*. Capture exactly what a competent engineer would need to resume cold, and nothing else:

```markdown
# PROGRESS — <short name>
_Updated: <YYYY-MM-DD HH:MM>. Durable state — re-read after any compaction/restart._

## 🎯 Goal
<the objective + how we'll know it's done>

## 📐 Decisions & constraints
- <decision — why>  (only ones still in force; drop superseded ones)

## 🗺️ Codebase map
- <path — role>  (the files this work actually involves)

## ✅ Done
- <what's finished — outcome + how it was verified>

## 🔄 In progress
- <the task underway and its current state: what's written, what's failing, the next concrete step>

## 📋 Next
- [ ] <upcoming tasks, ordered>

## ⚠️ Gotchas / open questions
- <traps, blockers, decisions awaiting the user, things easy to forget>
```

Rules for a good checkpoint:
- **Preserve** verbatim: the goal/acceptance criteria, every still-relevant decision, the done/todo split, exact file paths, and any gotcha. These are what compression destroys.
- **Drop**: tool-call noise, raw file dumps, dead ends already abandoned, anything reconstructable from the code on disk.
- Be specific: "auth uses JWT in `src/auth/jwt.ts`, refresh tokens not yet implemented" beats "working on auth."
- If a `.qwen/PROGRESS.md` already exists, merge into it (update timestamp, move finished items to Done, refresh In progress) rather than overwriting good history.

After saving, tell the user it's checkpointed and that it'll auto-reload after any compaction or restart. If the context was getting full, this is also the moment to suggest continuing heavy work via `/implement` (delegated subagents) so it doesn't refill.

---
Argument (if any) follows.
