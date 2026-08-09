# Changelog

All notable changes to qwen-dev-toolkit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com); versions follow semver.
(Releases before 1.7.0 predate this file and are not backfilled — see the git history.)

## [1.28.1] - 2026-08-09

### Fixed
- **`/checkpoint` could stall before writing anything.** End-to-end testing (a real interactive
  session under a pty, not `-p`) caught it: the skill said *"get the timestamp from
  `date '+%F %H:%M'` — don't guess it"*, so the model ran a shell command **before** writing the
  file, hit `Allow execution of: 'date'?` and sat there. Nothing reached disk. Now the write
  comes first and **no shell command may run before the file exists** — the `_Updated:_` line
  takes a best-known date (or `(timestamp pending)`) and is corrected afterwards. Verified: a
  complete `.qwen/PROGRESS.md` with the canonical sections, checkboxes and a `↳ state:` line is
  now produced in one pass.
- **The `/checkpoint` command no longer delegates to the skill.** Measured: the delegation hop
  plus the skill's "curate" framing sent a small model into 35–59 turns of `glob`/`grep`/
  subagent exploration with **zero `write_file` calls**. The command is now imperative — the
  write is ordered as the first tool call — and carries hard limits (no subagents, no
  `tool_search`, no tree sweeps, at most one read). The skill keeps the same procedure with the
  full rationale for the model-invoked path, and gained the same budget note.

### Notes on testing
`qwen -p` is **not** a faithful harness for slash commands: a command's `!{...}` shell step is
refused outright (`blocked by permission rules`, which is how `/pin list` fails there), and the
command body never appears in the `stream-json` transcript. Interactive verification needs a
pty (`script -qec "qwen -i '/checkpoint'"`). `/checkpoint restore` was confirmed to read the
checkpoint and sanity-check it against `git status` / `git log`; its closing restatement was not
observed because the crude auto-answer used for the pty typed into the prompt and cancelled the
turn — a harness limit, not a defect.

## [1.28.0] - 2026-08-08

### Fixed
- **Web search was named wrong, so the model concluded it had none.** MCP tools are exposed
  as `mcp__<server>__<tool>`, so a SearXNG bridge is `mcp__searxng__searxng_web_search` — the
  bare `searxng_web_search` that `/research` listed and described **matches nothing**. Since
  `allowedTools` entries are session *allow* rules (`addSessionAllowRule`), the wrong name also
  failed to pre-approve the real tool. Both spellings are now listed, and the skill and the
  always-on guidance tell the model to **match by suffix** (`*_web_search`), to use
  `tool_search` when the tool list is long, and **never** to conclude "I have no web search"
  because a bare name is missing.

### Added
- **Searching is now the default, not a fallback.** A new always-on directive plus a rewritten
  `/research` trigger list: any answer that depends on something outside the repo and the
  model's own memory — a current/latest version, a release date, an unfamiliar error, a
  library's real API, what changed between versions — is searched **before** it is answered.
  Having to say "google it" is treated as a missed trigger.
- **"Use what the user already gave you."** A second always-on directive: before asking for or
  guessing at a host, port, path, URL, command, credential *location* or standing rule, check
  `FACTS.md`, `.qwen/PROGRESS.md`, `QWEN.md` and the repo — and never substitute a placeholder
  where a pinned real value exists. `/research`'s source order now starts there too.
- **`FACTS.md`'s header is an instruction, not a caption.** It is imported verbatim, so it is
  the cheapest place to say these lines are authoritative, must be used without reminding, and
  — because the import is a session-start snapshot — that the file should be **re-read from
  disk** when something looks missing. The `@FACTS.md` import in `QWEN.md` carries the same
  directive. Projects wired by an older toolkit are **migrated in place** on any `/pin`
  invocation (including read-only `list`), keeping their facts, idempotently.
- **`skill-reminder` rules for both failures**: "I already gave you that" / «я тебе уже давал»
  points at re-reading `FACTS.md` from disk; "latest version" / «последняя версия» / "google
  it" / «погугли» push to the web and name the MCP-prefixed tool. After the first measurement
  showed the search side unchanged, two more rules were added for the cases that actually
  failed: a **concrete error identifier** in the prompt (`ERR_PNPM_OUTDATED_LOCKFILE`, `TS5109`,
  `TypeError:`) and **"is X still the recommended way" / "best practice"** — the earlier pattern
  required `still <word>` and so missed the natural "still **the** recommended way".

### Measured on the live 27B (eros, `qwen -p -o stream-json`, tools read off the event stream)

Nine scenarios, each a fresh project and one question; four deliberately **non-leading** (they
never say "search" or "latest"). Same harness before and after; only the toolkit changed.

| | baseline 1.27.0 | 1.28.0 |
|---|---|---|
| Pinned facts (F1–F5) | **3/5** | **5/5** |
| Web search (S1–S4) | **1/4** | **3/4** |
| Total | **4/9** | **8/9** |

What flipped, and why it is believable: F2/F5 (fact on disk, *not* imported — the mid-session
pin case) went from the model rummaging with `glob`/`grep` and giving up, to `read_file` on
`FACTS.md` and answering with the pinned value — `read_file` on that file appears in the
after-run tool stream and is absent from the baseline's. S2/S4 went from no tool calls at all
to `mcp__searxng__searxng_web_search`, and S4's answer changed from stale memory to the correct
current one (`pyproject.toml`, not `setup.py`).

Honest caveats: **S3 still does not search** — but it read the real `tsconfig.json` and gave the
correct fix, which is step 1 of the skill's own source order, so scoring it as a failure is
arguably the benchmark's fault, not the model's. Single runs are **noisy**: F2 passed in one
baseline sweep and failed in another, and F5 failed once on the final build before passing
**3/3** on repeat. Treat 4/9 → 8/9 as a strong directional result, not a precise number.

## [1.27.0] - 2026-08-06

### Added
- **`/checkpoint` is now a file command as well as a skill.** The procedure only existed as a
  skill, so it was model-invocable but could not reliably be run by hand — and a model that
  failed to find a *command* by that name reported the checkpoint machinery as missing from the
  installation (it was not: the skill, the `checkpoint-nudge` Stop hook and its wiring all
  verified healthy). `commands/checkpoint.md` now owns the `/checkpoint` slash name —
  qwen-code's `FileCommandLoader` runs last, so a file command deterministically wins over the
  skill's slash entry — and **delegates to the `checkpoint` skill** rather than restating the
  procedure, keeping one template shared with `/plan` and `/implement`. A hand-written fallback
  is included for the case where the skill cannot be invoked.

