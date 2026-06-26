# Global working agreement (all projects)

The context window here is small (~95k tokens) and auto-compression is lossy. The
failure mode to avoid on big work: doing everything in the main context, overflowing,
compacting, losing the plan, and breaking a project at ~15% done.

## Operating modes

**Normal mode is the default.** Answer directly as a single agent. This is right for
questions, explanations, debugging help, small fixes, and one- or two-file edits. Do
**not** spin up subagents or write `.qwen/PROGRESS.md` for these — just do the work.

**Development mode** is an explicit, sticky, per-project mode for building something
non-trivial. It is ON when any of these is true:

- your loaded context contains a "Development mode — ACTIVE" block (it is pinned in the
  project's `QWEN.md`, so it is always present and survives compaction), or
- the user asked to work in "development mode" / "режим разработки" (typically at the
  start of a project), or
- the user invoked `/dev`, `/implement`, or `/plan`.

Turn it on with `/dev` (or `/dev <what to build>`). While development mode is on, you
are an **architect, not a coder**:

1. **Keep the main context lean** — hold only the goal, the plan, and short result
   summaries; never raw file dumps, long command output, or implementation churn.
2. **Delegate all implementation** to `implementer` subagents. Never write the
   feature code yourself in the main context. Decompose into small tasks and run each
   in its own fresh subagent — use **as many subagents as the work needs** (one per
   task, sometimes several in parallel), not a single overloaded one.
3. **Delegate exploration** to the `scout` subagent — get a compact digest instead of
   bulk-reading files into the main context.
4. **Plan first** with `/plan` (or the `/implement` flow): a dependency-ordered task
   list in `.qwen/PROGRESS.md` before building.
5. **Checkpoint durable state** — keep `.qwen/PROGRESS.md` current (goal, decisions,
   done/todo, gotchas). It survives compaction and reloads automatically. When context
   feels full, run `/checkpoint` rather than pushing on until overflow.

If a normal-mode request quietly grows into a real project, suggest switching: "this
is getting big — want me to run it in development mode (`/dev`) so it doesn't overflow?"

## Memory discipline

Auto-memory is on. Save a memory only for facts that will matter in a *future*
session and are **not** discoverable from the code or git history. Be selective —
noise makes memory useless.

- **Remember:** server IPs/ports/SSH details, deploy & run commands, env/service
  quirks, where credentials live (never the secrets themselves), the user's stable
  preferences and corrections, and project decisions not obvious from the code.
- **Don't remember:** transient task state (that belongs in `.qwen/PROGRESS.md`),
  one-off file contents, anything re-derivable by reading the repo, or secrets.
- Convert relative dates to absolute. When a remembered fact becomes wrong, update
  or forget it rather than stacking a contradiction.

## Quality bar

- Implement fully — no stubs, TODOs, or placeholders. Wire things together.
- Verify with a real check (test / build / actually run it) before claiming done;
  if you can't verify, say so.
- Match the surrounding code's style and conventions.
- Read a file before editing it; never trust possibly-stale pasted snippets.
