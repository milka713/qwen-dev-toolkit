---
name: plan
description: Turn a fuzzy request into a concrete, dependency-ordered task plan written to .qwen/PROGRESS.md, ready to hand to /implement. Explores via the read-only scout subagent (keeping the main context clean), resolves open questions, and decomposes the work into small independently-verifiable tasks. Use PROACTIVELY before building something non-trivial, or when a request is too big/vague to start (for very vague asks, /brainstorm first). Invoke /plan or /plan <what you want>.
argument-hint: '[what you want to build]'
priority: 15
allowedTools:
  - agent
  - read_file
  - read_many_files
  - grep_search
  - glob
  - list_directory
  - write_file
  - run_shell_command
---

# /plan — design the work before building it

Produce a plan, not code. The output is a populated `.qwen/PROGRESS.md` that `/implement` can execute. Stay light on your own context: delegate any real codebase reading to the `scout` subagent.

## Step 1 — Clarify the goal

If `/brainstorm` already recorded an agreed spec in `.qwen/PROGRESS.md` (Goal/Decisions filled, task plan empty), start from it — don't re-ask what it already answers. Otherwise restate what's being asked in one or two sentences and define acceptance criteria (what "done" looks like, how it'll be verified). If something essential is genuinely undecidable from context — target stack, scope boundary, an either/or product choice — ask the user **once**, concisely. Don't ask about things you can reasonably default; state your assumption instead.

## Step 2 — Understand the ground (delegate)

For existing code, call the `agent` tool with `subagent_type: "scout"` and a precise question about where things live and what a change must touch (for a big codebase, several scouts — one per area). Use the digests — don't bulk-read files yourself. For a greenfield project, skip this and instead decide the structure (layout, stack, key modules) explicitly.

## Step 3 — Decompose

Break the work into **right-sized, independently-verifiable tasks — roughly one module/class/file + its tests per task** ("Goldilocks" size: small enough to fit one subagent's context, not so tiny you fragment one component across many tasks). A typical small-to-mid project is **3–6 tasks**, driven by natural module boundaries, not a quota — over-splitting (e.g. a task per function of the same file) just adds overhead and is empirically ~50% slower with no quality gain. Order them by dependency so each builds on verified prior work, and prefer thin vertical slices over horizontal "all models, then all endpoints" layers.

**When building a package/app from scratch, make T1 a scaffold task**: package layout, the test-runner glue (`pyproject.toml` with `[tool.pytest.ini_options] pythonpath=["."]` or a root `conftest.py`; the equivalent for other languages), and one trivial smoke test that runs green — so the canonical test command works from the repo root from the very first task. A module and its tests are **one** task, not two.

For each task note, briefly: what it produces, which files/areas it touches, and how it'll be verified.

## Step 4 — Write the plan to disk

`mkdir -p .qwen`, then write `.qwen/PROGRESS.md` (timestamp from `date '+%F %H:%M'` — don't guess it):

```markdown
# PROGRESS — <short name>
_Updated: <YYYY-MM-DD HH:MM>. Durable state — re-read after any compaction/restart. Continue from the first unchecked task._

## 🎯 Goal
<objective + acceptance criteria>

## 📐 Decisions & constraints
- <stack/lib/structure choices and why; assumptions made>

## 🗺️ Codebase map
- <path — role>  (from Scout, or the planned layout if greenfield)

## 📋 Task plan
- [ ] T1 — <task> · touches: <paths> · verify: <command/check>
- [ ] T2 — ...

## 🔄 Log
- (filled in during implementation)

## ⚠️ Gotchas / open questions
- <risks, unknowns, anything awaiting the user>
```

If `.qwen/PROGRESS.md` already exists, update it rather than clobbering existing Log/Done history.

## Step 5 — Present and hand off

Show the user the plan (goal, decisions, the ordered task list, open risks). Then offer to execute it with `/implement`, which will run the tasks through delegated implementer subagents. Do not start coding from this skill.

---
Argument (if any) follows.
