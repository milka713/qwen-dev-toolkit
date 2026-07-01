# Install / update qwen-dev-toolkit — instructions for an AI agent

**You are an AI coding agent (qwen-code, Claude Code, or similar) and the user pointed you
at this repository and asked you to install or update its skills. Follow these steps
yourself, then verify.** These same steps cover **both installing (first time) and updating
(refreshing to the latest)** — the installer is idempotent and updates in place.

> Human reader? You can just run `./install.sh` (macOS/Linux) or `install.cmd` (Windows),
> or `node install.js` anywhere. The rest of this file is written for an autonomous agent.

## What this does

Copies this toolkit's skills, subagents, commands and hooks into the qwen-code config dir
(`~/.qwen`), and merges its hook + memory settings and its `QWEN.md` guidance block. It
copies **only its own files** and **does not delete or overwrite any other skills, commands,
agents, settings, API keys, memories, or `.qwen/PROGRESS.md` files** you already have.

## Prerequisites (check first)

Run these and confirm each works; if one is missing, tell the user how to install it.

- **node** — `node --version` (required; the installer is a Node script).
- **qwen-code** — `qwen --version` (this toolkit extends it; install: `npm install -g @qwen-code/qwen-code`).
- **git** — `git --version` (needed to fetch this repo, and for the `/gitflow`, `/commit`, `/toolkit-update` features).

## Steps

1. **Make sure you have the repo locally.** If you are already inside a checkout of this
   repo (an `install.js` file is present in the current directory), use it. Otherwise clone it:
   ```
   git clone --depth 1 https://github.com/milka713/qwen-dev-toolkit
   cd qwen-dev-toolkit
   ```
   To **update** an existing checkout instead: `git pull --ff-only` inside it.

2. **Run the installer** (same command for install and update; pick what your OS has):
   ```
   node install.js
   ```
   (Equivalent: `./install.sh` on macOS/Linux, `install.cmd` on Windows.)

3. **Read the installer output.** A successful run prints, in order:
   - a dependency check (`✓ node …`, `✓ git …`, `✓ qwen-code …`),
   - `Installed:` with the skills, agents, commands and hooks,
   - `✓ settings.json merged …`,
   - `✓ QWEN.md guidance added` (or `updated`),
   - `Done. Restart qwen-code …`.
   If it printed a missing-dependency line (`✗ …`), install that dependency and re-run.

## Verify it actually worked (do this, don't assume)

1. **Files on disk** — confirm these exist (use the user's home dir; `~` = `$HOME` on
   macOS/Linux, `%USERPROFILE%` on Windows):
   - `~/.qwen/skills/gitflow/SKILL.md`, `~/.qwen/skills/commit/SKILL.md`,
     `~/.qwen/skills/toolkit-update/SKILL.md` (spot-check a few).
   - `~/.qwen/agents/debugger.md`, `~/.qwen/hooks/git-branch-guard.js`.
   - `~/.qwen/commands/main-push.md` and its backend (`_main-push.sh` on macOS/Linux,
     `_main-push.js` on Windows).
2. **Settings merged** — `~/.qwen/settings.json` contains hook entries named
   `git-branch-guard`, `secret-guard`, `restore-progress` (grep the file).
3. **Version** — read `VERSION` in the repo and report it as the installed version.
4. **Live check (after a restart)** — tell the user to restart qwen-code / start a new
   session, then `/skills` should list `implement, plan, checkpoint, audit, brainstorm,
   gitflow, commit, review, docs, changelog, toolkit-update` and `/agents manage` should
   list `implementer, scout, debugger, tester, researcher, verifier`. (Skills load at startup, so the current session
   won't see them until it restarts.)

## Report to the user

State: install or update, the version, that verification passed (files + settings present),
and the reminder to restart qwen-code so the new skills load. If anything failed, say
exactly which step and the error — do not report success you did not verify.
