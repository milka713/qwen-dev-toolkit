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

## Step 0 — Resume, or fresh start?

If `.qwen/PROGRESS.md` already exists with a task plan (written by `/plan`, or left by an interrupted run), do **not** re-plan. Read it, sanity-check the first unchecked task against the tree (it may already be done on disk — the tree wins; tick it if so), then jump straight to Step 4 and continue from that task. Never restart or redo finished work.

## Step 1 — Capture the goal in a durable doc

Run `mkdir -p .qwen`. Since `/implement` means a real build, also turn on development mode for this project so it persists across restarts/compaction — one idempotent command:
`bash "$HOME/.qwen/commands/_mode-toggle.sh" devmode "$HOME/.qwen/commands/_devmode.block" "Development mode" on`

Then create or update `.qwen/PROGRESS.md`. This file is the ground truth that survives any compaction or restart. Get the timestamp from `date '+%F %H:%M'` — don't guess it. Use this structure:

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

## Step 3 — Decompose into right-sized tasks

Break the goal into **cohesive, independently-verifiable tasks — one logical module or related group of functions per task**, each with its tests. Aim for the **"Goldilocks" size**: small enough to fit comfortably in one subagent's context and be verified on its own, but not so tiny that you fragment one component across many tasks.

The right target is roughly **one source file (or one class/module) + its tests per task** — e.g. "implement `token_bucket.py` (the `TokenBucket` class) with its unit tests", "add the `POST /todos` handler + its integration test". A typical small-to-mid project is **3–6 tasks**, a larger one more — but driven by the natural module boundaries, not by a quota.

- ✅ "Implement `storage.py` (the `Storage` class: add/list/totals) + its unit tests" — one module, one task
- ✅ "Add the `report` CLI subcommand + its test"
- ⚠️ **A module and its tests are ONE task, not two.** Don't make "write `primes.py`" and "write `test_primes.py`" separate delegations — the subagent that writes the module also writes its tests, in the same task. Splitting them doubles the task count and the overhead.
- ⚠️ Over-splitting: a separate task for `mean`, another for `median`, another for `mode` of the *same* `stats.py` — this just adds coordination overhead and slows things down (empirically ~50% slower) for no quality gain. Group them: "implement `stats.py` with all its functions + tests".
- ❌ "Build the backend" — too coarse; split along module/layer boundaries.

**Why not finer:** testing showed that splitting below the module level doesn't improve correctness but is markedly slower and makes the run harder to track. Prefer the coarsest task that still fits a subagent comfortably and is independently testable.

