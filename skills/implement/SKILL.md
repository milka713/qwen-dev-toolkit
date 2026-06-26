---
name: implement
description: Build a feature or whole project to completion without losing context. The main session stays an architect — it decomposes the work and delegates each chunk to fresh implementer subagents, keeping its own context small so large projects finish instead of stalling at ~15% after a compaction. Use for any multi-step or multi-file build, "implement X", "build me a Y", "finish this project". Invoke with /implement or /implement <what to build>.
argument-hint: '[what to build]'
priority: 20
allowedTools:
  - agent
  - read_file
  - read_many_files
  - write_file
  - edit
  - grep_search
  - glob
  - list_directory
  - run_shell_command
---

# /implement — build to completion via delegation

You are the **architect/orchestrator**. The single most important rule: **you do not write the implementation yourself.** Every chunk of real coding is delegated to a fresh `implementer` subagent. This is deliberate — the token-heavy work (reading many files, edits, build/test output) happens in *disposable* subagent contexts, so your own context stays small and the project actually reaches completion instead of overflowing, compacting, and breaking partway through.

Keep your context lean: hold only the goal, the plan, and short result summaries. Push everything else down into subagents.

## Step 1 — Capture the goal in a durable doc

Run `mkdir -p .qwen`. Since `/implement` means a real build, also turn on development mode for this project so it persists across restarts/compaction: if the project's `QWEN.md` does not already contain a `<!-- devmode:start -->` block, append the development-mode block (see the `/dev` skill) to `QWEN.md`. Pinned there, it survives compaction with no re-declaration.

Then create or update `.qwen/PROGRESS.md`. This file is the ground truth that survives any compaction or restart. Use this structure:

```markdown
# PROGRESS — <short project name>
_Updated: <YYYY-MM-DD HH:MM>. Durable state — re-read after any compaction/restart. Continue from the first unchecked task._

## 🎯 Goal
<concrete objective + acceptance criteria: what "done" means, how to verify it>

## 📐 Decisions & constraints
- <decision — why> (stack, libs, structure, things explicitly ruled in/out)

## 🗺️ Codebase map
- <path — role>   (fill from Scout; "new project" if greenfield)

## 📋 Task plan
- [ ] T1 — <small, independently-verifiable task>
- [ ] T2 — ...

## 🔄 Log
- (appended as tasks complete: outcome, files, how verified)

## ⚠️ Gotchas / open questions
- <none yet>
```

If the request is vague on anything that blocks decomposition (target stack, scope boundaries), ask the user **once**, briefly, before planning — then record the answers under Decisions.

## Step 2 — Understand the ground (delegate exploration)

If working in an existing/unfamiliar codebase, do **not** read it yourself — delegate to the `scout` subagent (`agent` tool, `subagent_type: "scout"`) with a precise question ("map how X is structured and what a change to Y must touch"). Record its digest into the `Codebase map` and `Decisions` sections. For a greenfield project, skip this.

Only read files yourself when it's a couple of small, decisive files — never bulk-read.

## Step 3 — Decompose into small tasks

Break the goal into tasks where **each task fits comfortably inside one subagent's context** (rule of thumb: a task a focused engineer finishes in well under ~60k tokens of reading+writing). Good tasks are vertical and independently verifiable:

- ✅ "Create the data model + migration for todos and a passing unit test"
- ✅ "Add the POST /todos endpoint wired to the model, with one integration test"
- ❌ "Build the backend" (too big — will overflow the subagent, the exact failure we're avoiding)

Order tasks so each builds on verified prior work. Write the full list into `Task plan`. Sequence matters more than cleverness — a dependency-ordered chain of small tasks is the whole point.

## Step 4 — Delegate tasks one at a time

For each task, in order, call the `agent` tool with `subagent_type: "implementer"`. **Use a named/awaitable subagent so its summary returns to you inline — do NOT use `subagent_type: "fork"`** (forks never report back, so you could not track progress).

Write each delegation prompt to be **self-contained but short**:
- State the one task and its acceptance criteria.
- Point to the relevant files/dirs by path (from the Scout digest) and the conventions to follow — do **not** paste large file contents; the implementer reads them itself.
- Give the exact verification command to run if you know it.
- Carry forward only the decisions/gotchas that matter for this task.

Run tasks **sequentially by default** (later tasks usually depend on earlier ones). Only batch 2-3 in parallel when they are genuinely independent and touch different files.

## Step 5 — Record the result, then continue

When an implementer returns:
1. Read its `STATUS`/`SUMMARY`/`VERIFIED`/`FOLLOW-UPS`/`NOTES`.
2. Update `.qwen/PROGRESS.md`: check off the task, append a one-line Log entry (outcome + files + how verified), and add any NOTES to Gotchas.
3. If `STATUS: partial`, add the reported FOLLOW-UPS as new tasks and re-delegate them as fresh subagents — never let a half-done task linger.
4. If `STATUS: blocked`, surface the blocker to the user if it needs their input; otherwise delegate a focused investigation/fix task.

Keep this file updated continuously — it is what makes the build survivable. Do **not** accumulate full implementer transcripts in your context; the one-line Log entry is enough.

## Step 6 — Integration verification

After the task plan is complete, run (or delegate) one end-to-end check that the pieces work together: build the whole thing, run the full test suite, or actually launch/exercise the app against the acceptance criteria from Step 1.

Run the suite the way a fresh checkout / CI would — the **canonical command from the repo root** (bare `pytest`, `npm test`, `cargo test`, `make test`), not an environment shortcut like `python -m pytest` or a hand-set `PYTHONPATH`. A green result that depends on such a shortcut is not a pass; it means the project is mis-packaged (a subagent that "verified" with a path trick can mask this). Fix the packaging so the standard command is green from a clean root, then re-run it. Fix or re-delegate anything that fails. Only then report completion.

## Step 7 — Report to the user

Summarize: what was built, where it lives, how it was verified, and anything left open. Point them at `.qwen/PROGRESS.md` for the full trail.

## If interrupted or resumed

On a fresh invocation where `.qwen/PROGRESS.md` already exists, read it first and continue from the first unchecked task — do not restart or redo finished work.

---
The user's argument (what to build), if any, follows. Treat it as the goal for Step 1.
