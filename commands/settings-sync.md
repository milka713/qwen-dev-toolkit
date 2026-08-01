---
description: [toolkit] Sync your qwen-code settings.json across machines through a PRIVATE GitHub repo. Connect a repo once (a mandatory privacy check refuses public repos, since settings hold API keys / MCP tokens), then move settings with an EXPLICIT direction — push (local → repo) or pull (repo → local, local backed up first). No bare "sync" that guesses a direction. /settings-sync connect <url> | push | pull | status | disconnect.
argument-hint: '[connect <github-url> | push | pull | status | disconnect]'
---

The settings-sync action has already run **deterministically** in the shell below — act on its result, do not re-run it or edit settings by hand:

!{bash "$HOME/.qwen/commands/_settings-sync.sh" {{args}}}

This syncs `~/.qwen/settings.json` (which contains provider API keys and MCP tokens) via a GitHub repo the user owns. Based on `SETTINGS_SYNC_RESULT`:

- **CONNECTED** — the repo was verified **private** and stored. Tell the user they can now `push` or `pull`.
- **PUSHED** — local settings.json was uploaded (local → repo). Remind that the repo now holds their secrets and is private by design; other machines get it with `pull`.
- **PULLED** — the repo's settings.json overwrote local (repo → local); the previous local file was backed up. Make clear qwen-code must be **restarted** to load it.
- **NOOP** — already in sync; nothing was written.
- **STATUS** — report the connected repo, its live privacy state, and whether local differs from the repo; offer the explicit `push`/`pull`.
- **DISCONNECTED** — the repo was forgotten; settings.json untouched.
- **ERROR** — relay the reason **verbatim** (repo not private → push refused; `gh` missing for the privacy check; not connected; invalid JSON; git/clone failure). Do **not** try to work around a failed privacy check or push secrets another way.

Rules that must hold: the **privacy check is mandatory** on connect and re-checked on every push — secrets never go to a repo that isn't confirmed private. Direction is **always explicit** (`push` vs `pull`); pull backs up the local file before overwriting. Never infer a direction.

User argument: {{args}}
