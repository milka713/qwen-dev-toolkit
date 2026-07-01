---
name: docs
description: Keep the project's documentation in sync with the code — README (and README.ru.md if present), usage examples, and any docs/ pages — after a feature is added or an interface changes. Use PROACTIVELY when the user says "update docs", "обнови доки/readme", or after a build that changed commands/APIs/setup. Invoke with /docs or /docs <what changed>.
priority: 15
allowedTools:
  - run_shell_command
  - read_file
  - read_many_files
  - grep_search
  - glob
  - edit
  - write_file
---

# /docs — documentation that matches the code

Docs drift the moment code changes. This skill updates them from what the code actually does now — accurate over comprehensive.

## Steps

1. **Find what changed.** From `git diff`/`git log` (or the user's note), identify what's new or different that a reader would need: new/renamed commands, changed CLI flags or API signatures, new env vars/config, changed install/run steps, new dependencies.
2. **Locate the docs.** `README.md` and, if it exists, **`README.ru.md`** (keep both in sync — the repo requires the RU translation to mirror the EN one). Also any `docs/`, `USAGE`, `CONTRIBUTING`, and the help/usage text embedded in the code (`--help`, command tables).
3. **Update accurately:**
   - Reflect the real current names, flags, signatures, and default values — verify against the code, don't paraphrase from memory.
   - Update examples so they actually run as written; where practical, execute a documented command to confirm it works before committing it to the docs.
   - Keep the existing structure and tone; edit in place, don't rewrite wholesale.
   - Add a short entry for a genuinely new feature (what it does + a one-line example); don't pad.
4. **Bilingual parity.** If you changed `README.md`, make the mirrored change in `README.ru.md` (and vice-versa) so they don't diverge. Translate naturally — English technical terms are fine where idiomatic.
5. **Version/changelog touch-ups** if the repo tracks them (`VERSION`, `CHANGELOG.md`) — but leave a full changelog entry to the [[changelog]] skill.
6. **Verify.** Re-read the changed sections for accuracy; check that any code fences are balanced and links/anchors still resolve. Don't leave a half-updated table.

## Guardrails

- Never document a feature that doesn't exist or a flag you didn't verify.
- Don't invent badges, screenshots, or sections the user didn't ask for.
- Don't leak secrets/hosts/paths into examples — use placeholders.

## Report

Say which files you updated, which sections changed, and confirm EN/RU are in sync. If nothing needed updating, say so.

The user's optional note (what changed) follows.
