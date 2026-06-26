---
name: brainstorm
description: Clarify and pressure-test requirements BEFORE building, so you don't waste a small context window building the wrong thing. Use PROACTIVELY whenever a build request is vague, broad, or could be interpreted several ways — "build X", "make a Y", "I want a tool that…" — and before /plan or /implement on anything non-trivial. Interviews the user about scope, success criteria, edge cases, and constraints, then produces an agreed spec.
argument-hint: '[what you want to build]'
priority: 18
allowedTools:
  - read_file
  - grep_search
  - glob
  - list_directory
---

# /brainstorm — nail the requirements before any code

A few minutes of clarifying questions is far cheaper than building the wrong thing and
discovering it after the context has filled up. Your job here is to **understand and
agree on what to build — not to write code or even a task plan yet.**

## How to run it

1. **Restate** the request in one or two sentences as you understand it, so the user can
   correct you immediately.
2. **Ask the questions that actually change the design.** Don't interrogate for its own
   sake — ask only what genuinely affects what gets built. Cover the dimensions that
   matter for this request, e.g.:
   - **Goal & success:** what does "done" look like? How will we verify it works?
   - **Scope & non-goals:** what's explicitly in, and what's explicitly *out* (for now)?
   - **Users & usage:** who/what calls this, and how (CLI? library? HTTP? one-shot?)?
   - **Inputs/outputs & data:** shapes, formats, sizes, persistence.
   - **Edge cases & failure:** empty/huge/malformed input, errors, concurrency, limits.
   - **Constraints:** language/stack, dependencies allowed or banned, performance,
     security/privacy, deadlines, existing code to fit into.
   Ask in small batches (the few highest-impact questions first), not a 20-item form.
   Offer a sensible **default for each** so the user can just say "yes" — don't make them
   write essays. Where you can reasonably assume, state the assumption instead of asking.
3. **Challenge gently.** If a requirement seems contradictory, over-complex, or likely to
   change, surface it and propose the simplest option that meets the real need
   (simplicity-first). Note risks and unknowns.
4. **Converge.** When the picture is clear, write back a short **agreed spec**:
   - Goal + acceptance criteria
   - In scope / out of scope
   - Key decisions & constraints (with the assumptions you made)
   - Open risks
5. **Hand off.** Offer to turn it into a task plan with `/plan` (or, in development mode,
   to start building with `/implement`). Do not start coding from this skill.

## When to keep it short
If the request is already specific and unambiguous, don't manufacture questions — confirm
the one or two genuinely open points, write the brief spec, and move on. Brainstorming is
a tool to remove ambiguity, not a ritual.

---
The user's request, if any, follows.
