---
description: Toggle version-naming mode. When ON, name versions with semantic versioning by significance — PATCH for small fixes (1.4.7), MINOR for notable features (1.5.0), MAJOR for breaking changes (2.0.0) — and say which part you bumped. Off by default. /versioning or /versioning on = enable (semantic); /versioning <how to name versions instead> = enable with a custom scheme; /versioning off = disable; /versioning status = check. Pinned **per-project** in the project's QWEN.md, so different projects can use different schemes in parallel.
argument-hint: '[on | off | status | <custom scheme text>]'
---

The version-naming switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it:

!{bash "$HOME/.qwen/commands/_versioning.sh" {{args}}}

Based on `VERSIONING_RESULT`:
- **ON (semantic)**: from now on, whenever you announce, bump, tag or report a version, use semantic versioning and pick the bump by significance — **PATCH** for small fixes/tweaks/docs (e.g. 1.4.7), **MINOR** for a notable new feature (e.g. 1.5.0), **MAJOR** for a breaking change (e.g. 2.0.0). Always name the concrete version (e.g. "v1.4.7") and state which part you bumped and why. `/changelog` proposes versions under this scheme too. Confirm briefly in that spirit.
- **ON (custom)**: apply the user's custom versioning scheme (now pinned in `QWEN.md`) from now on. Confirm briefly.
- **OFF**: confirm you'll go back to normal (no special version-naming policy).
- **status**: report ON (semantic or custom) / OFF.

User argument: {{args}}
