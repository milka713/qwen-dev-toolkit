<!-- Languages: English (this file) · [Русский](README.ru.md) -->

# qwen-dev-toolkit

A workflow pack for [qwen-code](https://github.com/QwenLM/qwen-code) on **local /
small-context models** (e.g. a llama.cpp server with a ~90–100k window). It stops big
builds stalling after a context overflow + lossy compaction by making the model an
**architect that delegates**, with state that survives compaction.

> 🇺🇸 English · [🇷🇺 Русский](README.ru.md)

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
| `/cover` · `<N>` · `off` · `status` | Test-first / coverage mode. Build **test-first** (red→green→refactor); coverage is **measured** and must hit the target — `/cover 95` sets 95%, plain `/cover` defaults to **80%**. Verified output, not a hollow shell. |
| `/maxagents <N>` · `off` · `status` | **Hard** cap on how many subagents run **at once** for a constrained local model (`/maxagents 1` = strictly sequential). Enforced deterministically by a `PreToolUse` hook that blocks extra `agent` launches — not just an instruction. Default = no cap. |
| `/pin <anything>` · `list` · `remove <text>` · `clear` | Remember any info (IP/port, deploy command, decision, URL, snippet) into a compaction-proof `FACTS.md` — auto-loaded via `@FACTS.md` and **gitignored** so it can't leak. Per-project. |
| `/status` | Read-only snapshot: dev mode, coverage target, subagent cap, pinned-fact count, current goal and next task. |
| `/mainok` · `off` · `status` | Authorize push/merge to the protected branch (`main`/`master`) for a **15-minute release window** (covers the merge **and** the push). The `git-branch-guard` hook blocks main operations by default; `/mainok` is the user-only release valve. |
| `/bro` · `свобода` · `ламар` · `off` · `status` | Talk to you like a homie, in one of **two personas**: `свобода` = a S.T.A.L.K.E.R. *Freedom* drifter (always calls you "мэн"), `ламар` = a GTA V *Lamar Davis* street homie ("homie/foo/dog") — casual, slangy, blunt, but still genuinely helpful. Off by default; pinned **globally** until `/bro off`. |

### Skills (model- and user-invocable)

| Skill | What it does |
| ----- | ------------ |
| `/brainstorm` | Clarifies and pressure-tests requirements **before** building (scope, success criteria, edge cases, constraints) so a small context isn't spent building the wrong thing. Produces an agreed spec, then hands to `/plan`. |
| `/plan` | Turns a fuzzy/large request into a dependency-ordered task list in `.qwen/PROGRESS.md`. Explores via the read-only `scout`. Produces a plan, not code. |
| `/implement` | Orchestrator: captures the goal, decomposes it, runs **each task in a fresh `implementer` subagent**, then verifies end-to-end with the canonical command. For any multi-step build. |
| `/checkpoint` | Curates the important state into `.qwen/PROGRESS.md` so it survives lossy auto-compression. `/checkpoint restore` reloads it. |
| `/gitflow` | The git branch & deploy discipline, applied proactively on any commit/push/merge/deploy: **new work → `dev` by default; `main`/`master` only on explicit approval**. Backed at engine level by the `git-branch-guard` hook + `/mainok`. |
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
| `PreToolUse` → `git-branch-guard.js` | **Blocks** any `git push`/`merge`/`rebase` that would touch `main`/`master` (explicit target, or while checked out on it, or a switch-then-merge one-liner). Pushes to `dev`/feature branches and read-only git pass. Released for one operation by `/mainok`. |
| `UserPromptSubmit` → `skill-reminder.js` | Small local models under-trigger model-invoked skills; this injects a short, targeted reminder (e.g. "looks security-related → `/audit`") only when the prompt clearly matches, so the right skill actually fires. Silent on trivial prompts. |
| `PreToolUse`/`PostToolUse`/`SessionStart` → `agent-limit.js` | Enforces `/maxagents` deterministically: counts running subagents and **denies** `agent` launches beyond the cap (concurrency-safe via a lock), decrements when one finishes, resets each session. No cap set → no-op. |

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

### Updating

```bash
git pull && ./install.sh        # idempotent; cleans up files renamed/removed in old releases
```

`install.sh` overwrites only this toolkit's own files and config blocks (your keys, other
settings, memories, and `.qwen/PROGRESS.md` are untouched), so re-running it is the update.
Extension users: `qwen extensions update qwen-dev-toolkit`. Current version is in `VERSION`.

## Usage

