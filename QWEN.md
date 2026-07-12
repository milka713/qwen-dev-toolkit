# Global working agreement (all projects)

The context window here is small (~95k tokens) and auto-compression is lossy. The
failure mode to avoid on big work: doing everything in the main context, overflowing,
compacting, losing the plan, and breaking a project at ~15% done.

## Operating modes

**Normal mode is the default.** Answer directly as a single agent. This is right for
questions, explanations, debugging help, small fixes, and one- or two-file edits. Do
**not** spin up subagents or write `.qwen/PROGRESS.md` for these — just do the work.

But if a request is actually a **multi-part build** (several files, or "build X *with
tests/coverage*"), don't grind it all in one normal-mode pass — on a small context that
ends in a half-finished, unverified result.

**Proceed — don't stall.** If the request is specific enough to act on, just build it:
run the delegated flow (treat it like `/implement` — decompose and delegate to
`implementer` subagents) when it's large, or build it directly for a small one. You may
*mention* that `/dev` mode exists, but **do not stop and wait for the user to approve a
mode** — a clear, fully-specified request should be built, not bounced back as a yes/no
question. Only pause to ask when the request is genuinely ambiguous (and prefer
`/brainstorm` for that). Whenever you proceed directly, get a **correct, tested core
working first**: write and actually **run** the tests early and incrementally, never
present code you haven't executed, and don't run out of budget with unverified code.

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
2. **Delegate all implementation** to `implementer` subagents — hard rule, not a
   preference. **Do not write source/feature code yourself** (`write_file`/`edit` on any
   `.py`/`.js`/test/config) in the main context; the only way code gets written is an
   `implementer` subagent via the `agent` tool. Your own writes are limited to
   `.qwen/PROGRESS.md` / `QWEN.md` / `FACTS.md`. Even a small task gets delegated — the
   overhead keeps your context tiny so big projects don't overflow. Decompose into
   **right-sized tasks — roughly one module/class/file + its tests each** (~3–6 for a
   small-to-mid project; don't over-split into a task per function). Run each in its own
   fresh subagent; if a **"Subagent limit — at most N"** block is present (`/maxagents`),
   never exceed N at a time (N=1 = strictly sequential).
3. **Delegate exploration** to the `scout` subagent — get a compact digest instead of
   bulk-reading files into the main context.
4. **Plan first** with `/plan` (or the `/implement` flow): a dependency-ordered task
   list in `.qwen/PROGRESS.md` before building.
5. **Checkpoint durable state** — keep `.qwen/PROGRESS.md` current (goal, decisions,
   done/todo, gotchas), **ticking each task `- [ ]` → `- [x]` the moment it's verified
   done** (after every task, not at the end). Those checkboxes are the anchor a
   post-compaction or restarted session continues from — stale ones cause redone or
   skipped work. When context feels full, run `/checkpoint` rather than pushing to overflow.

If a normal-mode request quietly grows into a real project, suggest switching: "this
is getting big — want me to run it in development mode (`/dev`) so it doesn't overflow?"

## Memory discipline

Auto-memory is on. Save a memory only for facts that will matter in a *future*
session and are **not** discoverable from the code or git history. Be selective —
noise makes memory useless.

- **Remember:** server IPs/ports/SSH details, deploy & run commands, env/service
  quirks, where credentials live (never the secrets themselves), the user's stable
  preferences and corrections, and project decisions not obvious from the code.
- **Pin** durable per-project specifics you want always in context (host/port, deploy
  command, env quirk) with `/pin <fact>` — it stores them in a gitignored, compaction-
  proof `FACTS.md`. Use this in addition to auto-memory when the fact must survive
  compaction within a session, not just across sessions.
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
- **Simplicity-first:** prefer the simplest design that meets the real requirement;
  reducing complexity is a primary goal, not an afterthought. Make **surgical changes** —
  touch only what the task needs, don't refactor unrelated code along the way.
- For a vague or broad build request, clarify requirements first (`/brainstorm`) before
  planning — a few questions beat building the wrong thing on a small context.
- **Git:** new work lands on `dev` or a feature branch; `main`/`master` changes only on
  the user's explicit approval via `/main-push` (the `/gitflow` policy — a guard hook
  enforces it, don't fight the hook).
- **Versioning:** name versions with semantic versioning by significance — PATCH (`1.4.7`)
  for a small fix, MINOR (`1.5.0`) for a notable feature, MAJOR (`2.0.0`) for a breaking
  change — and state which part you bumped and why. When it's borderline, prefer the
  smaller bump; a same-cycle rework or correction of a just-released change is a PATCH,
  not a new MINOR. `/versioning <scheme>` overrides this for a project; `/versioning off`
  opts a project out.
- **Security:** never hardcode secrets or commit them — read them from env vars / a
  secrets manager and keep them in a gitignored `.env` (a `secret-guard` hook enforces
  this and will block such writes). Run `/audit` before shipping security-sensitive
  work. Use `/cover` (test-first, measured coverage target, default 80%) to require real
  tests instead of hollow output.