### Fixed
- **`/pin` now admits that a fresh pin is invisible to the running session.** qwen-code
  assembles `QWEN.md` and its `@`-imports **once at startup** and never re-reads them (no file
  watcher; `/memory` in 0.21.x opens a dialog, not a `refresh`). A fact pinned mid-session was
  therefore on disk but absent from context — while the old wording ("loaded into context every
  session") and `pin.md`'s "confirm what is now remembered" had the model cheerfully confirm a
  fact it could not see, then deny seeing anything when asked to show it. `/pin` now prints a
  `PIN_NOTE` stating the fact lands in context from the **next** session, and `pin.md` passes
  that on honestly. Verified end-to-end against a live session: a fresh session recites the
  pinned canary, and with the `@FACTS.md` import removed it correctly answers `NONE`.
- **`/pin list` is a real read-out.** Bare `/pin` / `list` / `show` / `status` now report the
  fact count and absolute path and emit the facts between `PIN_BEGIN`/`PIN_END` markers, which
  `pin.md` instructs the model to reproduce **verbatim** — making this the reliable way to pull
  facts pinned earlier in the same session back into the conversation. Empty memory says "0
  facts" instead of printing an empty block. `pin.md` also notes the file is `FACTS.md`,
  capitalised — on Linux `facts.md` does not exist, which is its own way to "not see" a pin.
- **Frontmatter descriptions are quoted.** Every skill/command description opens with the
  `[toolkit]` badge, and unquoted a leading `[` starts a YAML flow sequence — `description:
  [toolkit] text` is malformed YAML that only worked because the parser qwen-code bundles
  recovers from it. A strict parser rejected **all 35** files. Now quoted and verified against
  both: qwen-code's own `SkillManager` (14/14 skills, descriptions intact) and a strict parser
  (36/36, previously 0/35). A regression test fails the build on any bare YAML indicator
  character in a description.

## [1.26.0] - 2026-08-04

### Added
- **`/main-push on` — persistent authorization.** `/main-push` now has three modes instead of a
  single one-shot: bare **`/main-push`** stays single-use (one *successful* push, 15-min unused
  TTL, consumed by `main-push-consume`); **`/main-push on`** grants a **persistent** authorization
  — every push/merge to main allowed until **`/main-push off`**, with no expiry and never consumed
  — for a run of back-to-back releases; **`/main-push off`** revokes (the blocked default). The
  mode is recorded in `~/.qwen/.main-approval` (`once` vs `persistent`); `git-branch-guard`
  ignores the TTL for a persistent token and `main-push-consume` never consumes one. `status`
  reports which mode is active. (Empty legacy tokens are treated as single-use.)

## [1.25.0] - 2026-08-04

### Fixed
- **`/main-push` no longer "burns" on a push that never landed.** The single-use token was
  consumed by the `git-branch-guard` **PreToolUse** hook the moment it *authorized* a push —
  i.e. *before* the push ran. So a push that was then blocked (by qwen-code's Auto-Mode
  classifier) or failed (bad auth, `git switch main` on a not-yet-created `main`, non-fast-forward)
  still spent the authorization, and the model was told the token was "already consumed" while no
  push had landed — needing a fresh `/main-push` for every retry.
  - The guard now only **allows** while the token is present; it never consumes. A new **PostToolUse**
    hook **`main-push-consume`** deletes the token only when a push to `main`/`master` actually
    **succeeds** (checked via the shell exit code). Blocked/failed attempts leave the authorization
    intact, so the model just fixes the error and retries under the same `/main-push`.

### Added
- **`/main-push-hint`** — one-time, per-machine setup so **Auto Mode** stops blocking authorized
  main pushes. In Auto Mode qwen-code sends each shell command to an LLM classifier **before** the
  toolkit's PreToolUse hook runs, so the classifier — not the deterministic hook — is what actually
  gates a `git push` to `main`. It tends to block main pushes on its own and (reading `/main-push`'s
  "single-use, then consumed" text in the transcript) invents a belief that the token is already
  spent, giving `Blocked by auto mode policy` even right after `/main-push`. This command adds one
  natural-language entry to `permissions.autoMode.hints.allow` telling the classifier to **defer**
  main-flow pushes to the `git-branch-guard` hook. `on` / `off` / `status`; needs a qwen restart
  (`requiresRestart`). It does **not** weaken protection — the hook + token still gate every main push.
- **`/gitflow` and `/main-push` now handle a first release** (no `main` anywhere): they create it
  from `dev` (`git push origin dev:main`) instead of looping on `git switch main`
  (`fatal: invalid reference: main`), and explain the `Blocked by auto mode policy` case + `/main-push-hint`.

## [1.24.1] - 2026-08-02

### Fixed
- **`/settings-sync` no longer syncs machine-specific sections** — it was copying the whole
  `settings.json`, including the toolkit's `hooks` block, whose commands are **absolute paths for
  the machine that pushed** (e.g. `node "/Users/milka/.qwen/hooks/checkpoint-nudge.js"`). Pulled
  onto another machine (Linux home `/home/…`, or a different toolkit version), qwen tried to run
  those non-existent paths and failed **every hook** with `Cannot find module …/checkpoint-nudge.js`.
  - Sync now moves only the **portable core** (`modelProviders`/keys, `fastModel`, `model`,
    `security`, `mcpServers`, `env`, `memory`, `context`, `ui`). `hooks` and `permissions` (also
    full of absolute local paths) are **excluded**: `push` strips them from the repo, `pull` keeps
    this machine's own. Each machine owns those via its `node install.js`.
  - **Remediation on an already-broken machine:** update the toolkit and re-run `node install.js`
    (or `/toolkit-update`) — the installer rewrites the `hooks` block with that machine's correct
    paths. Then `pull` is safe (it preserves the local `hooks`/`permissions`).

## [1.24.0] - 2026-08-02

### Changed
- **`/settings-sync` is now SSH-only** — it no longer uses `gh` or the GitHub HTTPS API at all, so
  it works on a machine set up with just an SSH key (the common case). Everything goes over
  `git@github.com:…`.
  - **Access** is verified with `git ls-remote` over SSH (BatchMode + short ConnectTimeout, so a
    missing/unauthorised key fails fast instead of hanging on a prompt) — on connect, push and pull.
  - **Privacy**: a repo's public/private state **cannot be determined over SSH** (the git protocol
    exposes no such flag). So the mandatory-privacy behaviour changes from a `gh`-based check to an
    **explicit one-time confirmation**: `connect <url> private`. The confirmation is recorded
    (`privateAck` in `~/.qwen/.settings-repo`) and **`push` refuses** unless it's present — secrets
    still never upload without a deliberate acknowledgement, but now with zero HTTPS/`gh` dependency.
  - `status` reports the recorded privacy confirmation + live SSH reachability. A repo connected by
    the old (pre-1.24) `gh` flow has no `privateAck`, so `status` flags it and `push` asks you to
    reconnect with `connect <url> private`.

