---
name: plan
description: Turn a fuzzy request into a concrete, dependency-ordered task plan written to .qwen/PROGRESS.md, ready to hand to /implement. Explores via the read-only scout subagent (keeping the main context clean), resolves open questions, and decomposes the work into small independently-verifiable tasks. Use before building something non-trivial, or when a request is too big/vague to start. Invoke /plan or /plan <what you want>.
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
---

# /plan — design the work before building it

Produce a plan, not code. The output is a populated `.qwen/PROGRESS.md` that `/implement` can execute. Stay light on your own context: delegate any real codebase reading to the `scout` subagent.

## Step 1 — Clarify the goal

Restate what's being asked in one or two sentences and define acceptance criteria (what "done" looks like, how it'll be verified). If something essential is genuinely undecidable from context — target stack, scope boundary, an either/or product choice — ask the user **once**, concisely. Don't ask about things you can reasonably default; state your assumption instead.

## Step 2 — Understand the ground (delegate)

For existing code, call the `agent` tool with `subagent_type: "scout"` and a precise question about where things live and what a change must touch. Use its digest — don't bulk-read files yourself. For a greenfield project, skip this and instead decide the structure (layout, stack, key modules) explicitly.

## Step 3 — Decompose

Break the work into small, vertical, independently-verifiable tasks, each sized to fit inside one implementer subagent's context (well under ~60k tokens of read+write). Order them by dependency so each builds on verified prior work. Prefer "model + endpoint + test" slices over horizontal "do all the models, then all the endpoints" layers.

For each task note, briefly: what it produces, which files/areas it touches, and how it'll be verified.

## Step 4 — Write the plan to disk

`mkdir -p .qwen`, then write `.qwen/PROGRESS.md`:

```markdown
# PROGRESS — <short name>
_Updated: <YYYY-MM-DD HH:MM>. Durable plan — re-read after any compaction/restart._

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
