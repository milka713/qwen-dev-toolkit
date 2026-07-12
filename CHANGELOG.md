# Changelog

All notable changes to qwen-dev-toolkit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com); versions follow semver.
(Releases before 1.7.0 predate this file and are not backfilled — see the git history.)

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
