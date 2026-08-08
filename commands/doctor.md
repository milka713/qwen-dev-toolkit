---
description: "[toolkit] Self-diagnostic — check the toolkit install for problems: missing files, hooks not wired into settings.json, guards accidentally disabled, stale approval tokens or a leaked subagent counter, and a live model /health ping with latency. Read-only, changes nothing. Usage: /doctor."
---

The diagnostic has already been run deterministically (read-only) by the shell below:

!{bash "$HOME/.qwen/commands/_doctor.sh"}

Relay the `DOCTOR_REPORT` above to the user as a short, friendly health summary, grouped as it is (dependencies, install integrity, hook wiring, guard state, stale state, model providers) and ending with the one-line summary. Do not run any other tools and do not change anything — this is a read-only check. For any ✗ or ⚠ line, give the concrete fix the report names (usually `/toolkit-update` to repair the install, `/hooks on <name>` to re-enable a guard, or noting a model server is unreachable). If everything is healthy, say so briefly.
