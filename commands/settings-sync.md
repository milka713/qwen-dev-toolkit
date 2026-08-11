---
description: "[toolkit] Sync your qwen-code settings.json across machines through a private GitHub repo, over SSH only (no gh/HTTPS). Connect once with an explicit privacy confirmation (connect <url> private) since a repo public/private state cannot be checked over SSH; SSH access is verified with git ls-remote. Then move settings with an EXPLICIT direction — push (local to repo) or pull (repo to local, local backed up first). No bare \"sync\" that guesses. /settings-sync connect <url> private, push, pull, status, disconnect."
argument-hint: '[connect <github-url> private | push | pull | status | disconnect]'
disable-model-invocation: true
---

The settings-sync action has already run **deterministically** in the shell below — act on its result, do not re-run it or edit settings by hand:

!{bash "$HOME/.qwen/commands/_settings-sync.sh" {{args}}}

This syncs `~/.qwen/settings.json` (which contains provider API keys and MCP tokens) via a GitHub repo the user owns, **entirely over SSH** (`git@github.com:…`) — no `gh`, no HTTPS token, so it works on a machine that only has an SSH key. Based on `SETTINGS_SYNC_RESULT`:

- **CONNECTED** — SSH access was verified (`git ls-remote`) and the user explicitly confirmed the repo is private. Tell them they can now `push` or `pull`.
- **PUSHED** — local settings.json was uploaded (local → repo). Remind that the repo now holds their secrets (private per their confirmation); other machines get it with `pull`.
- **PULLED** — the repo's settings.json overwrote local (repo → local); the previous local file was backed up. Make clear qwen-code must be **restarted** to load it.
- **NOOP** — already in sync; nothing was written.
- **STATUS** — report the connected repo, whether privacy was confirmed, live SSH reachability, and whether local differs from the repo; offer the explicit `push`/`pull`.
- **DISCONNECTED** — the repo was forgotten; settings.json untouched.
- **ERROR** — relay the reason **verbatim** (privacy not confirmed → connect/push refused; no SSH access to the repo; not connected; invalid JSON; git/clone failure). Do **not** try to work around it or push secrets another way.

Only the **portable core** is synced (`modelProviders`/keys, `fastModel`, `model`, `security`, `mcpServers`, `env`, `memory`, `context`, `ui`). The **machine-specific** sections `hooks` (toolkit-managed, absolute paths) and `permissions` (absolute local paths) are deliberately **left per-machine** — push strips them from the repo, pull keeps this machine's own. This is what stops a foreign absolute path (e.g. a Mac's `/Users/…/hooks/checkpoint-nudge.js`) landing on another box and crashing its hooks. Each machine sets those up itself via `node install.js`.

Rules that must hold: privacy **cannot** be verified over SSH, so it is an **explicit one-time confirmation** (`connect <url> private`) and `push` refuses unless it's on record — secrets never upload without that. SSH **access** is verified (`git ls-remote`) on connect/push/pull. Direction is **always explicit** (`push` vs `pull`); pull backs up the local file before overwriting, and never overwrites this machine's `hooks`/`permissions`. Never infer a direction, never invent a privacy confirmation the user didn't give, and never sync machine-specific sections.

User argument: {{args}}