## [1.23.1] - 2026-08-01

### Fixed
- **Docs completeness:** the `classifier-window-check` SessionStart hook (added in 1.22.0) was
  described in the `/classifier-window` command entry but missing as a row in the **Hooks** table
  of README.md / README.ru.md. Added it, so every shipped hook now appears in the hooks table.
  Full audit: all 20 commands, 14 skills, 6 subagents, and 14 hooks are documented in both READMEs.

## [1.23.0] - 2026-08-01

### Added
- **`/settings-sync connect <github-url> · push · pull · status · disconnect`** — sync
  `~/.qwen/settings.json` across machines through a **private** GitHub repo, so you stop
  hand-carrying qwen-code config around.
  - **Mandatory privacy check.** settings.json holds secrets (provider API keys, MCP tokens), so
    `connect` refuses any repo not confirmed **private** via `gh`, and **every `push` re-checks**
    it before uploading — secrets never leave for a repo that's public.
  - **Access check.** `connect`/`push`/`pull` also verify **this machine can actually reach the
    repo over git** (`git ls-remote` / SSH), not just that `gh` can see it — so a machine whose key
    isn't authorised fails early with a clear message instead of a confusing clone error.
  - **Explicit, deterministic direction.** `push` = local → repo, `pull` = repo → local. There is
    no bare "sync" that guesses; `pull` **backs up** the local file (`settings.json.bak-<ts>`) and
    validates the incoming JSON before overwriting, and reports a no-op when already in sync.
  - `status` shows the connected repo, its live privacy + access state, and whether local differs
    from the repo; `disconnect` forgets the repo and its clone, leaving settings.json untouched.
    Uses a persistent working clone at `~/.qwen/.settings-sync-repo`; state in `~/.qwen/.settings-repo`.

## [1.22.0] - 2026-08-01

### Added
- **`/classifier-window <8..40> · status · reset`** — a new command that sets the fast-model
  permission-classifier's transcript window by patching the single constant
  `MAX_TRANSCRIPT_MESSAGES` in the **installed qwen-code bundle**. The classifier prompt is a
  stable system prompt + the last N transcript messages; that window slides on nearly every call,
  busting llama.cpp's prefix cache and forcing a full cold prefill per verdict (measured: same
  window 0.6s vs shifted one message 57.6s). Lowering N (stock **40** ≈ 33s on the local 4B →
  **16** ≈ 13s) shortens the prompt with **no change to safety** — same model, same prompt, just
  fewer messages shown. Floor **8** (below that a long tool-call chain can leave zero user
  messages, which the classifier needs to read intent).
  - **Deterministic or nothing.** Resolves the bundle from `which qwen` (never hard-codes the
    path — it differs per platform and the chunk filename carries a content hash), then requires
    **exactly one** `MAX_TRANSCRIPT_MESSAGES` definition across `chunks/*.js`. Zero matches
    (renamed upstream) or more than one → it **fails loudly and writes nothing**, rather than
    guess. Backs up the pristine chunk once per version (`<chunk>.qdt-bak`), and **verifies the
    write by re-reading** — never reports success off the write call alone.
  - **Idempotent** (re-running the same value is a no-op) so it doubles as the recovery step.
  - New **`classifier-window-check` SessionStart hook**: a qwen-code update replaces the bundle
    and silently reverts the window to 40; the hook compares the live value to the recorded
    preference (`~/.qwen/.classifier-window`) and prints a one-line reminder to re-apply.
  - Not writable (root-owned install) → the command fails with the exact `sudo perl -i` one-liner
    to run. Applies at the next qwen-code start (the command warns to restart).

## [1.21.3] - 2026-07-31

### Changed
- **`/research` skill now recognises an MCP-provided web search.** Earlier wording assumed
  keyword web search only exists as the built-in `web_search` (usually absent on a purely
  local setup). It can also arrive via an **MCP server** — e.g. a self-hosted SearXNG bridge
  exposing `searxng_web_search` (+ `web_url_read`), or any `*_web_search` tool. The skill now
  tells the model to check its tool list and use whichever search tool is present under any
  name, so a locally wired-up search is actually used instead of being dismissed as
  unavailable. `allowedTools` gains `searxng_web_search` / `web_url_read`; wording stays
  generic (no private instance details baked in).

## [1.21.2] - 2026-07-30

### Added
- **`terminal-guard` hook — the `/terminal` handoff now requires the user in the loop.**
  Two safety changes to the terminal-handoff added in 1.21.1:
  - **Explicit confirmation before every handoff.** The `/terminal` skill now mandates
    showing the exact command, saying what it will do (which device, `sudo`, irreversible),
    and getting a **direct yes** before opening the terminal — a general earlier "do
    whatever" is not consent for a specific destructive command.
  - **Disabled in `auto` and `yolo` modes.** Those approval modes auto-approve everything,
    so a destructive handoff (`dd`, format, flash) could fire with nobody watching. The new
    `terminal-guard` `PreToolUse` hook detects a Terminal handoff (`open -a Terminal` /
    `osascript … do script` / `keystroke` to Terminal) and **blocks it when
    `permission_mode` is `auto` or `yolo`** (the mode is read from the hook payload),
    telling the model to switch back to default approval and confirm there. Every other
    command, and every other mode (`default`, `auto-edit`, `plan`), passes untouched.

## [1.21.1] - 2026-07-30

### Added
- **`/terminal` skill — hand a command to the user's own terminal.** The model's
  `run_shell_command` is non-interactive: it can't answer a `sudo` password prompt, drive a
  curses UI, or safely do irreversible disk work (`dd`, formatting an SD card, flashing an
  image). The model *can* open the user's real terminal for these, it just doesn't realise
  it. This skill teaches the reliable way — on macOS, write the command to a `.command`
  script and `open -a Terminal <file>` (no AppleScript escaping, and **no Automation/
  Accessibility permission needed**, unlike the brittle `keystroke` path that fails with
  *"osascript is not allowed to send keystrokes (1002)"*). It covers the `osascript … do
  script` alternative, **what each missing permission is and how to grant it** (System
  Settings → Privacy & Security → Automation / Accessibility) instead of silently failing,
  device-safety for `dd`/format (confirm the target disk, pause for the user before the
  destructive step), and Linux/Windows equivalents. A short awareness line in the global
  `QWEN.md` and a `skill-reminder` rule (EN+RU: "dd", "flash the sd card", "прошей образ",
  "отформатируй карту", …) make the model reach for it instead of stalling or faking success.

