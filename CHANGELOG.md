# Changelog

All notable changes to qwen-dev-toolkit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com); versions follow semver.
(Releases before 1.7.0 predate this file and are not backfilled — see the git history.)

## [1.7.0] - 2026-07-01

### Added
- Test harness: `node test/run.js` — dependency-free checks of hook allow/deny behavior, `/pin` backend parity (bash + Node), and a full installer round-trip in temp dirs.
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
