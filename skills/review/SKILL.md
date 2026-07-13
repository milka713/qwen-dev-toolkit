---
name: review
description: [toolkit] Correctness- and quality-focused code review of the current diff (bugs, edge cases, dead code, over-complication) — separate from /audit, which is security. Use PROACTIVELY after a build or before a commit/PR, or when the user says "review", "проверь код", "отревьюй". Reports findings by severity and fixes the safe, unambiguous ones. Invoke with /review or /review <path-or-scope>.
argument-hint: '[path or scope]'
priority: 20
allowedTools:
  - agent
  - run_shell_command
  - read_file
  - read_many_files
  - grep_search
  - glob
  - edit
  - write_file
---

# /review — correctness & quality pass

A focused review of what changed, aimed at bugs and needless complexity — **not** security (that's `/audit`) and not style nitpicking. Ground every finding in the actual code.

## Scope

Default to the **current change set**: `git diff HEAD` (staged + unstaged) plus untracked new files from `git status --short`. If the user named a path/scope, review that. If the tree is clean and nothing was named, review the most recent commit (`git show`). Don't bulk-read the whole repo — review the delta and just enough surrounding code to judge it.

## What to look for (in priority order)

1. **Correctness bugs** — off-by-one, wrong operator/boundary, inverted condition, unhandled `None`/null/empty, wrong type, await/async mistakes, resource leaks (unclosed file/socket), mutable default args, incorrect error handling (swallowed exceptions, bare `except`).
2. **Edge cases** the code silently mishandles — empty input, very large input, unicode, concurrent access, timezone/locale, integer overflow, division by zero, duplicate keys.
3. **Contract mismatches** — the code doesn't do what its name/docstring/signature/tests promise; a public API differs from how it's documented or called.
4. **Dead / duplicated / over-complex code** — unreachable branches, copy-paste that should be one helper, a 4-level nesting that flattens, reinventing a stdlib function.
5. **Missing or wrong tests** — an obvious case the tests don't cover, or a test that asserts the wrong thing.

## How to run it

1. Get the diff, then read the changed regions **in the actual files** — a diff hunk alone lacks the context to judge correctness. Follow the functions they call / are called by when needed.
2. **Verify before flagging.** The "unhandled" case may be handled by the caller, a validator, or a default — check the surrounding code first. Every finding needs a concrete failing input or scenario; if you can't name one, it's not a bug finding.
3. For a **large or multi-file** change, delegate the reading to read-only `scout` subagents (`agent` tool, `subagent_type: "scout"`, one per area) asking for *candidate* findings with file:line evidence — then verify the candidates: yourself for a small set, or one `verifier` subagent per candidate (it tries to *refute* the claim and returns CONFIRMED/REFUTED/PLAUSIBLE with evidence). Report only verified findings. Don't use code-writing subagents to review.
4. Produce findings, each as: **severity** (🔴 bug / 🟠 likely bug / 🟡 quality) — file:line — one-sentence problem — concrete failing input or scenario — suggested fix.
5. **Fix the safe ones now**: unambiguous bugs and clear simplifications, via `edit`. After fixing, **re-run the project's tests** (canonical command from repo root; if there are none, at least the build/typecheck) to confirm still-green. Leave anything judgment-heavy or risky as a listed recommendation for the user, don't guess.
6. If a `/cover` coverage-mode block is active, also flag untested changed lines. If you stumble on a **security** issue, don't drop it because it's out of scope — report it and point at `/audit`.

## Report

Summarize: what you reviewed, the findings by severity, what you fixed (and that tests still pass), and what you're leaving to the user's decision. If you found nothing real, say so plainly — don't invent nitpicks to look busy.

The user's optional scope (a path or focus) follows.
