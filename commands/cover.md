---
description: Toggle per-project Test-First / Coverage Mode — enforce TDD (red-green-refactor) plus real tests with a measured coverage target. /cover or /cover on = enable at the default 80%; /cover <N> = enable with an N% target (0-100); /cover off = disable; /cover status = check. Deterministic, pinned in QWEN.md so it survives compaction.
argument-hint: '[on | off | status | <percent 0-100>]'
---

The test-first switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it yourself:

!{bash "$HOME/.qwen/commands/_cover.sh" {{args}}}

Now respond based on that `MODE_RESULT`:

- **ON** (note the target % in the result): confirm test-first mode is on at that coverage target and pinned in `QWEN.md`. From now on, build **test-first** (write the failing test, watch it fail, implement, watch it pass, refactor). Every feature you (or a delegated `implementer`) build must ship tests covering its new/changed code — edge cases and error paths, not just the happy path — and you measure coverage with the project's real tool (if none is configured, set up the ecosystem's standard one — `pytest-cov`, `jest --coverage`, `go test -cover`), must hit the target, and report the actual measured number. Nothing is "done" until its tests exist and pass — and for the final gate, delegate an independent black-box check of the acceptance criteria to the `tester` subagent (self-written green tests alone don't prove the contract). If there is current work in `.qwen/PROGRESS.md`, offer to back-fill tests for what's already built.
- **OFF**: confirm you'll no longer enforce the coverage gate (you'll still write sensible tests, just without the target).
- **status**: report ON (with target %) / OFF.

User argument: {{args}}
