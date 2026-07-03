---
description: Version-naming policy. Semantic versioning is ON by default (stated in the global QWEN.md) — name versions by significance, PATCH for small fixes (1.4.7), MINOR for notable features (1.5.0), MAJOR for breaking changes (2.0.0), and say which part you bumped. This command sets a **per-project** override, pinned in the project's QWEN.md: /versioning <how to name versions instead> = use a custom scheme here; /versioning off = opt this project out of the default; /versioning on = re-pin semantic; /versioning status = check.
argument-hint: '[on | off | status | <custom scheme text>]'
---

The version-naming switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it:

!{bash "$HOME/.qwen/commands/_versioning.sh" {{args}}}

Based on `VERSIONING_RESULT`:
- **ON (semantic)**: from now on, whenever you announce, bump, tag or report a version, use semantic versioning and pick the bump by significance — **PATCH** for small fixes/tweaks/docs (e.g. 1.4.7), **MINOR** for a notable new feature (e.g. 1.5.0), **MAJOR** for a breaking change (e.g. 2.0.0). Always name the concrete version (e.g. "v1.4.7") and state which part you bumped and why. `/changelog` proposes versions under this scheme too. Confirm briefly in that spirit.
- **ON (custom)**: apply the user's custom versioning scheme (now pinned in `QWEN.md`) from now on. Confirm briefly.
- **OFF**: this project opts out of the default semantic versioning; confirm no special version-naming policy applies here.
- **status**: report ON (semantic or custom) / OFF.

User argument: {{args}}
