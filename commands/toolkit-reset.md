---
description: [toolkit] Bring the toolkit back to the shape the current version implies by default, for a chosen scope. /toolkit-reset (or /toolkit-reset project) resets THIS project; /toolkit-reset global resets the global ~/.qwen. It removes the toolkit's toggle blocks (/dev, /cover, /bro, /maxagents, /versioning, /reality) from that scope's QWEN.md, and — for the global scope — also resets the toolkit's global settings to defaults (re-enable all hooks, auto-compaction back to its default). Also cleans stale blocks an older version left in the wrong place. Unrelated to /toolkit-update (that fetches a release; this is local cleanup, no network). Requires confirmation: a plain run previews and opens a 15-minute window; /toolkit-reset confirm applies it.
argument-hint: '[project | global | confirm]'
---

The result below was produced deterministically by the shell backend — act on it, do not re-derive it, and never try to reproduce its effect yourself another way:

!{bash "$HOME/.qwen/commands/_toolkit-reset.sh" {{args}}}

Based on `TOOLKIT_RESET_RESULT`:
- **PREVIEW** (lists what would change, and names the scope — project or global): show the user exactly what would change, in plain language (e.g. "turn off this project's `/reality` and `/cover` toggles", or "re-enable 2 disabled hooks globally"). This is **mandatory for BOTH the project and the global scope**: always give a clear **warning that this is destructive** (current toggles/settings in that scope will be lost, not auto-reversible), and **explicitly ask them to confirm** — something like "Точно сбросить это до значений по умолчанию?". Only if they say yes, tell them they run `/toolkit-reset confirm` themselves within 15 minutes (the scope they previewed is remembered; confirm applies that same scope). Do **not** run `_toolkit-reset.sh confirm` (or the `.js` backend, or anything else that mutates `QWEN.md`/settings) yourself in this turn or any later one on the user's behalf — even if they reply "yes" in chat, the confirm only happens when *they* type the command; a `toolkit-reset-guard` hook will block you if you try. Just tell them how.
- **"reset done"**: confirm exactly what was reset and in which scope. If settings changed (global scope), remind them to restart qwen-code / start a new session for those to take effect. Mention they can re-apply any toggle per-project again with `/dev`, `/cover`, `/bro`, `/maxagents`, `/versioning`, `/reality` if they still want it.
- **"nothing to reset"**: tell them that scope already matches the current version's defaults — nothing to clean up.
- **"no pending approval"**: explain that `/toolkit-reset confirm` only works within 15 minutes of running plain `/toolkit-reset [project|global]` first — ask them to run it again to start a fresh window.

User argument: {{args}}