### Changed
- **`/commit` now requires a descriptive body for non-trivial commits.** Anything that's a
  feature, a fix, a refactor, or touches more than one file must explain *what changed and
  why* (motivation / root cause) plus non-obvious consequences — grounded in the diff, not a
  restatement of the header. Trivial one-liners (typo, version bump) may stay header-only.
- **`/research` skill:** reinforced the web guidance to **trust a constructed doc URL** —
  the model is usually right about canonical doc-URL shapes, so build the obvious one and
  `web_fetch` it (adjust on a 404), which works even with no `web_search` tool.

## [1.21.0] - 2026-07-30

### Added
- **`/research` — a "research-first" directive + skill, ON by default in every project.** The
  expensive failure mode for a small local model is *thrashing*: retrying variations of a broken
  fix without new information, burning context and time. This makes "investigate before you
  flail" a standing behaviour. When a fix/build fails, a solution feels shaky/hacky, or info is
  missing, the model is directed to look at the **real current state** (exact error, logs,
  `--version`, config, *how a service is actually running before touching it*) → the **project's
  own docs/code** → the **web** (`web_search`/`web_fetch`, or the `researcher` subagent) →
  **only then ask you**; and in `/brainstorm` to find prior art before proposing. The new
  **`/research` skill** carries the full playbook, including *how to search the web well* (verbatim
  error strings, official docs, version pins, source quality, bounded — no rabbit holes). A
  `skill-reminder` rule nudges it on stuck signals ("not working", "keeps failing", "не работает",
  "не могу починить", …) in both English and Russian.

### Changed
- **Honesty (`/reality`) is now ON by default in every project.** The integrity-over-agreement
  directive — be accurate not agreeable, separate fact/inference/opinion, surface failed
  tests/skipped steps/real risks without softening, disagree directly, never fabricate
  confidence — used to be an opt-*in* per-project toggle (off by default). It now lives in the
  global `~/.qwen/QWEN.md` guidance and applies everywhere.
- **New default-ON toggle model: per-project opt-OUT.** Both `/reality` and `/research` are on
  by default (their directives ship in the global guidance) and are disabled per project by
  pinning a small opt-out block in that project's `QWEN.md` — `/reality off` / `/research off`
  disable, `/reality on` / `/research on` restore. This inverts the previous default-off mode
  toggles; the opt-out survives compaction and re-installs (install never touches project
  `QWEN.md`). A legacy `realitymode` ON-block from before is swept when `/reality` is next used.
- **`/status` surfaces both** as `Honesty (reality)` and `Research-first`, each showing
  `ON (default)` or `OFF (opted out here)`.

### Notes
- Test suite grew to **285 checks** (from 272): rewritten `/reality` (inverse semantics),
  new `/research` toggle, the global-guidance directives, and the `skill-reminder` rule.

## [1.20.1] - 2026-07-30

### Added
- **`devmode-guard` — development mode's core rule is now enforced, not just requested.** The
  whole point of `/dev` is that the architect (main session) delegates every implementation to a
  fresh `implementer`/`debugger` subagent, keeping its own context small so big builds finish.
  Until now that rule lived only as prose in `QWEN.md` — and a model can rationalise past prose
  ("it's only 5 lines, delegating is overhead"), which is exactly what happened in practice. This
  release makes it deterministic with a new **`PreToolUse` hook**: while `/dev` is on for a
  project, the architect's `write_file`/`edit` on a source/test/config path is **blocked** with a
  message to delegate. **Subagents are exempt** — they are the sanctioned writers, detected via
  `QWEN_CODE_AGENT_ID`, which qwen-code populates with the subagent's id inside a subagent and
  leaves empty for the top-level architect (verified live against qwen-code 0.21.0). The
  architect's own `PROGRESS.md`/`QWEN.md`/`FACTS.md` writes still pass. Inert when `/dev` is off.
- **`/devedit <why>` — a deliberate, single-use escape hatch.** For the rare case where
  delegating one tiny edit is genuinely pointless, `/devedit <reason>` stages a one-shot token
  that lets the architect make **exactly one** direct edit even under `devmode-guard`. It requires
  a reason, **logs the exception to `.qwen/PROGRESS.md`**, is consumed by the next guarded write,
  and auto-expires after 15 min — turning a silent discipline break into a loud, auditable,
  one-off exception. High-friction by design, not a real barrier (the point is the record).
- **`/status` now surfaces dev-mode discipline**: when `/dev` is on it notes that `devmode-guard`
  is enforcing delegation, and flags when a one-shot `/devedit` authorisation is currently armed.

### Notes
- Feasibility was verified with a live probe: a diagnostic `PreToolUse` hook confirmed that
  qwen-code fires the hook in **both** the architect and subagent contexts (they share
  `CoreToolScheduler`), and that `QWEN_CODE_AGENT_ID` reliably distinguishes them (architect `""`
  vs subagent `"implementer-…"`) — which is what makes a hard block possible without breaking the
  implementer subagents themselves.
- Test suite grew to **272 checks** (from 258), including 12 new `devmode-guard`/`/devedit` cases.

## [1.20.0] - 2026-07-25

### Added
- **`/sudo-on` + `/sudo-off` — opt-in, confirm-gated full-root access for the local model
  (☢️ DANGEROUS).** For operators who explicitly want the model to run privileged commands on
  their own machines (firewall/sysadmin automation). Off by default and inert until used:
  `/sudo-on <password>` only *stages* the password and prints a **loud red danger banner**;
  `/sudo-on confirm` (typed by the user, after the warning) actually enables it by writing a
  root **askpass helper** (`~/.qwen/.sudo-askpass`, `chmod 700`) so the model runs
  `SUDO_ASKPASS=… sudo -A <cmd>` — the password is fed by the helper and **never appears in the
  command line or the transcript** — and pins a `sudomode` block into the global `QWEN.md`.
  `/sudo-off` wipes the password, helper, and block; `/sudo-on status` reports state. The
  command description, the README, and the runtime output all carry prominent **☢️** warnings
  that a mistaken/looping model with this on can irreversibly destroy the machine, and point to
  the safer scoped `NOPASSWD` sudoers alternative. `sudomode` is swept by `/toolkit-reset` and
  uninstall; the state files are removed on uninstall.

## [1.19.0] - 2026-07-24

Robustness release: make the durable-state workflow survive a saturated context window
even when qwen-code's built-in auto-compaction fails — which it does on a reasoning model,
where the summarization call comes back empty and hard-fails the turn.

