<!-- Languages: English (this file) · [Русский](README.ru.md) -->

# qwen-dev-toolkit

A professional workflow pack for [qwen-code](https://github.com/QwenLM/qwen-code)
running against **local / small-context models** (e.g. a llama.cpp server with a
~90–100k token window). It turns the model from a coder that grinds everything into one
context — and stalls at ~15% of a project after an overflow + lossy compaction — into an
**architect that delegates**, with durable state that survives compaction.

> 🇷🇺 Полная русская версия: **[README.ru.md](README.ru.md)**.

---

## The problem

On a small context window the usual failure is:

> the model does all the work in the main context → hits the limit → auto-compacts →
> loses the goal, the decisions, and what was already done → the project breaks halfway.

## How it solves it — three pillars

### 1. Delegation (so the context never fills)
The main session stays an **architect**: it plans and delegates. All heavy work — reading
many files, writing code, running builds/tests — happens inside **disposable subagent
contexts**. Their churn never lands in the main context, so it stays small and the
project reaches completion. A subagent overflowing is harmless: it returns what it has
and the architect re-delegates the rest. You get **as many subagents as the work needs**,
one per small task.

### 2. Durable state on disk
Progress lives in `.qwen/PROGRESS.md` (goal, decisions, done/todo, gotchas) — not only in
the conversation. It survives restart, `/clear`, and compaction. A `SessionStart` hook
re-injects it automatically at the start of each session (including right after a
compaction), so the model always knows where it left off.

### 3. Compaction-proof "pinned" data (no re-declaring)
**Why don't we have to re-declare flags after a compaction?** Because compaction only
summarizes the *conversation history* — it never touches the `QWEN.md` context files,
which qwen-code re-attaches as system context on **every** request. So anything you put
in a `QWEN.md` is effectively *pinned*: always present, never compacted, no re-injection
needed.

That's exactly how **development mode** is stored: `/dev` writes a small marked block into
the project's `QWEN.md`. From then on the model sees "development mode is active" on every
turn and after every compaction, with zero re-declaration. (The larger, ever-growing
`PROGRESS.md` is *not* pinned this way — carrying it on every request would waste the tiny
budget — so it uses the event-driven `SessionStart` hook instead. Small pinned flag +
event-restored big state = the right split.)

---

## Components — what each piece does

### Commands — deterministic, user-invoked toggles
Implemented as **custom commands** so their file change is **deterministic** (they run a
shell step via `!{…}`, not left to the model's discretion). Each pins a block into the
project `QWEN.md` (or `FACTS.md`), so the state survives compaction with no re-declaration.

| Command | What it does |
| ------- | ------------ |
| `/dev` · `on` · `off` · `status` · `<what to build>` | Development-mode switch for the whole architect-and-delegate workflow. `on` pins the dev block into `QWEN.md` (the session now plans in the main context and delegates to subagents); `off` removes it; `<goal>` turns it on **and** starts building. Idempotent; your other `QWEN.md` content is preserved. |
| `/cover` · `on` · `off` · `status` | **Test-coverage mode.** When on, every feature must ship real tests covering edge/error paths, coverage is **measured** with the project's real tool (`pytest --cov`, `jest --coverage`, …) and must hit **≥90% on changed code** — so you get verified output, not a hollow "looks done" shell. |
| `/pin <anything>` · `list` · `remove <text>` · `clear` | Remember **any** important info (server IP/port, deploy command, env quirk, a decision, a URL, a snippet) into a **compaction-proof `FACTS.md`** — auto-loaded via `@FACTS.md` in `QWEN.md` and **gitignored** so it never leaks to the repo. Always in context, never compacted. Per-project. |
| `/status` | Read-only snapshot of the project's toolkit state at a glance: development mode on/off, test-coverage mode on/off, number of pinned facts, and the active goal with done/remaining tasks and the next one. |

### Skills (model- and user-invocable)

| Skill | Concretely, what it does |
| ----- | ------------------------ |
| `/plan` | Turns a fuzzy or large request into a **dependency-ordered task list** written to `.qwen/PROGRESS.md`, ready for `/implement`. Explores the codebase via the read-only `scout` subagent (so the main context isn't filled with file reads), resolves open questions, and decides the structure. Produces a plan, not code. |
| `/implement` | The **architect/orchestrator**. Captures the goal in `.qwen/PROGRESS.md`, decomposes the work into small tasks, and runs **each task in a fresh `implementer` subagent**, recording the result and ticking the task off as it goes. Ends with an end-to-end verification using the *canonical* command a clean checkout/CI would run. Use it for any multi-step or multi-file build. |
| `/checkpoint` | **Smart, durable compaction.** Curates the important state (goal, decisions, done/todo, gotchas) into `.qwen/PROGRESS.md` — selection, not a raw dump — so it survives the engine's lossy auto-compression. `/checkpoint restore` reloads it. Run it when the context is getting full instead of pushing on until overflow. |
| `/audit` | **Security review at the architecture + code level.** Hunts hardcoded secrets and secrets about to be committed, then reviews authn/authz, injection (SQL/command/path), SSRF, unsafe deserialization, weak crypto, CORS/config, and risky deps — reporting findings by severity and fixing the safe ones. Run before shipping security-sensitive work. |

### Subagents (delegated workers with isolated context)

| Subagent | Concretely, what it does |
| -------- | ------------------------ |
| `implementer` | Takes **one** scoped task and drives it to a working, **verified** state in its own context: reads the real files, matches conventions, implements fully (no stubs), and verifies with the **canonical** command from the repo root — fixing the packaging if a check only passes via an environment shortcut. Reports a short summary; the heavy churn stays out of the main context. |
| `scout` | **Read-only** codebase explorer. Answers a focused "where does X live / what must a change touch" question and returns a **compact digest** (key files, how they wire, conventions, the real build/test commands) so the main session never bulk-reads files. |

### Hooks (`~/.qwen/settings.json`)

| Hook | Concretely, what it does |
| ---- | ------------------------ |
| `SessionStart` → `session-start-restore.js` | If `.qwen/PROGRESS.md` exists, injects it at session start (and after a compaction/resume) so the model recovers the full goal/decisions/next-steps automatically. |
| `PreCompact` → `pre-compact-steer.js` | Fires just before the built-in compressor runs and steers it to **preserve** the goal, decisions, file list, and done/todo split rather than dropping them. |
| `PreToolUse` → `secret-guard.js` | **Deterministically blocks** any `write_file`/`edit`/`run_shell_command` whose content contains a hardcoded credential (private keys, AWS/OpenAI/GitHub/Slack/HF/… tokens, high-entropy secret assignments) or that stages/commits an obvious secret file (`.env`, `id_rsa`, `*.pem`). Enforces "no keys in code, no secrets in the repo" at the engine level instead of trusting the model to remember. Low false-positive: env-var usage and placeholders pass. |

### Context guidance (`QWEN.md`)
A lean global working agreement installed at `~/.qwen/QWEN.md`: the two operating modes
(normal vs development), and **memory discipline** — remember durable facts (server
IPs/ports, deploy/run commands, env quirks, where credentials live, stable preferences),
*not* transient task state or anything re-derivable from the repo. Native auto-memory is
enabled.

---

## Two modes

- **Normal mode (default):** the model answers as a single agent. Right for questions,
  explanations, small fixes, one- or two-file edits — no subagents, no overhead.
- **Development mode:** opt in once per project with `/dev` (or `/dev <what to build>`).
  The model then plans in the main context and delegates **all** implementation to
  `implementer` subagents. Because the flag is pinned in `QWEN.md`, it stays on for the
  whole session **and after any compaction or restart**, until you run `/dev off`.

---

## Where everything lives (scope)

`QWEN.md` is a **context file** qwen-code re-attaches as system context on every request
(so it is never compacted). It is loaded from two places — there is **no session-only
QWEN.md**:

- `~/.qwen/QWEN.md` → **global** (every project)
- `<project>/QWEN.md` and up the directory tree → **project** (the folder where you launched qwen)

This toolkit puts each kind of state where it belongs:

| State | Lives in | Scope |
| ----- | -------- | ----- |
| Skills, subagents, commands, hooks, base guidance | `~/.qwen/…` | **Global** — available in every project |
| `/pin` memory (IP/port, decisions, anything) | `<project>/FACTS.md` (+ `@FACTS.md` in project `QWEN.md`), gitignored | **Project** |
| `/dev` & `/cover` flags | a block in `<project>/QWEN.md` | **Project**, sticky until `/dev off` / `/cover off` |
| Durable task state | `<project>/.qwen/PROGRESS.md` | **Project** |

So the toolkit itself is global, your pinned memory and flags are per-project, and
everything that must outlive a compaction lives in a `QWEN.md`-loaded file, not in the
conversation.

---

## Install

**One command (recommended) — full install into `~/.qwen`:**

```bash
./install.sh
```

Copies the skills, subagents, the `/dev` command and the hook scripts into `~/.qwen`,
then idempotently merges the hook + auto-memory settings into `~/.qwen/settings.json` and
the guidance into `~/.qwen/QWEN.md`. It never touches your existing keys, env vars, or
other settings, and is safe to re-run. Restart qwen-code afterwards.

**As a native qwen-code extension** (skills + subagents + `/dev` command + guidance):

```bash
qwen extensions link /path/to/qwen-dev-toolkit          # local checkout
# or from a git repo:
qwen extensions install https://github.com/milka713/qwen-dev-toolkit
```

The automatic compaction hooks live in `settings.json` and aren't carried by the
extension mechanism — run `./install.sh` as well (or copy `hooks/*.js` into
`~/.qwen/hooks/` and add the two hook entries to `~/.qwen/settings.json`; see `install.sh`
for the exact shape) to enable them.

**Manual:** copy `skills/*` → `~/.qwen/skills/`, `agents/*` → `~/.qwen/agents/`,
`commands/*` → `~/.qwen/commands/`, `hooks/*` → `~/.qwen/hooks/`, and merge `QWEN.md`.

### Verify

Restart qwen-code, then:

- `/skills` → `implement`, `checkpoint`, `plan`
- `/agents manage` → `implementer`, `scout`
- `/dev status` → the `/dev` command responds
- `/dev` then `/plan build a small CLI todo app` → a plan appears in `.qwen/PROGRESS.md`

---

## Usage

```text
/dev                                  # enter development mode (pinned in QWEN.md)
/cover on                             # require real tests, ≥90% coverage on output
/pin model server 10.0.0.5 port 8080  # pin infra facts (compaction-proof, gitignored)
/plan add JWT auth to the API         # design → .qwen/PROGRESS.md
/implement                            # execute the plan via delegated subagents
/audit                                # security review before shipping
/checkpoint                           # save durable state when the context gets full
/checkpoint restore                   # reload state after a restart/compaction
/dev off                              # back to normal single-agent mode
```

Or in one shot: `/dev build a Python CLI expense tracker with SQLite and pytest` — turns
on development mode and runs the whole delegated build.

---

## Requirements

- qwen-code (tested on **0.19.x**) and Node.js (already required by qwen-code).
- Works with any provider; designed for small-context local models, where it matters most.

## Uninstall

```bash
./uninstall.sh
```

Removes only this toolkit's files and config blocks. Your other settings, env vars,
memories and `.qwen/PROGRESS.md` files are left intact.

## License

MIT — see [LICENSE](LICENSE).
