<!-- Languages: English (this file) · [Русский](README.ru.md) -->

# qwen-dev-toolkit

> ### 💬 If you're an AI agent — start here
>
> The user pointed you at this repo and asked to install or update the skills? Follow
> **[`INSTALL_FOR_AI.md`](INSTALL_FOR_AI.md)** — step-by-step install + verify instructions
> written for you. They also cover disabling qwen-code's **stream-idle timeout** (kills
> requests after 240 s of stream silence — poison for slow / queued local servers) on
> macOS, Linux and Windows. Short version:
>
> ```
> git clone --depth 1 https://github.com/milka713/qwen-dev-toolkit
> node qwen-dev-toolkit/install.js
> ```
>
> Already inside a checkout? just `node install.js`. Updating? `git pull`, then re-run.
> Already running inside qwen-code? invoke **`/toolkit-update`** — it does all of this for you.

A **skills pack** for [qwen-code](https://github.com/QwenLM/qwen-code) on **local /
small-context models** (e.g. a llama.cpp server with a ~90–100k window). Its core stops big
builds stalling after a context overflow + lossy compaction by making the model an
**architect that delegates**, with state that survives compaction — and on top of that it
ships a full set of everyday development skills and commands: git-flow discipline
(`/gitflow`, `/commit`, `/main-push`), code `/review` and security `/audit`, `/docs` and
`/changelog`, planning (`/brainstorm`, `/plan`), test-coverage mode (`/cover`), a root-cause
`debugger`, and more — all listed below.

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
- **Integrity over agreement (always on)** — the `QWEN.md` block carries a standing
  honesty directive: be accurate, not agreeable. Separate fact / inference / opinion,
  state uncertainty plainly, surface inconvenient truths (failed tests, skipped steps,
  real risks) without softening or reframing, disagree directly when the user or a plan
  is wrong, and never fabricate agreement or confidence. It lives in `QWEN.md` — not a
  skill — precisely because that's the only primitive that is genuinely *always on*
  (skills are on-demand; hooks are deterministic code and can't make a judgment call).

## Components

### Commands (deterministic, user-invoked)
Custom commands — the file change runs via a shell step (`!{…}`), so it's deterministic,
not left to the model.

Each keeps its state in a marked block in `QWEN.md` (or in `FACTS.md`), which is re-attached
to context every request and so survives compaction. Args are shown after each name.

**`/dev` · `on` · `off` · `status` · `<goal>`** — Development-mode switch: turns the session
into an **architect that delegates**. With it on, the model plans the work and hands every
implementation task to a fresh `implementer` subagent instead of coding in its own context —
which is exactly what lets a big build finish instead of overflowing and breaking after a
compaction. `on` pins the dev block into the project's `QWEN.md`; `off` removes it; `status`
reports; and `/dev <goal>` turns it on **and** starts building that goal in the same turn.
Idempotent — the rest of your `QWEN.md` is left intact.
· _Example:_ `/dev build a REST API for todos with SQLite + tests`

**`/cover` · `<N>` · `off` · `status`** — Test-first / coverage mode. While on, nothing is
"done" until it ships passing tests: the model works **red → green → refactor** and must
**measure** coverage with the project's real tool (`pytest --cov`, `jest --coverage`, `go
test -cover`, …) and hit the target. `/cover 95` sets 95 %, plain `/cover` defaults to 80 %,
`/cover off` clears it. Guards against hollow, unverified output.
· _Example:_ `/cover 90`

**`/maxagents <N>` · `off` · `status`** — Hard cap on how many subagents run **at once**, for
weak or loaded local hardware. Not just an instruction: a `PreToolUse` hook counts running
subagents and **blocks** any launch beyond N (`/maxagents 1` = strictly sequential). Default
is no cap; clear a stale one with `/maxagents off` (a leftover `1` can otherwise cause retry
loops).
· _Example:_ `/maxagents 2`

**`/pin <anything>` · `list` · `remove <text>` · `clear`** — Remember any fact you want always
on hand — a host/port, a deploy command, a decision, a URL, a code snippet. It lands in a
project `FACTS.md` that's auto-loaded every session via an `@FACTS.md` include (so it survives
compaction) and is **gitignored** so it can't leak into the repo. `list` shows them,
`remove <text>` drops matching lines, `clear` wipes all.
· _Example:_ `/pin deploy = ssh -p 12578 mark@host && ./deploy-dev.sh`

**`/status`** — Read-only snapshot of this project's toolkit state: dev mode on/off, coverage
target, subagent cap, how many facts are pinned, and — from `.qwen/PROGRESS.md` — the current
goal and the next unchecked task. Changes nothing.

**`/main-push` · `off` · `status`** — The user-only release valve for the protected branch. By
default the `git-branch-guard` hook blocks every push/merge to `main`/`master`; running
`/main-push` opens a **15-minute window** that authorizes the whole release (the merge **and**
the push). `off` revokes it early, `status` checks it. Because only you can run a slash
command, this makes "yes, really release to main" un-fakeable by the model.

**`/versioning` · `on` · `off` · `status` · `<custom scheme>`** — Version-naming policy.
Semantic versioning is **on by default** (stated in the global `QWEN.md`): the model names
versions by significance — **PATCH** for small fixes (`1.4.7`), **MINOR** for notable
features (`1.5.0`), **MAJOR** for breaking changes (`2.0.0`) — and says which part it bumped.
This command sets a **per-project** override in the project's `QWEN.md`: pass free text to pin
your own scheme, or `off` to opt that project out of the default.
· _Examples:_ `/versioning` · `/versioning use CalVer like 2026.07`

**`/autocompact` · `off` · `on` · `<0.3–0.99>` · `status`** — Auto-compaction switch. The
toolkit **disables qwen's auto-compaction by default** (threshold `1.0` — it can only fire at
a completely full window): compaction is lossy, durable state lives in `.qwen/PROGRESS.md`,
and `/checkpoint` compacts deliberately when *you* choose. `on` re-enables the stock behavior
(trigger at `0.7` of the input budget), a number sets a custom share, `off` returns to the
toolkit default. Edits `context.autoCompactThreshold` in `~/.qwen/settings.json` (**global**,
unlike most commands here); applies after a qwen-code restart. Paired with the `compact-warn`
hook below: when a compaction *does* run and shrinks history by **less than 15%**, you get a
warning that compacting this session further is pointless — wrap up and start fresh.
· _Example:_ `/autocompact on`

**`/bro` · `свобода` · `ламар` · `off` · `status`** — Talk to you like a homie instead of a
formal assistant, in one of two personas: `свобода` = a S.T.A.L.K.E.R. *Freedom* drifter who
always calls you "мэн", `ламар` = a GTA-V *Lamar Davis* street homie ("homie/foo/dog").
Casual, slangy and blunt, but still genuinely accurate and helpful — the vibe is a wrapper,
never an excuse to slack. Off by default; pinned **per-project** until `/bro off`.

### Skills (model- and user-invocable)

Unlike commands, the model can also invoke these **on its own** when they're relevant (or you
can run `/name`). Arguments in `<…>` are optional.

**`/brainstorm`** — Pins down *what* to build before any code. Clarifies and pressure-tests
the requirements — scope, success criteria, edge cases, constraints, what's explicitly out —
so a small context isn't spent building the wrong thing. Produces an agreed spec, records it
durably in `.qwen/PROGRESS.md` (it survives compaction — chat history doesn't), then hands
off to `/plan`.

**`/plan`** — Turns a fuzzy or large request into a concrete, **dependency-ordered task list**
in `.qwen/PROGRESS.md`, exploring an unfamiliar codebase first via the read-only `scout`
subagent. Produces a plan, not code — the durable starting point a build resumes from after
any restart or compaction.

**`/implement`** — The orchestrator for any multi-step build. Captures the goal, decomposes it
into right-sized tasks (≈ one module + its tests each), runs **each task in a fresh
`implementer` subagent**, ticks it off in `.qwen/PROGRESS.md`, and finishes with an
end-to-end check using the project's canonical command — actually **running** every named
entry point, not just importing it. Delegating instead of coding inline is what lets big
projects finish on a small context.

**`/checkpoint` · `restore`** — Curates the important state (goal, decisions, file map,
done/todo) into `.qwen/PROGRESS.md` so it survives lossy auto-compaction; `/checkpoint
restore` reloads it into context after a compaction or in a fresh session.

**`/gitflow`** — The git branch & deploy discipline, applied proactively whenever you
commit/push/merge/deploy: **new work → `dev` by default; `main`/`master` only on your explicit
approval**, with a sane deploy order (dev → test → confirm → main → prod). Backed at the
engine level by the `git-branch-guard` hook and released via `/main-push`.

**`/audit`** — A **security** review of architecture and code: hardcoded secrets, broken
authz, injection, SSRF, weak crypto, risky dependencies. Reports findings by severity and
fixes the clearly-safe ones. Run it before shipping anything touching auth, the network,
files, secrets or a database.

**`/review` · `<path>`** — A **correctness & quality** pass over the current diff (distinct
from `/audit`'s security focus): real bugs, mishandled edge cases, contract mismatches with
the spec, dead or over-complex code. Reports by severity, fixes the safe unambiguous ones,
and re-runs the tests to confirm they're still green.

**`/commit` · `<hint>`** — Stages the right files deliberately (not a blind `git add -A`) and
writes a clean **Conventional-Commits** message derived from the actual diff, not a guess.
Respects `gitflow` — commits to `dev`/a feature branch, never straight to `main` — won't
commit secrets, and doesn't push unless you ask.

**`/docs` · `<what changed>`** — Keeps documentation in sync with the code after a change:
`README.md` **and** `README.ru.md` kept in bilingual parity, usage examples that actually run,
help text and command tables. Accurate over comprehensive — it verifies names/flags against
the code and won't document things that don't exist.

**`/changelog` · `<version>`** — Builds a human-readable `CHANGELOG.md` entry from the git log
since the last tag, grouped Keep-a-Changelog style (Added / Changed / Fixed / …), rewriting
commit subjects into user-facing lines and proposing the next semver. Grounded in real
commits — no invented entries.

**`/release` · `check` · `<version>`** — Cuts a version release so the published tag / GitHub
Release never lags the code. Detects drift (latest tag vs the `VERSION` file vs the commits on
`main`) and, when a bump is ready, creates the annotated git tag and a GitHub Release with
notes from `CHANGELOG.md`. `/release check` reports the sync state without changing anything;
it refuses to release stale code (commits after the tagged version) or from `dev`.

**`/toolkit-update`** — Installs or updates **this toolkit itself** from GitHub in one
command: fetches the latest, runs the cross-platform installer, and verifies. Install and
update are the same operation; works from anywhere (needs `git` + `node`). This is purely
about getting the **latest released code** — for cleaning up settings a toggle left behind
in the wrong place, see `/toolkit-reset` below (a separate, unrelated command).

**`/toolkit-reset` · `confirm`** — Deterministic cleanup for settings an *older* toolkit
version left behind in the wrong (global) place — e.g. some toggles used to be pinned
globally and are per-project now (`/bro` before v1.8.0): a block left in the *global*
`~/.qwen/QWEN.md` from before that change keeps applying to every project forever, since no
current command manages it there anymore. `/toolkit-reset` sweeps those specific known
blocks (`bromode`/`covermode`/`devmode`/`maxagents`/`versioning`) out of the global file —
never touches a project's own `QWEN.md` — and reports exactly what it found or removed.
Pure local cleanup, no network, unrelated to `/toolkit-update`. **Requires confirmation, and
that confirmation is not optional or skippable by the model:** plain `/toolkit-reset`
*previews* what would be removed and opens a 15-minute approval window, changing nothing;
only `/toolkit-reset confirm`, typed by you within that window, actually removes anything.
A `toolkit-reset-guard` hook enforces the window at the engine level — even a model that
tried to call the confirm step directly via a shell command, skipping you, would be denied,
the same way `git-branch-guard` backstops `/main-push`.
· _Example:_ `/toolkit-reset` then, if the preview looks right, `/toolkit-reset confirm`

### Subagents (isolated context)

| Subagent | What it does |
| -------- | ------------ |
| `implementer` | Drives **one** task to a verified state: reads real files, implements fully (no stubs), verifies with the **canonical** command from the repo root (fixes packaging if a check only passes via a path trick). Returns a short summary. |
| `scout` | Read-only explorer — returns a compact digest (key files, wiring, conventions, real build/test commands) instead of bulk-reading into the main context. |
| `debugger` | Root-cause debugger — reproduces a failing test/error in its own context, finds the *real* cause (not the symptom), applies the minimal fix, verifies the repro + suite, returns a diagnosis. |
| `tester` | Independent **black-box** verifier — derives checks from the spec (not the code) and runs each acceptance criterion literally from a clean repo root; catches what implementers' self-written tests miss (a promised export that isn't there, a CLI that doesn't run). Reports per-criterion PASS/FAIL, fixes nothing. |
| `researcher` | Read-only library/API researcher — pins the version the project actually uses, verifies against official docs and the locally installed package, and returns a compact digest (real signatures, one working example, caveats) so nobody codes against a half-remembered API. |
| `verifier` | Adversarial fact-checker for **one** claim (a suspected bug, vulnerability, or "requirement met") — tries to *refute* it first (finds the validator/caller/test that handles the case), returns CONFIRMED / REFUTED / PLAUSIBLE with file:line evidence. Used to validate `/review` and `/audit` candidates. |

### Hooks (`~/.qwen/settings.json`)

| Hook | What it does |
| ---- | ------------ |
| `SessionStart` → `session-start-restore.js` | Re-injects `.qwen/PROGRESS.md` at session start / after compaction, so the model recovers the goal and next steps. |
| `PreCompact` → `pre-compact-steer.js` | Steers the built-in compressor to keep the goal, decisions, file list and done/todo. |
| `SessionStart(compact)` → `compact-warn.js` | Compaction-saturation warning: after a compaction, reads the real before/after token counts from the session transcript; if the history shrank by **less than 15%**, tells the model to warn you that compacting this session again is no longer effective (what's left is mostly already-compressed summary) and to suggest a fresh session after `/checkpoint`. Silent on healthy compressions. |
| `PreToolUse` → `secret-guard.js` | **Blocks** any write/edit/command containing a hardcoded credential (private keys, AWS/OpenAI/GitHub/Slack/HF tokens, …) or that commits a secret file (`.env`, `id_rsa`, `*.pem`). Env-var usage and placeholders pass. |
| `PreToolUse` → `git-branch-guard.js` | **Blocks** any `git push`/`merge`/`rebase` that would touch `main`/`master` (explicit target, or while checked out on it, or a switch-then-merge one-liner). Pushes to `dev`/feature branches and read-only git pass. Released for one operation by `/main-push`. |
| `PreToolUse` → `release-guard.js` | **Reminds** (never blocks) when a push advances `main`/`master` but the release would lag the code — a bumped `VERSION` with no matching tag, or commits past the released tag with no bump — injecting a note to run `/release` (or `/changelog` then `/release`). This is the deterministic backstop that makes `/release` fire even if the model forgets it. Silent when the release is in sync. |
| `PreToolUse` → `toolkit-reset-guard.js` | **Blocks** an attempt to run `/toolkit-reset`'s confirm step without a valid 15-minute approval window — closes the gap where a model could otherwise call the backend script directly via a shell command instead of waiting for you to type `/toolkit-reset confirm` yourself. Preview-only calls (no `confirm`) always pass. |
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
| `/autocompact` threshold | `context.autoCompactThreshold` in `~/.qwen/settings.json` | **Global** (applies after restart) |
| `/pin` memory | `<project>/FACTS.md` (gitignored) | **Project** |
| `/dev`, `/bro`, `/cover`, `/versioning` flags | block in `<project>/QWEN.md` | **Project** (sticky until `off`) |
| Task state | `<project>/.qwen/PROGRESS.md` | **Project** |

## Usage

```text
/brainstorm a URL shortener API      # pin down scope & acceptance criteria first
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
        "timeout": 1800000,
        "samplingParams": { "max_tokens": 16384 }
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
- **`samplingParams.max_tokens`** — without it, auto-compaction fires **way too early**
  (at roughly a third of your window, e.g. ~40–50k of a 115k window). Reason: when
  computing the compaction threshold qwen reserves an *escalated* output budget for the
  model's reply — `min(max(64000, known output limit), contextWindowSize/2)` — and for a
  GGUF-style id the lookup normalizes the model name to the part after the last `:`
  (`unsloth/Qwen3.6-…-GGUF:Q5_K_XL` → `q5_k_xl`), matches nothing, and the reserve balloons
  to **half the window**. An explicit `max_tokens` replaces that whole reserve: with a 115k
  window, `"samplingParams": { "max_tokens": 16384 }` moves the auto-compact trigger from
  ~40k to ~69k (`0.7 × (contextWindowSize − max_tokens)`). The value is also sent verbatim
  on the wire, capping each reply (16k is plenty for coding; it overrides llama.cpp's `-n`).

**Why the compaction trigger sits well below the window** (and why cranking it up trades
stability for capacity): before compaction may fire, the *next* request still has to fit —
the whole history **plus** the reply reserve (`max_tokens`); and the compaction itself is
one more LLM call that must fit the full uncompressed history **plus** up to 20 000 tokens
of summary output (`SUMMARY_RESERVE`), with a further 13 000-token buffer
(`AUTOCOMPACT_BUFFER`) because the check runs once per turn and a single turn's tool
results can add tens of thousands of tokens. Compacting "at 100%" is therefore impossible
by construction — the request that would do it already overflows the server. That's why
the stock trigger is `0.7` of the input budget, and why every step above it trades real
stability for a little capacity.

**The toolkit's stance: auto-compaction is OFF by default.** The installer sets
`context.autoCompactThreshold: 1` (fire only at a literally full window) unless you already
chose a value. Rationale: compaction is *lossy* by nature, and the toolkit already keeps
the durable state on disk — `.qwen/PROGRESS.md` + the `SessionStart` restore hook — so the
deliberate move is `/checkpoint` (compact *when you choose, keeping what matters*) instead
of a silent lossy squeeze mid-build. Re-enable stock behavior anytime with `/autocompact
on`, or pick your own trigger (`/autocompact 0.8`). And when a compaction *does* run but
shrinks history by **less than 15%**, the `compact-warn` hook flags that this session is
saturated — further compaction frees almost nothing, so finish the step and start a fresh
session.

### The stream-idle timeout (requests dying at exactly 240 s of silence)

qwen-code ≥ 0.19.3 aborts a streaming request after **240 s without a new SSE chunk**
(120 s in 0.19.3–0.19.7) with an error like
`[API Error: No stream activity for 240000ms after 1 chunks]`. On a shared local server
that silence is usually **legitimate** — the request is waiting in the server's FIFO queue
or prefilling a 100k context — and the automatic retry just re-enters the same queue, so
healthy requests keep dying. There is **no settings.json option** for this (a per-provider
setting is proposed upstream in
[QwenLM/qwen-code#5975](https://github.com/QwenLM/qwen-code/issues/5975)); it's controlled
only by the `QWEN_STREAM_IDLE_TIMEOUT_MS` environment variable — `0` disables it, any other
value is a new window in ms (the per-request `timeout` above still bounds the whole call):

- **macOS (zsh):** `echo 'export QWEN_STREAM_IDLE_TIMEOUT_MS=0' >> ~/.zshrc`, then open a
  new terminal (or `source ~/.zshrc`).
- **Linux / Ubuntu server (bash):** `echo 'export QWEN_STREAM_IDLE_TIMEOUT_MS=0' >> ~/.bashrc`,
  then re-login. For qwen running under a systemd unit add
  `Environment=QWEN_STREAM_IDLE_TIMEOUT_MS=0` to the unit instead.
- **Windows:** PowerShell:
  `[Environment]::SetEnvironmentVariable('QWEN_STREAM_IDLE_TIMEOUT_MS','0','User')`
  (or cmd: `setx QWEN_STREAM_IDLE_TIMEOUT_MS 0`), then open a new terminal.

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

**A reasoning model breaks the classifier a second way** — and raising the timeout won't fix
it. Stage 1 caps the reply at ~32 tokens, but a thinking model spends that budget on its
`<think>` phase and returns **empty content** → parsed as `unavailable` → blocked. The
classifier (or the fast model it uses) has to answer *without* thinking. On a llama.cpp
server that's a server-side default (`--chat-template-kwargs '{"enable_thinking":false}'`,
which also stops your **main** agent from reasoning) or a **separate non-reasoning fast
model**. Note that small purpose-built guard models (Llama Guard, Qwen3Guard, ShieldGemma)
classify *content harm*, not *destructive commands* — they won't catch `rm -rf /`. So if you
want the main agent to keep its reasoning, the robust path is **`yolo` + a hardened
`permissions.deny`** (disk wipes, `dd`, `mkfs`, pipe-to-shell, key reads, …) backed by the
`secret-guard` / `git-branch-guard` hooks, which fire in **every** mode including yolo.

## Requirements

- **qwen-code** (tested on **0.19.x**) + **Node.js**; **git** for the git features. Any
  provider; designed for small-context local models. Runs on macOS, Linux and Windows.

## Install / update

**Install and update are the same command** — re-run it any time and it refreshes in place.
It copies only this toolkit's own files into `~/.qwen`; your other skills, settings, API
keys and memories are left untouched. Cross-platform: **macOS · Linux · Windows** (one Node
installer — it wires bash backends on macOS/Linux and Node backends on Windows automatically).

(AI agent? — see the banner at the top of this README / [`INSTALL_FOR_AI.md`](INSTALL_FOR_AI.md).)

Prerequisites: **Node.js** + **qwen-code** (and **git** for the git features). The installer
checks them and prints what's missing.

```bash
./install.sh      # macOS / Linux
install.cmd       # Windows        (or: node install.js  — anywhere)
```

Then **restart qwen-code**. To update later, re-run the same command (or `/toolkit-update`
from inside qwen-code). To remove: `./uninstall.sh` / `uninstall.cmd`.

**Verify** (after restart): `/skills` lists `brainstorm, plan, implement, checkpoint,
gitflow, audit, review, commit, docs, changelog, release, toolkit-update`; `/agents manage` lists
`implementer, scout, debugger, tester, researcher, verifier`; `/status` responds.

## A typical end-to-end session

You mostly talk to it in plain language; the skills and guards fire on their own. The
subagents (`implementer`, `scout`, `tester`, `researcher`, `verifier`, `debugger`) are
**launched by the model itself** as a skill runs — you never call them by hand. This walks
the full loop and shows *when* to reach for each command.

```text
# ── one-time project setup (sticky, per-project) ───────────────────────────
> /pin model server 10.0.0.5:8080     # record infra facts it keeps forgetting (gitignored, compaction-proof)
> /maxagents 2                        # weak/shared box: cap parallel subagents so you don't overload the server
> /cover 80                           # optional: make every build test-first, ≥80% measured coverage

# ── 1. shape the work ──────────────────────────────────────────────────────
> /brainstorm <your fuzzy idea>          # e.g. "a URL shortener service in Python"
    ← use for a FUZZY idea. It interviews you, agrees scope + acceptance criteria + edge
      cases, and writes the spec into .qwen/PROGRESS.md so it survives compaction.

> /plan add a redirect endpoint with click analytics
    ← use for a CONCRETE but non-trivial task. Explores the repo via the scout subagent and
      decomposes it into small, dependency-ordered tasks in .qwen/PROGRESS.md. Design, not code.

# ── 2. build ───────────────────────────────────────────────────────────────
> /dev build it                       # (or /implement to just execute an existing plan)
    ← development mode ON (per-project, sticky): the model becomes an ARCHITECT and delegates
      each task to a fresh implementer subagent — it never writes source itself. It pulls a
      researcher digest for unfamiliar libraries, ticks PROGRESS.md as tasks land, and closes
      with an independent tester subagent that checks the acceptance criteria literally.
      Compaction mid-build? SessionStart reloads PROGRESS.md; it resumes at the first unchecked task.

> /status                             # anytime: what mode is on, the goal, the next unchecked task
> /checkpoint                         # before a risky step or a break: snapshot state (/checkpoint restore to reload)

# ── 3. verify ──────────────────────────────────────────────────────────────
> /review                             # general code review of the diff (bugs, edge cases) — scouts propose, verifier confirms
> /audit                              # security-focused pass (authz, injection, secrets) — every finding verified before it's reported

# ── 4. document ────────────────────────────────────────────────────────────
> /docs                               # sync README/docs to what changed (mirrors your translated README too)
> /changelog                          # roll changes into CHANGELOG.md (breaking changes surfaced first)

# ── 5. ship ────────────────────────────────────────────────────────────────
> запушь готовое           (or "commit & push")
    ← /commit writes a Conventional Commit; gitflow creates `dev` if missing and pushes to
      origin/dev. main is never touched (git-branch-guard blocks it); secret-guard blocks any
      key that tries to slip into a commit.

> выкати в main            (or "release to main")   # main is protected — it asks you to authorize
> /versioning              # (if you tag releases) confirm the bump scheme first
> /main-push               ← opens a 15-minute release window
> выкати в main            ← now it merges dev → main and pushes
> /release                 ← cut the tag + GitHub Release from CHANGELOG so the published release matches main

> /dev off                            # back to a single agent for quick Q&A
```

**Rules of thumb:** `/brainstorm` when the idea is vague → `/plan` when it's concrete but
big → `/dev` (or `/implement`) to build → `/review` for correctness, `/audit` for security →
`/docs` + `/changelog` → commit/push (dev) → `/main-push` then release (main) → `/release` to tag & publish. The point: you
never have to remember the branch rules, re-state the plan after a compaction, or babysit
which subagent does what — the toolkit handles it.

Other, as needed: **`/bro`** changes the tone/persona (per-project, like `/dev`);
**`/toolkit-update`** pulls the latest toolkit.

## Contributing to the toolkit itself

This section is **not** about `/dev` mode — it's for anyone editing the toolkit's own source
(the skills, hooks, and installer in this repo) and opening a PR. Changed something here? Run
the dependency-free test harness first: `node test/run.js` — it exercises the hooks'
allow/deny behavior, `/pin` backend parity (bash + Node), and a full installer round-trip,
all in temp dirs (your real `~/.qwen` is never touched).

MIT — see [LICENSE](LICENSE).