### Changed
- **`compact-warn` now latches auto-compaction OFF when it proves ineffective.** It already
  warned after a compaction that freed <15%; now it also sets `context.autoCompactThreshold`
  to 1 (off) in `settings.json` — but only if auto-compaction was actually enabled, and it
  preserves every other key. Once compaction is shown to be useless for a session, qwen-code
  stops retrying it (and stops risking the empty-summary hard-fail); the durable-checkpoint +
  fresh-session path takes over. The injected message says it turned it off.
- **`checkpoint-nudge` gains a proactive context-fill guard.** qwen-code 0.20.x reports
  `context_usage` on the `Stop` event; when the window is ~88%+ full, the hook now holds the
  turn once to force `/checkpoint` + a fresh session **before** the window fills and an
  auto-compaction can fire-and-fail. Degrades to silent on older qwen-code that doesn't send
  the field. Loop-safe as before (`stop_hook_active`).

### Notes
- Together these close the "auto-compaction can still die" gap two ways: prevent reaching a
  full window (proactive fill guard), and stop retrying compaction once it's proven useless
  (auto-disable). The honest limit remains: a finite window is finite — the robust answer is
  durable state on disk (`PROGRESS.md`) + fresh sessions, which these hooks now enforce
  rather than merely suggest.

## [1.18.0] - 2026-07-24

Feature release from a fresh-eyes review of the toolkit after the 1.17.0 QA pass, taking
the new qwen-code 0.20.x hook events into account (`Stop`, `SessionEnd`, `SubagentStart/Stop`,
`TodoCreated/Completed`, `type: prompt` model-calling hooks).

### Added
- **`/doctor` — self-diagnostic.** One read-only command that checks the things that rot
  silently: every hook script + command backend actually present, every toolkit hook wired
  into `settings.json` (a wired-but-missing gap ships bugs), guards not accidentally
  disabled, stale approval tokens / a leaked subagent counter, and — if a provider is
  configured — a live `/health` ping per model server with latency. Prints OK/WARN/FAIL by
  section. This is the check that would have caught the version drift 1.17.0 had to fix.
- **`checkpoint-nudge` — a `Stop` hook that keeps `.qwen/PROGRESS.md` fresh.** The toolkit's
  whole compaction-survival story rests on PROGRESS.md staying current, but that depended on
  the model's discipline — the one thing a small local model is unreliable at. Now, when a
  turn is about to end and code was edited *after* the checkpoint was last written while it
  still has unchecked tasks, the hook holds the turn **once** (loop-safe via `stop_hook_active`)
  to make the model tick the finished boxes before stopping. No PROGRESS.md ⇒ silent. This
  closes the last non-deterministic hole in the durable-state design, using an event that
  did not exist when the toolkit was first built.
- **`/toolkit-reset undo`.** `/toolkit-reset` used to warn it was "not auto-reversible"; it
  now snapshots the pre-reset state (the edited `QWEN.md`, and for the global scope the
  `.hooks-disabled` file and `autoCompactThreshold`) before applying, so `/toolkit-reset undo`
  restores it one level back. Verified for both scopes.

### Changed
- **`/status` and `/applied` merged.** They were the one real duplicate — two introspection
  commands with overlapping output. `/status` is now the single "everything at a glance"
  view and, as before, shows the **active plan / development progress** from
  `.qwen/PROGRESS.md` (goal, done/remaining + percent, next task) alongside the modes,
  global guards, automation hooks, pinned facts, and version. Both commands now render from
  one shared module (`_stateview.js`) so they can never drift; `/applied` stays as a
  deprecated alias for one release (prints a note, same report). `/status global` shows the
  global scope.

### Notes
- Reviewed the new qwen-code native features for overlap: `TodoCreated/Completed` events and
  native session recovery partly overlap with PROGRESS.md and `restore-progress`, but the
  toolkit's durable-on-disk checkpoint survives `/clear` and cross-session in a way native
  todos do not, so both are kept. `SubagentStart/Stop` (agent-typed) could eventually
  replace the generic-`agent`-matched `agent-limit`; left as-is since it is well-tested.

## [1.17.0] - 2026-07-15

Full-toolkit review & refactor release, driven by an end-to-end QA pass (~130 integration
checks across install/uninstall, all 9 hooks, all command backends, and live inference).

### Changed
- **Command backends are Node-only now.** The nine parallel bash implementations (`_bro`,
  `_cover`, `_main-push`, `_maxagents`, `_mode-toggle`, `_pin`, `_reality`, `_status`,
  `_versioning`) were duplicated logic: qwen-code already requires Node on every OS, so the
  bash twins added maintenance and drift risk without adding portability. Every `_*.sh` is
  now a thin `exec node` wrapper over its `.js` twin (byte-identical behavior, verified);
  the installer ships all `_*.js` on every OS and the wrappers on POSIX only. Tests now
  assert the wrapper invariant instead of hand-maintained output parity.
- **`skill-reminder` understands Russian.** Previously 8 of 10 nudge rules matched English
  only, so a Russian prompt («напиши юнит тесты…», «запомни что…», «проверь безопасность…»)
  never triggered a hint. Every rule now has a Russian alternation (written without `\b`,
  which is ASCII-only in JS and never fires next to Cyrillic), plus a new `/review` rule
  that was missing in both languages. Bilingual tests lock this in.

### Fixed
- **`/gitflow` no longer mis-describes `/main-push` as a multi-use window.** The skill still
  said "15-minute window, not consumed per command" — stale text from before 1.16.0's
  single-use change, contradicting the actual guard behavior. It now teaches the real
  semantics: one push per authorization; the merge before it doesn't consume the token.
- **`qwen-extension.json` version un-stuck.** It sat at 1.9.0 (7 minors behind); it now
  tracks `VERSION`, and a test fails the suite if they ever drift again.
- **Uninstall clears every toolkit toggle block from the global `~/.qwen/QWEN.md`.** It only
  stripped the guidance block and `bromode` (and looked for `bromode` in the wrong file —
  `/bro` pins per-project); it now sweeps the same six-marker set `/toolkit-reset` owns, so
  a stale `devmode`/`realitymode`/… block can't survive an uninstall. Foreign blocks and
  user prose are untouched (tested), and the uninstall output now explains that per-project
  blocks are cleared with `/toolkit-reset project` instead.

### Added
- **`secret-guard` catches connection-string passwords** (`postgres://user:S3cret99@host`),
  with the usual placeholder/env-indirection escape hatches, and never flags digits-only
  userinfo like `host:8080`.

