---
description: Sweep toolkit settings left behind in the wrong (global) place by an older toolkit version — e.g. a /bro persona or a /dev, /cover, /maxagents, /versioning toggle still applying to every project even though those are per-project now. Unrelated to /toolkit-update (that fetches a new release; this is pure local cleanup, no network). Requires confirmation: /toolkit-reset previews and opens a 15-minute approval window; /toolkit-reset confirm actually removes anything, and only works within that window.
argument-hint: '[confirm]'
---

The result below was produced deterministically by the shell backend — act on it, do not re-derive it, and never try to reproduce its effect yourself another way:

!{bash "$HOME/.qwen/commands/_toolkit-reset.sh" {{args}}}

Based on `TOOLKIT_RESET_RESULT`:
- **PREVIEW** (lists what would be removed): show the user exactly which blocks were found, in plain language (e.g. "a leftover global `/bro` persona"). Then **explicitly ask them to confirm** — something like "Точно хотите сбросить это до значений по умолчанию?" — and tell them that if yes, they need to run `/toolkit-reset confirm` themselves within the next 15 minutes. Do **not** run `_toolkit-reset.sh confirm` (or the `.js` backend, or anything else that mutates `QWEN.md`) yourself in this turn or any later one on the user's behalf — even if they reply "yes" in chat, the actual confirm step only happens when *they* type the command; a `toolkit-reset-guard` hook will block you if you try anyway. Just tell them how.
- **"removed stale global block(s)"**: confirm exactly what was removed and mention it's now safe to `/bro`, `/dev`, `/cover`, `/maxagents`, or `/versioning` again per-project if they still want that toggle somewhere.
- **"nothing to reset"**: tell them there was nothing stale to clean up.
- **"no pending approval"**: explain that `/toolkit-reset confirm` only works within 15 minutes of running plain `/toolkit-reset` first — ask them to run `/toolkit-reset` again to start a fresh window.

User argument: {{args}}
