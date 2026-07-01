---
name: brainstorm
description: Clarify and pressure-test requirements BEFORE building, so you don't waste a small context window building the wrong thing. Use PROACTIVELY whenever a build request is vague, broad, or could be interpreted several ways — "build X", "make a Y", "I want a tool that…", "давай сделаем…" — and before /plan or /implement on anything non-trivial. Interviews the user (a few numbered questions, each with a default), then records an agreed spec durably. Invoke with /brainstorm or /brainstorm <what you want>.
argument-hint: '[what you want to build]'
priority: 18
allowedTools:
  - read_file
  - grep_search
  - glob
  - list_directory
  - write_file
  - edit
---

# /brainstorm — nail the requirements before any code

A few minutes of questions is far cheaper than building the wrong thing and discovering it after the context has filled up. Your job here: **understand and agree on what to build — not to write code or a task plan yet.**

## Step 1 — Restate

Restate the request in one or two sentences as you understand it, so the user can correct you immediately.

## Step 2 — Look before you ask

If there's an existing codebase, take a quick targeted look first (README, manifest, entry points — a few reads, not a full exploration). **Never ask what the repo already answers**: language, framework, test setup, existing conventions. For a greenfield request, skip this step.

## Step 3 — Interview (one round, rarely two)

Ask **only the questions whose answers change what gets built** — at most 3–5, numbered, each with a sensible default so the user can answer in one line ("defaults", "1b, rest defaults"). Pick from the dimensions that matter for this request:

- **Goal & success** — what does "done" look like? How will we verify it works?
- **Scope & non-goals** — what's explicitly in, and what's explicitly *out* (for now)?
- **Users & usage** — who/what calls this, and how (CLI? library? HTTP? one-shot?)?
- **Inputs/outputs & data** — shapes, formats, sizes, persistence.
- **Edge cases & failure** — empty/huge/malformed input, errors, concurrency, limits.
- **Constraints** — stack, dependencies allowed/banned, performance, security/privacy, existing code to fit into.

Where you can reasonably assume, don't ask — state the assumption and mark it `(assumed)`. Ask a second round only if an answer genuinely opens a new design-changing question; never a third.

**Challenge gently.** If a requirement seems contradictory, over-complex, or likely to change, say so and propose the simplest option that meets the real need. Note risks and unknowns.

## Step 4 — Converge on the spec

When the picture is clear, write back a short **agreed spec** and get an explicit "yes" (or corrections):

```markdown
## Agreed spec — <short name>
**Goal:** <one sentence>
**Acceptance criteria:** <verifiable checks — "running X does Y", not "works well">
**In scope:** … / **Out of scope:** …
**Decisions & constraints:** <choices made; assumptions marked (assumed)>
**Open risks:** <what could invalidate this>
```

## Step 5 — Persist and hand off

Once agreed, save the spec into `.qwen/PROGRESS.md` — fill the 🎯 Goal, 📐 Decisions & constraints, and ⚠️ Gotchas / open questions sections of the standard template; merge if the file exists; leave the task plan empty for `/plan`. The spec must survive compaction and restart — chat history won't.

Then offer to decompose it with `/plan` (or, in development mode, start building with `/implement` if it's small). Do not start coding from this skill.

## When to keep it short

If the request is already specific and unambiguous, don't manufacture questions — confirm the one or two genuinely open points, write the brief spec, and move on. Brainstorming removes ambiguity; it is not a ritual. A fully-specified request should go straight to `/plan` or the build.

---
The user's request, if any, follows.
