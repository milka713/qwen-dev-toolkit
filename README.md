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
## Components

### Commands (deterministic, user-invoked)
Custom commands — the file change runs via a shell step (`!{…}`), so it's deterministic,
not left to the model. Everything the toolkit ships carries a `[toolkit]` signature: commands
and skills show it at the start of their description (so a toolkit item is easy to spot in the
`/` palette — names are unchanged, you invoke them exactly as before), and hooks put it on
the messages they surface (a guard's block reason, an injected notice), so whenever a hook
speaks it's clearly the toolkit.

Each keeps its state in a marked block in `QWEN.md` (or in `FACTS.md`), which is re-attached
to context every request and so survives compaction. Args are shown after each name.

**Side-effecting commands are locked to you.** On qwen-code 0.21.x a user command is *also*
model-invocable by default: it is listed in the model's `<available_skills>` and `SkillTool` can
run it through the same `action` — including the `!{…}` shell step, which `shellProcessor` only
prompts for when the command isn't already permitted. Under YOLO mode or a broad
`permissions.allow`, that would let the model grant itself root via `/sudo-on`, authorize a
protected-branch push via `/main-push`, or switch off its own guards with `/hooks off`.
So every command that changes state carries `disable-model-invocation: true` and can only be run
by you typing it. Read-only reporting — `/status`, `/doctor`, `/pin`, `/checkpoint`, `/applied` —
stays open, so the model can still consult it. A test enforces the split, and a new command has
to be classified deliberately.

**`/dev` · `on` · `off` · `status` · `<goal>`** — Development-mode switch: turns the session
into an **architect that delegates**. With it on, the model plans the work and hands every
implementation task to a fresh `implementer` subagent instead of coding in its own context —
which is exactly what lets a big build finish instead of overflowing and breaking after a
compaction. `on` pins the dev block into the project's `QWEN.md`; `off` removes it; `status`
reports; and `/dev <goal>` turns it on **and** starts building that goal in the same turn.
Idempotent — the rest of your `QWEN.md` is left intact. The "only subagents write code" rule
is enforced deterministically by the `devmode-guard` hook (see the hooks table), not left to
the model's discipline.
· _Example:_ `/dev build a REST API for todos with SQLite + tests`

**`/devedit <why>`** — Escape hatch for development mode. While `/dev` is on, `devmode-guard`
blocks the architect from editing source directly; when delegating one tiny edit is genuinely
pointless, `/devedit <reason>` authorises **exactly one** direct `write_file`/`edit`. The reason
is logged to `.qwen/PROGRESS.md`, the authorisation is single-use and auto-expires in 15 min —
so a bypass is deliberate and on the record, never a silent rationalisation.
· _Example:_ `/devedit fixing a single generated-file path, not worth a subagent`

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
project `FACTS.md` that's auto-loaded via an `@FACTS.md` include (so it survives compaction)
and is **gitignored** so it can't leak into the repo. `remove <text>` drops matching lines,
`clear` wipes all.
· _Example:_ `/pin deploy = ssh -p 12578 mark@host && ./deploy-dev.sh`

> **A pin reaches the context only from the *next* session.** qwen-code assembles `QWEN.md`
> and its `@`-imports **once, at startup**, and never re-reads them — there is no file watcher
> and no `/memory refresh` in 0.21.x. So a fact pinned mid-session is on disk but *not* in the
> running session's context, and a model asked to show it will honestly say it sees nothing.
> That is what **`/pin list`** (or a bare `/pin`) is for: it pins nothing and prints the whole
> memory into the conversation, between `PIN_BEGIN`/`PIN_END` markers that the command tells
> the model to relay verbatim. Use it to pull earlier pins back into a running session.
> The file is `FACTS.md` — capitalised; on Linux `facts.md` simply does not exist.

**`/status` · `global`** — Read-only "everything at a glance" for this project, in groups: the
**modes** pinned in `QWEN.md` (`/dev`, `/cover`, `/bro`, `/maxagents`, `/versioning`, `/reality`, `/research`);
the **active plan / development progress** from `.qwen/PROGRESS.md` (goal, done/remaining +
percent, next unchecked task — the live state of `/dev` or any plan you're executing); the
**guards/prohibitions** that can block a tool call (`secret-guard`, `git-branch-guard`,
`release-guard`, `toolkit-reset-guard`, the subagent cap); the non-blocking **automation hooks**;
pinned facts; and the toolkit version. `/status` is this project; `/status global` shows the
`~/.qwen` state. Modes are per-scope; hooks/guards live globally and apply everywhere. Changes
nothing. (`/applied` is a deprecated alias — use `/status`.)
· _Example:_ `/status global`

**`/doctor`** — Read-only self-diagnostic of the install. Checks that every hook script and
command backend is present, every toolkit hook is wired into `settings.json`, no guard is
accidentally disabled, there are no stale approval tokens or a leaked subagent counter, and —
if a model provider is configured — pings each server's `/health` with latency. Reports
OK/WARN/FAIL by section and names the fix (`/toolkit-update`, `/hooks on <name>`, or a server
that's down). Changes nothing.
· _Example:_ `/doctor`

**`/classifier-window <8..40>` · `status` · `reset`** — Speed up AUTO-mode permission checks on a
local fast model. The classifier prompt = a stable system prompt + the last N transcript messages;
that window slides on almost every call, busting llama.cpp's prefix cache and forcing a full cold
prefill each verdict (measured: same window 0.6s vs shifted one message 57.6s). This patches the
single constant `MAX_TRANSCRIPT_MESSAGES` in the installed qwen-code bundle — stock **40** (~33s on
the local 4B) down to e.g. **16** (~13s) — at **no change to safety** (same model, same prompt; it
only trims how many messages are shown). Deterministic: it finds the one definition across the
bundle's `chunks/*.js` or **fails loudly** rather than guess — refusing if the constant was renamed
upstream or appears more than once, backing up the pristine chunk once per version, and verifying
the write by re-reading it. Idempotent (re-run to reapply). Floor is **8** (below that a long
tool-call chain can leave the window with no user message, which the classifier needs to judge
intent); `reset` restores 40. **Takes effect only after you restart / re-open qwen-code.** A
qwen-code update (`brew upgrade`, `npm i -g`) replaces the bundle and silently reverts the window
to 40 — the `classifier-window-check` SessionStart hook notices the drift and reminds you to re-run
it.
· _Example:_ `/classifier-window 16` · `/classifier-window status` · `/classifier-window reset`

**`/settings-sync connect <github-url> private` · `push` · `pull` · `status` · `disconnect`** — Stop
hand-carrying `~/.qwen/settings.json` between machines. Point it at a GitHub repo you own and it
syncs your settings (providers, `fastModel`, `permissions`, `mcpServers`, …) through it — **entirely
over SSH** (`git@github.com:…`), no `gh` or HTTPS token, so it works on a machine set up with just an
SSH key. settings.json holds **secrets** (provider API keys, MCP tokens), so two safeguards:
- **SSH access is verified** with `git ls-remote` (BatchMode — a missing/unauthorised key fails fast
  instead of prompting) on `connect`, `push` and `pull`.
- **Privacy can't be checked over SSH** — the git protocol exposes no public/private flag (a private
  repo you can read and a public one answer identically). So instead of a check it can't do, `connect`
  requires an **explicit one-time confirmation**: `connect <url> private` — you assert the repo is
  private. It's recorded, and **`push` refuses** unless that confirmation is on record, so secrets
  never upload silently. (For automated privacy verification you'd need the GitHub API over HTTPS,
  which isn't SSH — deliberately out of scope here.)

Only the **portable core** is synced — `modelProviders`/keys, `fastModel`, `model`, `security`,
`mcpServers`, `env`, `memory`, `context`, `ui`. The **machine-specific** sections `hooks`
(toolkit-managed, absolute paths) and `permissions` (absolute local paths) are deliberately **left
per-machine**: push strips them from the repo, pull keeps this machine's own. Without this, a Mac's
`node "/Users/…/hooks/checkpoint-nudge.js"` would land in the repo and, pulled onto a Linux box
(home `/home/…`), make qwen fail every hook with *Cannot find module*. Each machine wires those up
itself via `node install.js`.

Direction is **always explicit and deterministic**: `push` writes local → repo, `pull` copies repo →
local (and **backs up** the local file first, validates the incoming JSON, and never touches this
machine's `hooks`/`permissions`).
There is deliberately **no bare "sync"** that guesses a direction. `status` shows the connected repo,
whether privacy was confirmed, live SSH reachability, and whether local differs from the repo;
`disconnect` forgets the repo (settings.json untouched). Pull takes effect after you **restart
qwen-code**. Requires `git` with an SSH key authorised on the repo.
· _Example:_ `/settings-sync connect https://github.com/me/qwen-code-settings private` → `/settings-sync push` … on another machine → `/settings-sync pull`

**`/sudo-on <password>` · `confirm` · `status` · `/sudo-off`**

> ## ☢️ EXTREME DANGER — FULL PASSWORDLESS ROOT FOR THE MODEL
> **This hands the local model full, passwordless `sudo` on the machine.** A mistaken or
> looping model — exactly the kind of small local model this toolkit is built for — can then
> **irreversibly destroy the system**: wipe files, drop firewall rules, brick services, with
> no second chance. There is **no undo**. Only ever enable this on a box you own and can
> afford to lose, for a specific task, and run **`/sudo-off` the instant you're done**.

Off by default; the command's mere presence grants nothing. `/sudo-on <password>` **stages**
the password and prints a loud red warning — nothing is active yet. Only `/sudo-on confirm`
(which **you** type, after the warning) actually enables it: it writes a root **askpass helper**
(`~/.qwen/.sudo-askpass`, `chmod 700`) so the model runs privileged commands as
`SUDO_ASKPASS=… sudo -A <cmd>` — the password is fed by the helper and **never appears in the
command line or the transcript** — and pins a `sudomode` block into the global `QWEN.md` so the
model knows root is open. `/sudo-off` wipes the password, the helper, and the block, so the
model can no longer `sudo` and forgets the password. `/sudo-on status` reports the state. A
safer alternative for most needs is scoped passwordless sudo (`/etc/sudoers.d/` `NOPASSWD` for
just the commands you need) — that limits the blast radius instead of granting blanket root.
· _Example:_ `/sudo-on 'mypass'` → read the warning → `/sudo-on confirm` … `/sudo-off` when done

**`/hooks` · `off <name|guards|all>` · `on [<name>]`** — Turn the toolkit's hooks off/on when a
guard is too strict and gets in the way, without uninstalling. `/hooks status` lists every hook
ON/OFF; `/hooks off git-branch-guard` disables one; `/hooks off guards` disables all five guards
at once; `/hooks on` re-enables everything. Off hooks stay wired but self-disable via
`~/.qwen/.hooks-disabled` (effective immediately, no restart). Disabling is **sticky and loud** —
a disabled guard is flagged here and in `/status` (`⚠ DISABLED`) so you never silently lose
protection (e.g. `secret-guard` off = nothing stops a committed secret). Bare `/hooks off` is
refused. Global scope.
· _Example:_ `/hooks off git-branch-guard`

**`/main-push` · `on` · `off` · `status`** — The user-only release valve for the protected
branch. By default the `git-branch-guard` hook blocks every push/merge to `main`/`master`. Three
modes:
- **`/main-push`** (bare) — **single-use**: authorizes **exactly one push to main**, covering the
  merge and the one push, then it's consumed **when the push actually succeeds** (the
  `main-push-consume` PostToolUse hook removes the token on a zero exit code). A push that is
  **blocked or fails does not** waste it — the model just fixes the error and retries under the
  same authorization; a genuinely second successful push needs `/main-push` again. An unused
  token expires after 15 min.
- **`/main-push on`** — **persistent**: every push/merge to main is allowed **until you run
  `/main-push off`**. No expiry, never consumed — for a run of back-to-back releases.
- **`/main-push off`** — revoke (back to the blocked default). **`status`** reports the current
  mode.

Because only you can run a slash command, this makes "yes, really release to main" un-fakeable
by the model.

**`/main-push-hint` · `off` · `status`** — One-time, per-machine setup for **Auto Mode**. There,
qwen-code classifies each shell command with an LLM **before** the `git-branch-guard` hook runs,
so the classifier — not the deterministic hook — is what gates a `git push` to `main`; it tends
to block main pushes on its own and even invents a belief that the `/main-push` token is "already
consumed" (from reading `/main-push`'s wording in the transcript), giving `Blocked by auto mode
policy` right after you authorized the release. This adds one entry to
`permissions.autoMode.hints.allow` telling the classifier to **defer** main-flow pushes to the
hook. Needs a **qwen restart**. It does not weaken anything — the hook + single-use token still
gate every main push. Run it once on each machine where you release in Auto Mode.

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

**`/reality` · `off` · `on` · `status`** — Honesty directive (integrity over agreement).
**ON by default in every project** — the assistant is held to a standing honesty directive: be
accurate rather than agreeable, separate fact / inference / opinion, state uncertainty plainly,
surface inconvenient truths (failed tests, skipped steps, real risks) without softening or
reframing, disagree directly when you or a plan are wrong, and never fabricate agreement or
confidence. A check on the model's own reasoning, not licence to be contrarian. The directive
lives in the global `~/.qwen/QWEN.md`; this command only lets a project **opt out** —
`/reality off` pins an opt-out in that project's `QWEN.md`, `/reality on` restores the default,
`/reality status` checks.
· _Example:_ `/reality off` (allow a normal tone in one specific project)

**`/research` · `off` · `on` · `status`** — Research-first directive (think before flailing).
**ON by default in every project.** It makes the model **investigate before thrashing**: when a
fix or build fails, a solution feels shaky/hacky, or information is missing, it looks at the
real current state → the project's docs → the web (or delegates to the `researcher` subagent)
**before** more blind edits or before asking you — and in `/brainstorm` it finds prior art
first. The detailed how-to (when to research, source order, how to search the web well) is the
`/research` **skill**. Like `/reality` it's a per-project **opt-out**: `/research off` disables
it in one project, `/research on` restores the default.
· _Example:_ `/research off`

### Skills (model- and user-invocable)

Unlike commands, the model can also invoke these **on its own** when they're relevant (or you
can run `/name`). Arguments in `<…>` are optional.

**`/brainstorm`** — Pins down *what* to build before any code. Clarifies and pressure-tests
the requirements — scope, success criteria, edge cases, constraints, what's explicitly out —
so a small context isn't spent building the wrong thing. Produces an agreed spec, records it
durably in `.qwen/PROGRESS.md` (it survives compaction — chat history doesn't), then hands
off to `/plan`.

**`/research`** — The **investigate-before-flailing** playbook (the standing directive is
on by default; see the `/research` command). Tells the model *when* to research (a failed
fix/build, a shaky solution, missing info, before touching live state, prior-art hunting in
brainstorm), *which* source to reach for (real current state → project docs → the web →
finally you), and *how to search the web well* (verbatim error strings, official docs, version
pins, bounded — no rabbit holes). Delegates deep API digs to the `researcher` subagent to keep
the main context lean.

Searching is the **default, not a fallback**: any question whose answer depends on something
outside the repo and the model's memory — a current/latest version, a release date, an
unfamiliar error, a library's real API or what changed between versions — gets searched
*before* it gets answered. Having to say "google it" means a trigger was missed.

It also names the search tool **correctly**, which is what previously made search get skipped:
MCP tools are exposed with a server prefix, so a SearXNG bridge appears as
`mcp__searxng__searxng_web_search`, **not** as the bare `searxng_web_search`. The skill now
matches **by suffix** (`*_web_search`), pre-approves both spellings in `allowedTools`, and is
told never to conclude "I have no web search" just because the bare name is absent.

**`/terminal`** — Hands a command off to the **user's own terminal** for the things the
model's non-interactive shell can't or shouldn't do itself: an interactive `sudo` password
prompt, `dd`/`diskutil`/formatting an SD card, flashing an OS image, or any long/interactive
session. It teaches the reliable macOS way (`open -a Terminal` a `.command` script — no
AppleScript escaping, **no Automation/Accessibility permission needed**, unlike the brittle
`keystroke` path), what each missing permission is and **how to grant it** rather than
silently failing, and device-safety for destructive ops (confirm the target disk, pause
before the wipe). It **always asks for an explicit yes** before handing anything off, and is
**blocked in `auto`/`yolo` modes** by the `terminal-guard` hook (no confirmation happens
there). The model *already* has this ability — the skill makes it use it, safely, instead of
stalling or faking success.

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
restore` reloads it into context after a compaction or in a fresh session. Ships **both as a
skill** (so the model reaches for it on its own, and the `checkpoint-nudge` hook can point at
it) **and as a file command**, so you can always run it by hand. qwen-code loads file commands
last, so the command owns the `/checkpoint` slash name and simply delegates to the skill —
one procedure, one template, no drift.

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

**`/toolkit-reset` · `project` · `global` · `confirm` · `undo`** — Bring the toolkit back to the shape
the **current version implies by default**, for a chosen scope. `/toolkit-reset` (or
`/toolkit-reset project`) resets **this project**; `/toolkit-reset global` resets the global
`~/.qwen`. It removes the toolkit's toggle blocks (`/dev`, `/cover`, `/bro`, `/maxagents`,
`/versioning`, `/reality`) from that scope's `QWEN.md` — turning those modes back to their
defaults — and, for the **global** scope, also resets the toolkit's global settings to
defaults: re-enables all hooks (clears `.hooks-disabled`) and puts auto-compaction back to its
default. This also cleans stale blocks an older version pinned in the wrong place (e.g. a
global `/bro` from before v1.8.0). Pure local cleanup, no network, unrelated to
`/toolkit-update`. **Requires confirmation in both scopes, and it isn't skippable by the
model:** a plain run *previews* what would change (with a destructive-action warning) and opens
a 15-minute window, changing nothing; only `/toolkit-reset confirm`, typed by you within that
window, applies it (to the scope you previewed — the token remembers it). A
`toolkit-reset-guard` hook enforces the window at the engine level, the same way
`git-branch-guard` backstops `/main-push`. It's **reversible**: before applying, it snapshots
the pre-reset state, so `/toolkit-reset undo` restores it one level back (run it in the same
project you reset).
· _Example:_ `/toolkit-reset global` then, if the preview looks right, `/toolkit-reset confirm`

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
| `SessionStart(compact)` → `compact-warn.js` | Compaction-saturation guard: after a compaction, reads the real before/after token counts from the session transcript; if the history shrank by **less than 15%**, it (a) tells the model to warn you that compacting this session again is no longer effective, and (b) **latches auto-compaction off** (`autoCompactThreshold` → 1, if it was on) so qwen-code stops retrying a compaction that on a reasoning model can come back empty and hard-fail the turn — handing over to `/checkpoint` + a fresh session. Silent on healthy compressions. |
| `SessionStart` → `classifier-window-check.js` | Warns when a qwen-code update (`brew upgrade`/`npm i -g`) replaced the bundle and reverted the `/classifier-window` patch back to the stock 40 — compares the live bundle value to your recorded preference (`~/.qwen/.classifier-window`) and prints a one-line reminder to re-run `/classifier-window <N>`. Read-only; silent when they match or no preference is set. |
| `PreToolUse` → `secret-guard.js` | **Blocks** any write/edit/command containing a hardcoded credential (private keys, AWS/OpenAI/GitHub/Slack/HF tokens, …) or that commits a secret file (`.env`, `id_rsa`, `*.pem`). Env-var usage and placeholders pass. |
| `PreToolUse` → `git-branch-guard.js` | **Blocks** any `git push`/`merge`/`rebase` that would touch `main`/`master` (explicit target, or while checked out on it, or a switch-then-merge one-liner). Pushes to `dev`/feature branches and read-only git pass. Unlocked by `/main-push` — single-use (`.main-approval` = `once`, 15-min TTL) or persistent (`= persistent`, from `/main-push on`, no TTL). This guard only **allows** while a valid token is present; it never consumes it (so a blocked/failed push doesn't burn the authorization). |
| `PostToolUse` → `main-push-consume.js` | Companion to `git-branch-guard`: **consumes** the single-use `/main-push` token — deletes `~/.qwen/.main-approval` — but only when a `git push` to `main`/`master` actually **succeeded** (zero exit code). A push that was blocked (Auto-Mode classifier) or failed leaves the token intact for the retry; a bare merge (no push) never consumes it. Silent; enforces "one *successful* push" without burning the token on attempts that never landed. |
| `PreToolUse` → `release-guard.js` | **Reminds** (never blocks) when a push advances `main`/`master` but the release would lag the code — a bumped `VERSION` with no matching tag, or commits past the released tag with no bump — injecting a note to run `/release` (or `/changelog` then `/release`). This is the deterministic backstop that makes `/release` fire even if the model forgets it. Silent when the release is in sync. |
| `PreToolUse` → `toolkit-reset-guard.js` | **Blocks** an attempt to run `/toolkit-reset`'s confirm step without a valid 15-minute approval window — closes the gap where a model could otherwise call the backend script directly via a shell command instead of waiting for you to type `/toolkit-reset confirm` yourself. Preview-only calls (no `confirm`) always pass. |
| `PreToolUse` → `devmode-guard.js` | Makes development mode's core rule deterministic: while `/dev` is on for a project, **blocks** the architect (main session) from writing source/tests/config with `write_file`/`edit` — that work must go to an `implementer`/`debugger` subagent. Subagents are exempt (they're the sanctioned writers, detected via `QWEN_CODE_AGENT_ID`); the architect's own `PROGRESS.md`/`QWEN.md`/`FACTS.md` writes pass. `/devedit <why>` authorises exactly one direct edit (logged to `PROGRESS.md`, single-use, 15-min expiry). Inert when `/dev` is off. |
| `PreToolUse` → `terminal-guard.js` | Backs the `/terminal` skill: **blocks** a terminal handoff (`open -a Terminal` / `osascript … do script` / `keystroke` to Terminal) when the approval mode is `auto` or `yolo` (read from the hook's `permission_mode`) — those modes auto-approve, so a destructive handoff (`dd`, format, flash) must not fire unwatched. Passes in `default`/`auto-edit`/`plan`, and passes any non-handoff command. |
| `UserPromptSubmit` → `skill-reminder.js` | Small local models under-trigger model-invoked skills; this injects a short, targeted reminder (e.g. "looks security-related → `/audit`") only when the prompt clearly matches, so the right skill actually fires. Matches **both English and Russian** prompts. Silent on trivial prompts. |
| `PreToolUse`/`PostToolUse`/`SessionStart` → `agent-limit.js` | Enforces `/maxagents` deterministically: counts running subagents and **denies** `agent` launches beyond the cap (concurrency-safe via a lock), decrements when one finishes, resets each session. No cap set → no-op. |
| `Stop` → `checkpoint-nudge.js` | Two guards, each holds the turn once (loop-safe): **(1)** keeps `.qwen/PROGRESS.md` honest — if code was edited but the checkpoint still has unchecked tasks and wasn't updated, it makes the model tick the finished boxes first; **(2)** proactive context-fill guard — when qwen-code (0.20.x+) reports the window ~88%+ full, it forces `/checkpoint` + a fresh session **before** the window fills and an auto-compaction can fire-and-fail. Degrades to silent on older qwen-code / no `PROGRESS.md`. |

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
| `/dev`, `/bro`, `/cover`, `/versioning`, `/reality` flags | block in `<project>/QWEN.md` | **Project** (sticky until `off`) |
| Task state | `<project>/.qwen/PROGRESS.md` | **Project** |

## Usage

```text
/brainstorm a URL shortener API      # pin down scope & acceptance criteria first
/dev                                 # development mode (architect + delegation)
/cover 80                            # test-first, require ≥80% measured coverage
/maxagents 2                         # cap parallel subagents (weak hardware)
/pin model server 10.0.0.5:8080      # remember infra facts (compaction-proof, gitignored)
/pin list                            # print everything pinned, into this conversation
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

- **qwen-code** (tested on **0.19.8–0.21.10**) + **Node.js**; **git** for the git features. Any
  provider; designed for small-context local models. Runs on macOS, Linux and Windows.

Notes on qwen-code 0.21.x, checked against the 0.21.10 sources:

- **Nothing upstream replaces the toolkit.** `/summary` writes a project *description*, not the
  checkbox work-state `/checkpoint` keeps; `/compress` is the lossy compaction we work around;
  the built-in `/remember`–`/memory` family is qwen's own memory store, separate from `/pin`'s
  `FACTS.md`. `/learn` and `/curator` are new but adjacent — `/curator` only ever touches
  `.qwen/skills/auto-skill-*` directories whose frontmatter says `source: auto-skill`, so the
  toolkit's hand-authored skills are never archived by it.
- **`/pin`'s read-out is still needed.** 0.21.x can refresh context files mid-session, but only
  via `refreshContextFilesOnWrite`, which is set solely by the built-in `/remember` and is not
  reachable from a markdown command — so a mid-session pin still won't appear in that session's
  context, and printing the facts into the transcript remains the fix.
- **Name shadowing:** the file-command loader runs last, so a toolkit command wins over a
  built-in of the same name (`/doctor`, `/hooks`); toolkit skills likewise shadow the bundled
  `review` and the built-in `/plan` and `/docs`. This is intentional, but worth knowing if you
  came looking for the upstream behaviour.
- New in 0.21.x and worth a look, though the toolkit does not depend on it: the `compactionModel`
  setting (`/model --compaction`) can point auto-compaction at a small fast model.

## Install / update

**Install and update are the same command** — re-run it any time and it refreshes in place.
It copies only this toolkit's own files into `~/.qwen`; your other skills, settings, API
keys and memories are left untouched. Cross-platform: **macOS · Linux · Windows** (one Node
installer — the command logic is a single set of Node backends on every OS; on macOS/Linux they are invoked through thin bash wrappers, on Windows directly).

(AI agent? — see the banner at the top of this README / [`INSTALL_FOR_AI.md`](INSTALL_FOR_AI.md).)

Prerequisites: **Node.js** + **qwen-code** (and **git** for the git features). The installer
checks them and prints what's missing.

> **qwen-code compatibility:** tested on **qwen-code 0.19.8 – 0.21.10**. Everything works on
> 0.19.x; the one feature that needs **0.20.x+** is `checkpoint-nudge`'s proactive
> context-fill guard (it reads `context_usage` from the `Stop` event, which older versions
> don't send — there it simply stays silent). Run `/doctor` to see your version and health.

```bash
./install.sh      # macOS / Linux
install.cmd       # Windows        (or: node install.js  — anywhere)
```

Then **restart qwen-code** — still the reliable way, though on qwen-code ≥ 0.21 much of it now
lands live: skill directories are watched (`SkillManager.startWatching`, except in bare mode)
and `hooks` is a hot-reloadable settings key, so an install into a running session usually takes
effect on its own. Context files (`QWEN.md` and its `@FACTS.md` import) are **not** watched — they
are assembled once at session start — so a restart is the only way to pick those up.

To update later, re-run the same command (or `/toolkit-update`
from inside qwen-code). To remove: `./uninstall.sh` / `uninstall.cmd` — it deletes only the
toolkit's own files, strips its hook entries and clears its toggle blocks from the **global**
`~/.qwen/QWEN.md`; per-project toggle blocks stay (clear them with `/toolkit-reset project`
per project, before uninstalling).

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
> /main-push               ← authorizes exactly one push to main (single-use)
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
