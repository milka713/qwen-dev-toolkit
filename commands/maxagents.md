---
description: Cap how many subagents run at once, for a resource-constrained local model. /maxagents <N> = at most N concurrent subagents; /maxagents off = remove the cap (default, as many as the work needs); /maxagents status = check. Deterministic, pinned in QWEN.md so it survives compaction.
argument-hint: '[<N> | off | status]'
---

The limit was applied deterministically by the shell below — act on its result, do not re-toggle it:

!{bash "$HOME/.qwen/commands/_maxagents.sh" {{args}}}

Based on `MAXAGENTS_RESULT`:
- A limit was **set** to N: confirm to the user that from now on you'll run at most N subagents at a time (and if N=1, strictly sequentially), still decomposing work into small tasks but never exceeding N awaitable subagents in one response.
- Limit **removed**: confirm subagents will run as the work needs again (sequential by default).
- **status / usage**: report it.

User argument: {{args}}