## [1.16.3] - 2026-07-13

### Changed
- **The toolkit signature is now the text `[toolkit]` instead of the 🧰 emoji.** The briefcase emoji rendered poorly, so every command and skill description, and every message a hook surfaces (guard deny reasons, injected notices), now uses a plain `[toolkit]` label. Command names and invocation are unchanged, as before.

### Added
- **Managed-file banner on command backends too.** The `_*.js` / `_*.sh` backend scripts in `~/.qwen/commands/` now carry the same "qwen-dev-toolkit — MANAGED FILE, do not hand-edit" banner as the hook scripts, so anyone opening a command backend to edit it sees where it came from. A test asserts every command backend carries the banner.

## [1.16.2] - 2026-07-12

### Added
- **"Managed file" banner on hook scripts.** Every file in `~/.qwen/hooks/` (all nine hooks plus the shared `_hookutil.js` helper) now opens with a banner noting it's a **qwen-dev-toolkit managed file** — do not hand-edit (`/toolkit-update` overwrites it), turn a hook off with `/hooks off <name>` instead — with a link to the repo. So anyone who opens a hook to edit it manually immediately sees where it came from. `settings.json` can't carry a comment (it's JSON) and adding an unknown marker key risks qwen-code's strict hook schema, so the banner lives in the `.js` files a person actually opens; the `settings.json` hook entries point their `command` at exactly those files. A test asserts every hook file carries the banner.

## [1.16.1] - 2026-07-12

### Added
- **Toolkit signature (🧰) on commands, skills, and hooks.** Everything the toolkit ships is now marked with a 🧰 so you can tell it apart from your own or built-in items:
  - **Commands** and **skills**: their description starts with 🧰, so in the `/` palette a toolkit command/skill is visibly distinct. The **names are unchanged** — invocation stays exactly the same (no `toolkit-` prefix to type).
  - **Hooks**: they have no palette entry, so the 🧰 goes on the text they surface — the guards' deny reasons and the automation hooks' injected messages now carry it, so whenever a hook speaks (e.g. blocks an action) it's clearly the toolkit.
  - Tests assert every `commands/*.md` and `skills/*/SKILL.md` description, and every hook script, carries the signature — so nothing can silently ship unsigned.

## [1.16.0] - 2026-07-12

### Changed
- **`/toolkit-reset` now resets the toolkit to the current version's defaults, scoped.** It was a global-only sweep of stale marker blocks; now it takes a scope — `/toolkit-reset` (or `/toolkit-reset project`) resets **this project**, `/toolkit-reset global` resets **`~/.qwen`**:
  - **Both scopes:** remove the toolkit's toggle blocks (`/dev`, `/cover`, `/bro`, `/maxagents`, `/versioning`, `/reality`) from that scope's `QWEN.md`, turning those modes back to default (also cleans stale drift an older version left in the wrong place).
  - **Global scope additionally:** reset the toolkit-managed global settings to defaults — re-enable all hooks (clear `.hooks-disabled`) and set `context.autoCompactThreshold` back to the default (auto-compaction OFF).
  - **Confirmation is mandatory in both scopes** and unchanged in spirit: a plain run **previews** with an explicit destructive-action warning and opens a 15-minute window (mutating nothing); `/toolkit-reset confirm` applies it. The approval **token now records the previewed scope**, so confirm always applies exactly the scope you previewed. The `toolkit-reset-guard` hook still backstops the confirm step at the engine level (no change needed — it's scope-agnostic).
  - Project-scope and global-scope resets are isolated from each other (a global reset never touches a project's `./QWEN.md`; a project reset never touches global settings) — asserted by tests. 169 tests passing (the reset suite rewritten for the two scopes + settings resets).

## [1.15.0] - 2026-07-12

### Changed
- **`/main-push` is now single-use instead of a time window.** It previously opened a 15-minute window in which *any number* of pushes/merges to `main`/`master` were allowed. Now it authorizes **exactly one push to main**: the `git-branch-guard` hook **consumes** the token when it authorizes a push, so a second push needs a fresh `/main-push`. A bare `merge`/`rebase` onto main does **not** consume the token, so one authorization still covers the normal "merge dev → push" release (the push is the one-time, outward act). The 15-minute TTL is kept only as a staleness guard for an *unused* token, not as a multi-push window. Updated `/main-push` messages + `status`, the guard's deny message, and the README. Note: because the guard consumes at authorization time (PreToolUse), if a push fails (e.g. network), retrying needs another `/main-push` — the deliberate trade-off of single-use. 6 new guard tests (push consumes; merge doesn't; second push blocked).

## [1.14.0] - 2026-07-12

### Added
- **`/hooks` command** — turn the toolkit's hooks off or on when a guard is too strict and gets in the way, without uninstalling anything. `/hooks` / `status` shows every hook ON/OFF; `/hooks off <name>` disables one; `/hooks on <name>` re-enables; `/hooks off guards` disables all five guards at once; `/hooks off all` / `/hooks on` toggle everything. Mechanism: the hooks stay wired in `settings.json` but each one self-disables by checking `~/.qwen/.hooks-disabled` (a plain name-per-line file that `/hooks` edits) via a new `hooks/_hookutil.js` helper — so re-enabling never has to reconstruct a hook spec, and a disabled guard simply no-ops (exit 0 = allow). The helper is fail-safe: any read error means "not disabled", so a guard stays active by default. **Disabling is sticky** (until you turn it back on) and **loud**: disabled guards are flagged in `/hooks status` and in `/applied` (`⚠ DISABLED`), so you never silently lose protection — turning off `secret-guard` and forgetting is the exact foot-gun this surfaces. A bare `/hooks off` is refused (no accidental blanket disable), and unknown names are rejected. Shared hook catalog (`commands/_hookcat.js`) is the single source of truth for `/hooks` and `/applied`. Global scope (hooks apply to every project); takes effect immediately, no restart.

### Fixed
- **`uninstall.js` now also removes the `.hooks-disabled` state file** and the new helper/catalog files.

## [1.13.0] - 2026-07-12

### Added
- **`/applied` command** — a read-only snapshot of everything the toolkit currently applies. `/applied` (default) shows **this project's** state; `/applied global` shows the `~/.qwen` state. It surfaces three things: (1) **modes** — the per-scope marker blocks from the relevant `QWEN.md` (`/dev`, `/cover` + target, `/bro` + persona, `/maxagents` + N, `/versioning` scheme, `/reality`); (2) **guards / prohibitions** — the global hooks that can *block* a tool call (`secret-guard`, `git-branch-guard`, `release-guard`, `toolkit-reset-guard`, the `/maxagents` subagent cap), each with a one-line description of what it forbids; (3) **automation hooks** — the non-blocking ones (`restore-progress`, `compact-warn`, `steer-compaction`, `skill-reminder`, agent-limit housekeeping). Hooks and guards are read from the global `~/.qwen/settings.json` and labelled as global, because they apply to every project including the current one — so they show in both scopes; only the marker-block modes are per-scope. Reads real installed state (parses `settings.json`), mutates nothing. Backend follows the `/autocompact` pattern (`_applied.js` does the work, `_applied.sh` is a thin wrapper) since it parses JSON. Distinct from `/status`, which stays a focused per-project build snapshot (goal / tasks / next).
- **`install.js` records the installed version** to `~/.qwen/.toolkit-version`, so `/applied` (and future tooling) can report it without depending on a `/toolkit-update` source cache.

### Fixed
- **`uninstall.js` orphaned hook script files** — `compact-warn.js` and `toolkit-reset-guard.js` had their `settings.json` entries stripped but the `.js` files themselves were never in the hook-file removal list, so uninstall left them in `~/.qwen/hooks`. Both added. A new cross-check test asserts every `hooks/*.js` file is in that list (same class as the command-file cross-check added in 1.12.1). Test count: 138 passing.

## [1.12.1] - 2026-07-12

### Changed
- **Versioning guidance: added the "prefer the smaller bump when borderline" rule.** The PATCH/MINOR/MAJOR wording was standard-correct but incomplete — it didn't say what to do in a borderline case, so a same-cycle correction could get over-bumped. Now the semantic-versioning guidance (global `QWEN.md`, `/versioning` command + its pinned block) adds: when the bump is borderline, prefer the smaller one, and a same-cycle rework or correction of a just-released change is a **PATCH**, not a new MINOR. This release itself follows that rule: it corrects 1.12.0's just-shipped integrity feature, so it's `1.12.1`, not `1.13.0`.
- **"Integrity over agreement" is now a toggle (`/reality`), OFF by default** — not the always-on `QWEN.md` clause that 1.12.0 shipped. It moved out of the always-loaded guidance block into a per-project `realitymode` marker block that `/reality` (or `/reality on`) pins into the project's `QWEN.md`, `/reality off` removes, and `/reality status` reports — same deterministic, compaction-proof pattern as `/cover` and `/bro`. When ON, the assistant is held to the honesty directive: be accurate rather than agreeable, separate fact/inference/opinion, surface inconvenient truths (failed tests, skipped steps, real risks) without softening, disagree directly when the user or a plan is wrong, never fabricate agreement or confidence. Rationale: it costs nothing on the small context window when you don't want it, and you opt in per project. `realitymode` is now one of the blocks `/toolkit-reset` sweeps from a global `QWEN.md`. Parallel `_reality.sh` / `_reality.js` backends (byte-identical output, verified).

### Fixed
- **`uninstall.js` orphaned `/autocompact` and `/toolkit-reset` command files** — they were never added to its `CMD_MD` / `CMD_BACKENDS` removal lists (a gap from 1.10.0/1.11.0), so uninstalling left their `.md` and backend files behind in `~/.qwen/commands`. Both are now listed. A new manifest cross-check test asserts every command `.md` and every `_*.{sh,js}` backend in `commands/` is present in `uninstall.js`'s removal lists, so this can't silently regress (mirrors the existing hook/agent/skill cross-checks). Test count: 122 passing.

## [1.12.0] - 2026-07-11

### Added
- **Always-on "Integrity over agreement" principle** in the global `QWEN.md` block. Since skills are invoked on demand and hooks are deterministic code, the only primitive that is genuinely *always on* (loaded every session, survives compaction) is the `QWEN.md` guidance block — so the honesty directive lives there, not in a skill. It tells the model to be accurate rather than agreeable: separate fact / inference / opinion, state uncertainty plainly, surface inconvenient truths (failed tests, skipped steps, real risks) without softening or reframing them, disagree directly when the user or a plan is wrong, and never fabricate agreement or confidence — sycophancy is treated as a failure mode, not politeness. Kept to ~7 lines to stay cheap on a small context window. No new command, hook, or install/uninstall wiring: it ships inside the existing merged `QWEN.md` block, so a `/toolkit-update` applies it. One new test asserts the principle is present in the installed block.

## [1.11.0] - 2026-07-11

### Added
- **`/toolkit-reset` · `confirm`** — a standalone command (deliberately *not* a mode of `/toolkit-update` — that fetches a new release over the network; this is pure local cleanup with none) that sweeps this toolkit's known marker blocks (`bromode`, `covermode`, `devmode`, `maxagents`, `versioning`) out of the **global** `~/.qwen/QWEN.md` if found there. Fixes the case where an older version pinned a toggle globally (e.g. `/bro` before v1.8.0) and the block never got cleaned up when that toggle became per-project, so it kept silently applying to every project. Requires a real, un-skippable confirmation: plain `/toolkit-reset` only *previews* what would be removed and opens a 15-minute approval window (no mutation); `/toolkit-reset confirm`, typed by the user within that window, performs the removal. A new `toolkit-reset-guard` `PreToolUse` hook enforces the window at the engine level — mirroring how `git-branch-guard` backstops `/main-push` — so a model cannot bypass the confirmation by calling the backend script directly via a shell command. 21 new tests cover the preview/confirm/expiry/token-consumption state machine, project-file isolation, and the guard hook's allow/deny decisions; a new manifest cross-check catches any future hook wired in `install.js` but not stripped by `uninstall.js` (this also caught and fixed a pre-existing gap: `compact-warn` was never added to `uninstall.js`'s strip list).

### Changed
- README (RU): removed an informal word ("халява"), and later a vague one ("бесплатный выигрыш" → "размен стабильности на ёмкость"), from the auto-compaction explanation. Mirrored the wording tweak into the EN README.

## [1.10.0] - 2026-07-11

### Added
- **`/autocompact` command** — control (or disable) qwen-code's auto-compaction deterministically: `off` = never auto-compact (threshold `1.0`, fires only at a completely full window), `on` = stock behavior (`0.7` of the input budget), `<0.3–0.99>` = custom trigger share, `status` = report. Edits `context.autoCompactThreshold` in `~/.qwen/settings.json`; applies after a qwen-code restart. Backends: `_autocompact.js` (single Node logic) + `_autocompact.sh` (thin wrapper — JSON editing needs a real parser and Node is already a toolkit prerequisite).
- **`compact-warn` hook** (`SessionStart`, matcher `compact`) — compaction-saturation warning: after a compaction it reads the real before/after token counts from the session transcript (`chat_compression` record); if history shrank by **less than 15%**, it tells the model to warn the user that compacting this session further is no longer effective and to suggest `/checkpoint` + a fresh session. Silent on healthy compressions.
- **README (EN+RU): reliability section** now explains *why* the compaction trigger sits well below the window (reply reserve + 20k summary reserve + 13k per-turn buffer — compacting "at 100%" is impossible by construction) and documents the third knob, `generationConfig.samplingParams.max_tokens`, against the GGUF-id early-compaction trap.

### Changed
- **Auto-compaction is now OFF by default**: the installer sets `context.autoCompactThreshold: 1` when the user has no explicit value (an existing choice is never overridden). Rationale: compaction is lossy; durable state lives in `.qwen/PROGRESS.md` and `/checkpoint` compacts deliberately. Re-enable stock behavior with `/autocompact on`.

## [1.9.0] - 2026-07-03

### Added
- **`/release` skill** — cuts a version release so the published git tag / GitHub Release never lags the code. It detects drift between the latest tag, the `VERSION` file, and the commits on `main`; refuses to release stale code (commits after the tagged version) or from `dev`; and, when a bump is ready, creates the annotated tag plus a GitHub Release with notes extracted from the matching `CHANGELOG.md` section. `/release check` reports the sync state without changing anything.
- **`release-guard` hook** — a deterministic PreToolUse backstop so the release check doesn't depend on the model remembering: when a push advances `main`/`master` with the release out of step (a bumped `VERSION` with no matching tag, or commits past the released tag with no bump), it injects a non-blocking reminder to run `/release` (or `/changelog` then `/release`). Silent when the release is in sync.

### Changed
- `/gitflow`'s main-release sequence and `/changelog` now hand off to `/release` as the final step, and the `skill-reminder` hook nudges `/release` on release-y prompts — closing the loop that previously left a bumped `VERSION` untagged.

## [1.8.0] - 2026-07-03

### Changed
- **Semantic versioning is now on by default** in every project — the rule lives in the global `QWEN.md` working agreement, next to the existing git branch-flow rule (`dev`-default, `main` only via `/main-push`). `/versioning` becomes a *per-project override* of that default: `off` now pins an explicit opt-out block (previously a no-op once the default is global), while a custom scheme and `on` are unchanged; `status` reports the global-default vs project-override state.
- **`/bro` is now pinned per-project** in the project's `QWEN.md` (matching `/dev`) instead of the global `~/.qwen/QWEN.md`, so a persona no longer follows you across every project. Both backends (`_bro.sh` / `_bro.js`), `bro.md`, and the scope table were updated.

### Documentation
- Reworked the end-to-end walkthrough (EN + RU) into an annotated development lifecycle that covers most commands and *when* to reach for each.
- Added the reasoning-model gotcha to the auto-mode section: a thinking model spends the classifier's tiny token budget on its `<think>` phase and returns empty content, so raising timeouts can't fix it — the robust path is `yolo` + a hardened `permissions.deny` backed by the guard hooks.
- Renamed the "Development" section to "Contributing to the toolkit itself" to disambiguate it from `/dev` mode; annotated the `/brainstorm` example as a placeholder.

## [1.7.0] - 2026-07-01

### Added
- Three new subagents: **`tester`** (independent black-box verification of acceptance criteria — wired into `/implement`'s final gate, `/dev`, and `/cover`), **`researcher`** (version-pinned library/API digests for `/plan` and implementer delegations), **`verifier`** (adversarial CONFIRMED/REFUTED/PLAUSIBLE check of one candidate finding — wired into `/review` and `/audit`).
- Test harness: `node test/run.js` — dependency-free checks of hook allow/deny behavior, `/pin` backend parity (bash + Node), manifest consistency, and a full installer round-trip in temp dirs.
- `/brainstorm` now records the agreed spec durably into `.qwen/PROGRESS.md` (Goal/Decisions/Gotchas), so it survives compaction before `/plan` runs; it also inspects the repo before asking and caps the interview at two rounds.
- `/audit`: severity definitions pinned to exploitability, evidence rules (file:line + entry point + sink path per finding), high-signal runnable secret-scan commands, rotate-first remediation order, XSS and mass-assignment coverage.
- `/implement`: Step 0 resume routing (an existing task plan skips re-planning), escalation of repeated task failures to the `debugger` subagent, deterministic devmode pinning via the mode-toggle backend.
- `/gitflow`: exact 4-step main-release sequence for the `/main-push` window, feature-branch handling, rejected-push recovery.
- Global `QWEN.md` agreement now states the git discipline (dev by default, main only via `/main-push`).

### Changed
- One canonical `.qwen/PROGRESS.md` template across `/plan`, `/implement`, and `/checkpoint` (checkboxed task plan + log; mid-task state on a `↳ state:` sub-line) — the "first unchecked task" recovery contract now always holds.
- `/checkpoint restore` sanity-checks the checkpoint against the working tree before trusting it.
- `/review` delegates large reviews to read-only `scout` candidates (never code-writing agents) and requires a concrete failing input per finding.
- `/commit`: repo style check before the Conventional-Commits default, robust dev-switch handling, pre-commit-hook retry flow.
- `/docs` hunts both drift directions (stale sections for removed features, not just new ones) with a concrete diff range.
- Agents: scout constrained to read-only shell use with a candidate-findings mode; implementer barred from git/secrets with an ambiguity rule; debugger reports `blocked` on unreproducible bugs instead of fixing blind.
- Command prompts tightened against their backends (`/main-push` executes the gitflow sequence, `/dev` resumes an existing plan, `/bro` changes voice only, etc.).

### Fixed
- Tooling gaps that broke skills as written: `/changelog` had no write tools, `/review` had no `agent` tool, `/plan` had no shell for its own `mkdir`.
- `secret-guard` blocked writing secrets into the gitignored `.env` — the exact fix its own message recommends; `.env.example`-style files stay guarded. Also now recognizes `ENCRYPTED PRIVATE KEY` blocks.
- `agent-limit` could livelock on a stale lock left by a crashed hook process; locks older than 10 s are stolen.
- `skill-reminder` claimed a 90% coverage default (it's 80%), nagged `/brainstorm` on `requirements.txt` prompts, and pointed builds at `/dev` instead of the model-invokable `/implement`.
- `/pin remove` could delete the FACTS.md header when the pattern matched it; bare `/pin remove` silently pinned the word "remove".
- Installer: backend invocations inside skill bodies are now rewritten for Windows (bash/`$HOME` → Node/absolute path); the bootstrap no longer masks a spawn failure as success.
