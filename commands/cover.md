---
description: Toggle per-project Test-Coverage Mode — enforce shipping real tests with ≥90% coverage so output isn't a hollow, unverified shell. /cover or /cover on = enable, /cover off = disable, /cover status = check. Pinned in QWEN.md so it survives compaction.
---

The test-coverage switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it yourself:

!{bash "$HOME/.qwen/commands/_mode-toggle.sh" covermode "$HOME/.qwen/commands/_covermode.block" "Test-coverage mode" "{{args}}"}

Now respond based on that `MODE_RESULT`:

- **ON**: confirm test-coverage mode is on and pinned in `QWEN.md`. From now on, every feature you (or a delegated `implementer`) build must ship tests covering its new/changed code — edge cases and error paths, not just the happy path — and you measure coverage with the project's real tool (`pytest --cov`, `jest --coverage`, `go test -cover`, `cargo tarpaulin`, …), target **≥90% on changed code**, and report the actual number. Nothing is "done" until its tests exist and pass. If there is current work in `.qwen/PROGRESS.md`, offer to back-fill tests for what's already built.
- **OFF**: confirm you'll no longer enforce the coverage gate (you'll still write sensible tests, just without the 90% requirement).
- **status**: report ON/OFF.

User argument: {{args}}
