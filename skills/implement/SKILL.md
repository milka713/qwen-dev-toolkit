---
name: implement
description: Build a feature or whole project to completion without losing context. The main session stays an architect — it decomposes the work and delegates each chunk to fresh implementer subagents, keeping its own context small so large projects finish instead of stalling at ~15% after a compaction. Use PROACTIVELY for any multi-step or multi-file build, "implement X", "build me a Y", "finish this project". Invoke with /implement or /implement <what to build>.
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

## Step 3 — Decompose into small, "quantized" tasks

Break the goal into the **smallest cohesive, independently-verifiable units** — and prefer **more, smaller tasks over fewer big ones**. A local model handles a tight, well-scoped task far more reliably than a broad one, so err on the side of finer granularity. A good task is roughly **one engineer "quantum"**: a single function or method + its test, one endpoint, one small class, one migration, one config wiring — something finishable in a few minutes and a few dozen-to-a-couple-hundred lines, well under a subagent's context.

- ✅ "Implement `Money.add`/`subtract` with overflow checks + unit tests" (one unit)
- ✅ "Add the `POST /todos` handler wired to the existing model, with one integration test"
- ⚠️ "Build the todos CRUD" → too coarse; split into create / read / update / delete, each its own task
- ❌ "Build the backend" (will overflow the subagent — the exact failure we avoid)

**Be smart, not mechanical:** each task must still be a meaningful, testable increment — don't fragment into trivial micro-steps ("create empty file", "add import") that add coordination overhead without value. Aim for the smallest piece that is worth verifying on its own.

Order tasks so each builds on verified prior work, and write the full list into `Task plan`. A long, dependency-ordered chain of small tasks is exactly the point — it's what keeps every subagent inside its budget and the main context tiny.

## Step 4 — Delegate tasks one at a time

For each task, in order, call the `agent` tool with `subagent_type: "implementer"`. **Use a named/awaitable subagent so its summary returns to you inline — do NOT use `subagent_type: "fork"`** (forks never report back, so you could not track progress).

Write each delegation prompt to be **self-contained but short**:
- State the one task and its acceptance criteria.
- Point to the relevant files/dirs by path (from the Scout digest) and the conventions to follow — do **not** paste large file contents; the implementer reads them itself.
- Give the exact verification command to run if you know it.
- Carry forward only the decisions/gotchas that matter for this task.

Run tasks **sequentially by default** (later tasks usually depend on earlier ones). Only batch a few in parallel when they are genuinely independent and touch different files — and if a **"Subagent limit — at most N at a time"** block is in your context (set via `/maxagents`), never exceed N awaitable subagents in one response (N=1 means strictly one at a time). This keeps a resource-constrained local model from being overwhelmed.

## Step 5 — Record the result, then continue

As soon as an implementer returns, and **before you delegate the next task**, update `.qwen/PROGRESS.md` — this is a required step, not optional bookkeeping:
1. Read its `STATUS`/`SUMMARY`/`VERIFIED`/`FOLLOW-UPS`/`NOTES`.
2. **Tick the task's checkbox `- [ ]` → `- [x]`** in the Task plan, append a one-line Log entry (outcome + files + how verified), and add any NOTES to Gotchas. The checkboxes are the **recovery anchor**: if a compaction or restart happens, the next session re-reads this file and continues from the first unchecked `- [ ]` — an unticked finished task means it gets needlessly redone, and a falsely-ticked one means it gets skipped. Keep them honest and current.
3. If `STATUS: partial`, add the reported FOLLOW-UPS as new unchecked tasks and re-delegate them as fresh subagents — never let a half-done task linger.
4. If `STATUS: blocked`, surface the blocker to the user if it needs their input; otherwise delegate a focused investigation/fix task.

Update this file after **every** task, not in a batch at the end. Do **not** accumulate full implementer transcripts in your context; the one-line Log entry is enough.

## Step 6 — Integration verification

After the task plan is complete, run (or delegate) one end-to-end check that the pieces work together: build the whole thing, run the full test suite, or actually launch/exercise the app against the acceptance criteria from Step 1.

Run the suite the way a fresh checkout / CI would — the **canonical command from the repo root** (bare `pytest`, `npm test`, `cargo test`, `make test`), not an environment shortcut like `python -m pytest` or a hand-set `PYTHONPATH`. A green result that depends on such a shortcut is not a pass; it means the project is mis-packaged (a subagent that "verified" with a path trick can mask this). Fix the packaging so the standard command is green from a clean root, then re-run it.

Run the project's checks as an **ordered quality gate** — **build/typecheck → lint → tests** — and stop to fix on the first failure before continuing. When the build is non-trivial, finish with a code-quality pass using the built-in `/review` (correctness/quality review) and `/simplify` (safe cleanup) skills; and if it touches authentication, the network, files, secrets, or a database, run `/audit` (security) before reporting done. Fix or re-delegate anything that fails. Only then report completion.

If **test-first / coverage mode** is active (a "Test-coverage / TDD mode" block is in your context — it states the target %, default 80%), every task delegation must require tests, and this final step must measure coverage with the project's real tool and confirm it meets that target — below target or failing tests means keep working, not "done".

## Step 7 — Report to the user

Summarize: what was built, where it lives, how it was verified, and anything left open. Point them at `.qwen/PROGRESS.md` for the full trail.

## If interrupted or resumed

On a fresh invocation where `.qwen/PROGRESS.md` already exists, read it first and continue from the first unchecked task — do not restart or redo finished work.

---
The user's argument (what to build), if any, follows. Treat it as the goal for Step 1.