**Make the FIRST task a scaffold** when building a package/app from scratch: set up the package layout (`__init__.py` with the exports the spec promises) and the **test-runner glue** (`pyproject.toml` with `[tool.pytest.ini_options] pythonpath=["."]`, or a root `conftest.py`; the equivalent for other languages) — plus a single trivial smoke test that runs green. This guarantees `bare pytest` works from the repo root from the very start, so the project is runnable at every intermediate point and a long build that gets interrupted still leaves a coherent, importable project (don't leave packaging for a final step that budget/time might never reach).

Order tasks so each builds on verified prior work, and write the full list into `Task plan`. A dependency-ordered chain of right-sized tasks keeps every subagent inside its budget and the main context tiny.

## Step 4 — Delegate tasks one at a time

For each task, in order, call the `agent` tool with `subagent_type: "implementer"`. **Use a named/awaitable subagent so its summary returns to you inline — do NOT use `subagent_type: "fork"`** (forks never report back, so you could not track progress).

**Do not write the code yourself.** Every source/test/config file is created or changed by an `implementer` subagent — never by your own `write_file`/`edit` in the main context (those are only for `.qwen/PROGRESS.md`). This holds even when a task looks small enough to "just do quickly": delegate it anyway. Building inline defeats the entire purpose — it fills the main context and a larger project then overflows. If you notice you're about to edit a source file directly, stop and delegate that task instead.

Write each delegation prompt to be **self-contained but short**:
- State the one task and its acceptance criteria.
- Point to the relevant files/dirs by path (from the Scout digest) and the conventions to follow — do **not** paste large file contents; the implementer reads them itself.
- Give the exact verification command to run if you know it.
- Carry forward only the decisions/gotchas that matter for this task.

Run tasks **sequentially by default** (later tasks usually depend on earlier ones). Only batch a few in parallel when they are genuinely independent and touch different files — and if a **"Subagent limit — at most N at a time"** block is in your context (set via `/maxagents`), never exceed N awaitable subagents in one response (N=1 means strictly one at a time). This keeps a resource-constrained local model from being overwhelmed.

## Step 5 — Record the result, then continue

As soon as an implementer returns, and **before you delegate the next task**, update `.qwen/PROGRESS.md` — this is a required step, not optional bookkeeping:
1. Read its `STATUS`/`SUMMARY`/`FILES`/`VERIFIED`/`FOLLOW-UPS`/`NOTES`.
2. **Tick the task's checkbox `- [ ]` → `- [x]`** in the Task plan, append a one-line Log entry (outcome + files + how verified), and add any NOTES to Gotchas. The checkboxes are the **recovery anchor**: if a compaction or restart happens, the next session re-reads this file and continues from the first unchecked `- [ ]` — an unticked finished task means it gets needlessly redone, and a falsely-ticked one means it gets skipped. Keep them honest and current.
3. If `STATUS: partial`, add the reported FOLLOW-UPS as new unchecked tasks and re-delegate them as fresh subagents — never let a half-done task linger.
4. If `STATUS: blocked`, surface it to the user if it needs their input. Otherwise — and whenever the **same task fails verification twice** — stop re-running the same implementer prompt and delegate a root-cause pass to the `debugger` subagent (`subagent_type: "debugger"`) with the exact failing command; it returns the diagnosis + minimal fix. If the diagnosis shows the task was mis-scoped, fix the task plan before continuing.

Update this file after **every** task, not in a batch at the end. Do **not** accumulate full implementer transcripts in your context; the one-line Log entry is enough (the session-restore hook injects only the first ~12k characters of this file — keep it lean).

## Step 6 — Integration verification

After the task plan is complete, run (or delegate) one end-to-end check that the pieces work together: build the whole thing, run the full test suite, or actually launch/exercise the app against the acceptance criteria from Step 1.

**Check the build against the EXPLICIT requirements, not just "my tests pass."** Passing tests are necessary but not sufficient — a subagent writes its own tests, which can be green while a stated requirement is quietly unmet (e.g. the spec said "export `JobQueue` from the package `__init__`" but the code only exports it from a submodule; the self-written tests imported it the working way, so they passed and masked the gap). So go back to the goal/acceptance criteria from Step 1 and verify **each one literally**: every named public API actually importable/callable the way the spec states (e.g. `from pkg import X` from the repo root, the CLI subcommands exist and run, the entry point works, the documented signatures match). Test the *contract a user was promised*, with a quick independent check that doesn't go through the subagents' own test files. Fix any unmet requirement before reporting done.

Run the suite the way a fresh checkout / CI would — the **canonical command from the repo root** (bare `pytest`, `npm test`, `cargo test`, `make test`), not an environment shortcut like `python -m pytest` or a hand-set `PYTHONPATH`. A green result that depends on such a shortcut is not a pass; it means the project is mis-packaged (a subagent that "verified" with a path trick can mask this). Fix the packaging so the standard command is green from a clean root, then re-run it.

**Packaging is YOUR responsibility as orchestrator.** When you delegate atomic per-file tasks, no single subagent owns "make the project runnable from the repo root", so you must ensure it — ideally make it the **first task** (scaffold: package layout, `__init__.py`, and the test-runner glue such as `pyproject.toml` with `[tool.pytest.ini_options] pythonpath=["."]` or a root `conftest.py`) or, failing that, add it here before the integration run. A pile of correct files that `bare pytest` can't even import is not a finished build.

Run the project's checks as an **ordered quality gate** — **build/typecheck → lint → tests** — and stop to fix on the first failure before continuing. When the build is non-trivial, finish with a code-quality pass using the built-in `/review` (correctness/quality review) and `/simplify` (safe cleanup) skills; and if it touches authentication, the network, files, secrets, or a database, run `/audit` (security) before reporting done. Fix or re-delegate anything that fails — an integration failure with a non-obvious cause goes to the `debugger` subagent, not to trial-and-error in your own context. Only then report completion.

If **test-first / coverage mode** is active (a "Test-coverage / TDD mode" block is in your context — it states the target %, default 80%), every task delegation must require tests, and this final step must measure coverage with the project's real tool and confirm it meets that target — below target or failing tests means keep working, not "done".

## Step 7 — Report to the user

Summarize: what was built, where it lives, how it was verified, and anything left open. Point them at `.qwen/PROGRESS.md` for the full trail.

## If interrupted or resumed

On a fresh invocation where `.qwen/PROGRESS.md` already exists, follow Step 0: sanity-check the first unchecked task against the tree, then continue from it — do not restart or redo finished work.

---
The user's argument (what to build), if any, follows. Treat it as the goal for Step 1.
