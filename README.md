<!-- Languages: English (this file) · [Русский](README.ru.md) -->

# qwen-dev-toolkit

A workflow pack for [qwen-code](https://github.com/QwenLM/qwen-code) on **local /
small-context models** (e.g. a llama.cpp server with a ~90–100k window). It stops big
builds stalling after a context overflow + lossy compaction by making the model an
**architect that delegates**, with state that survives compaction.

> 🇷🇺 [README.ru.md](README.ru.md)

## How it works

- **Delegation** — the main session plans and delegates; all heavy work (reading files,
  writing code, tests) runs in **disposable subagent contexts**, so the main context
  stays small and the build finishes. As many subagents as the work needs, one per task.
- **Durable state** — progress lives in `.qwen/PROGRESS.md` and is re-injected each
  session (and after compaction) by a hook, so the model never loses the plan.
- **Compaction-proof flags** — compaction only summarizes the *conversation*; `QWEN.md`
  is re-attached as system context every request. So a block written to `QWEN.md` (e.g.
  the dev-mode flag) is always present and needs no re-declaring.

## Components

### Commands (deterministic, user-invoked)
Custom commands — the file change runs via a shell step (`!{…}`), so it's deterministic,
not left to the model.

| Command | What it does |
| ------- | ------------ |
| `/dev` · `on` · `off` · `status` · `<goal>` | Development-mode switch. `on` pins the dev block into `QWEN.md` → the session plans and delegates to `implementer` subagents; `off` removes it; `<goal>` enables it **and** starts building. Idempotent; other `QWEN.md` content is kept. |
| `/cover` · `on` · `off` · `status` | Test-coverage mode. Every feature must ship real tests; coverage is **measured** (`pytest --cov`, `jest --coverage`, …) and must hit **≥90% on changed code** — verified output, not a hollow shell. |
| `/pin <anything>` · `list` · `remove <text>` · `clear` | Remember any info (IP/port, deploy command, decision, URL, snippet) into a compaction-proof `FACTS.md` — auto-loaded via `@FACTS.md` and **gitignored** so it can't leak. Per-project. |
| `/status` | Read-only snapshot: dev/cover mode, pinned-fact count, current goal and next task. |

### Skills (model- and user-invocable)

| Skill | What it does |
| ----- | ------------ |
| `/plan` | Turns a fuzzy/large request into a dependency-ordered task list in `.qwen/PROGRESS.md`. Explores via the read-only `scout`. Produces a plan, not code. |
| `/implement` | Orchestrator: captures the goal, decomposes it, runs **each task in a fresh `implementer` subagent**, then verifies end-to-end with the canonical command. For any multi-step build. |
| `/checkpoint` | Curates the important state into `.qwen/PROGRESS.md` so it survives lossy auto-compression. `/checkpoint restore` reloads it. |
| `/audit` | Security review (architecture + code): hardcoded secrets, authz, injection, SSRF, weak crypto, risky deps — findings by severity, fixes the safe ones. |

### Subagents (isolated context)

| Subagent | What it does |
| -------- | ------------ |
| `implementer` | Drives **one** task to a verified state: reads real files, implements fully (no stubs), verifies with the **canonical** command from the repo root (fixes packaging if a check only passes via a path trick). Returns a short summary. |
| `scout` | Read-only explorer — returns a compact digest (key files, wiring, conventions, real build/test commands) instead of bulk-reading into the main context. |

### Hooks (`~/.qwen/settings.json`)

| Hook | What it does |
| ---- | ------------ |
| `SessionStart` → `session-start-restore.js` | Re-injects `.qwen/PROGRESS.md` at session start / after compaction, so the model recovers the goal and next steps. |
| `PreCompact` → `pre-compact-steer.js` | Steers the built-in compressor to keep the goal, decisions, file list and done/todo. |
| `PreToolUse` → `secret-guard.js` | **Blocks** any write/edit/command containing a hardcoded credential (private keys, AWS/OpenAI/GitHub/Slack/HF tokens, …) or that commits a secret file (`.env`, `id_rsa`, `*.pem`). Env-var usage and placeholders pass. |

Plus a lean `~/.qwen/QWEN.md` (operating modes + memory discipline) and native auto-memory.

## Scope — where state lives

`QWEN.md` is a context file re-attached every request (never compacted), loaded from
`~/.qwen/QWEN.md` (**global**) and `<project>/QWEN.md` up the tree (**project**). There is
no session-only QWEN.md.

| State | Lives in | Scope |
| ----- | -------- | ----- |
| Skills, subagents, commands, hooks, guidance | `~/.qwen/…` | **Global** |
| `/pin` memory | `<project>/FACTS.md` (gitignored) | **Project** |
| `/dev` & `/cover` flags | block in `<project>/QWEN.md` | **Project** (sticky until `off`) |
| Task state | `<project>/.qwen/PROGRESS.md` | **Project** |

## Install

```bash
./install.sh          # full install into ~/.qwen, then restart qwen-code
```

Copies skills/subagents/commands/hooks into `~/.qwen` and idempotently merges the hook +
auto-memory settings and the guidance — without touching your existing keys or settings.
Safe to re-run.

Alternatives: `qwen extensions install https://github.com/milka713/qwen-dev-toolkit`
(skills + subagents + commands + guidance; run `./install.sh` too for the hooks), or copy
the dirs into `~/.qwen/` manually.

**Verify** (after restart): `/skills` lists `implement, plan, checkpoint, audit`;
`/agents manage` lists `implementer, scout`; `/status` responds.

## Usage

```text
/dev                                 # development mode (architect + delegation)
/cover on                            # require real tests, ≥90% coverage
/pin model server 10.0.0.5:8080      # remember infra facts (compaction-proof, gitignored)
/plan add JWT auth to the API        # design → .qwen/PROGRESS.md
/implement                           # build via delegated subagents
/audit                               # security review
/checkpoint [restore]                # save / reload durable state
/status                              # what's on, current goal
/dev off                             # back to single-agent mode
```

One-shot: `/dev build a Python CLI expense tracker with SQLite and pytest`.

## Requirements & uninstall

- qwen-code (tested on **0.19.x**) + Node.js. Any provider; designed for small-context local models.
- `./uninstall.sh` removes only this toolkit's files and config blocks; your other settings, env vars and `.qwen/PROGRESS.md` stay intact.

MIT — see [LICENSE](LICENSE).
