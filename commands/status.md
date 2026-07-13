---
description: [toolkit] Show the current per-project toolkit state at a glance — development mode, test-coverage mode, pinned facts, and the active goal / next task. Read-only. Usage: /status.
---

Project toolkit state (computed deterministically by the shell):

!{bash "$HOME/.qwen/commands/_status.sh"}

Present the `STATUS_*` values above to the user as a short, friendly summary: whether
development mode and test-coverage mode are on, how many facts are pinned, and — if a
build is active — the goal, progress (done/remaining), and the next task. Do not run any
other tools; this is a read-only status check. If a build is active, end by offering to
continue it from the next unchecked task.