```text
/dev                                 # development mode (architect + delegation)
/cover 80                            # test-first, require ≥80% measured coverage
/maxagents 2                         # cap parallel subagents (weak hardware)
/pin model server 10.0.0.5:8080      # remember infra facts (compaction-proof, gitignored)
/plan add JWT auth to the API        # design → .qwen/PROGRESS.md
/implement                           # build via delegated subagents
/audit                               # security review
/checkpoint [restore]                # save / reload durable state
/status                              # what's on, current goal
/dev off                             # back to single-agent mode
```

One-shot: `/dev build a Python CLI expense tracker with SQLite and pytest`.

## Reliability on a small / slow / shared local server

Two `~/.qwen/settings.json` knobs matter a lot for a local model and are easy to get
wrong. For a **custom OpenAI-compatible provider**, put them under the provider entry's
`generationConfig` (qwen ignores `model.generationConfig` for such providers):

```json
{
  "modelProviders": {
    "openai": [{
      "id": "...", "name": "...", "baseUrl": "http://HOST:PORT/v1", "envKey": "OPENAI_API_KEY",
      "generationConfig": {
        "contextWindowSize": 120000,
        "timeout": 1800000
      }
    }]
  }
}
```

- **`contextWindowSize`** — qwen auto-compacts *before* the context overflows, but it
  computes the trigger from the model's context window. For a custom provider it can't
  detect that and falls back to a default that may be larger than your server's real
  window, so it compacts **too late** and overflows. Set it a bit below your server's `-c`
  value (e.g. `120000` for a llama.cpp `-c 125000`). The toolkit's `PreCompact` hook then
  keeps the goal/decisions during compaction and `SessionStart` reloads `.qwen/PROGRESS.md`.
- **`timeout`** (ms) — the **per-request** timeout. The default (~6 min) aborts a single
  model call when the server is slow or shared with other work, killing a build mid-task
  (this is separate from a run's overall budget). Raise it generously — `1800000` (30 min)
  — so long generations under load complete instead of erroring with `Request timeout`.

### Loop protection

Small local models sometimes get stuck repeating the same tool call or output. qwen-code
has a loop detector, but it's **off by default** (to avoid false positives). For a local
model it's worth turning on, plus a finite tool-call backstop — these are top-level
`model` settings:

```json
{ "model": { "skipLoopDetection": false, "maxToolCalls": 5000 } }
```

- **`skipLoopDetection: false`** re-enables loop detection (repeated identical tool calls
  or repeated streamed content). Interactively it asks you whether to continue when a loop
  is caught; in headless runs it stops the stuck loop instead of burning budget.
- **`maxToolCalls: 5000`** is a hard backstop — a runaway loop aborts (exit 55) at 5000
  cumulative tool calls, while a normal build stays well under that.
- For unattended runs, also pass `--max-wall-time 1800` as an overall time cap. Mid-run,
  `Esc` (or `Ctrl+C`) cancels immediately.

Note: a stale `/maxagents 1` left in a project can itself trigger a loop — when the model
tries to launch several subagents, each extra one is denied and a small model may keep
retrying the same launch. Clear it with `/maxagents off` if you're not deliberately
capping.

### Auto mode with a queued or shared model

`tools.approvalMode: "auto"` vets risky actions (shell, subagent launches, writes outside
the workspace) with a small LLM classifier — safe → approved, risky → blocked/asked. That
classifier has short per-call timeouts by default (**stage 1 ≈ 10 s, stage 2 ≈ 30 s**),
sized for a fast dedicated model. If your local model sits behind an access **queue** (it's
busy serving someone else), qwen-code can't tell "queued" from "slow": the classifier call
waits in line, blows past 10 s, and **fails closed** (`Classifier stage 1 unavailable`) —
blocking the action even though nothing is wrong.

Raise the classifier timeouts to tolerate the queue. There's no true "disable" (values
below 1000 ms fall back to the default), so use a large value — it's effectively off while
still aborting a genuinely dead call:

```json
{ "permissions": { "autoMode": { "classifier": {
  "timeouts": { "stage1Ms": 1200000, "stage2Ms": 1200000 }
} } } }
```

(20 minutes each above.) Two alternatives: point a **fast model** (`/model --fast`) at a
small, quick model so the classifier answers in ~300 ms and never waits on the main model;
or skip the classifier entirely with `yolo` + a `permissions.deny` guardrail list (`deny`
outranks everything, even in yolo).

## Requirements & uninstall

- qwen-code (tested on **0.19.x**) + Node.js. Any provider; designed for small-context local models.
- `./uninstall.sh` removes only this toolkit's files and config blocks; your other settings, env vars and `.qwen/PROGRESS.md` stay intact.

MIT — see [LICENSE](LICENSE).
