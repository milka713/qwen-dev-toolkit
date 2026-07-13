---
name: docs
description: [toolkit] Keep the project's documentation in sync with the code — README (and translated READMEs like README.ru.md if present), usage examples, and any docs/ pages — after a feature is added or an interface changes. Use PROACTIVELY when the user says "update docs", "обнови доки/readme", or after a build that changed commands/APIs/setup. Invoke with /docs or /docs <what changed>.
argument-hint: '[what changed]'
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

1. **Find what changed.** Use the user's note if given. Otherwise diff since the docs were last touched: `git log -1 --format=%H -- README.md` (or the main doc), then `git diff <that>..HEAD --stat` plus the current uncommitted diff. Identify **both directions of drift**:
   - new or changed: commands, CLI flags, API signatures, env vars/config, install/run steps, dependencies;
   - **removed or renamed**: doc sections that describe behavior which no longer exists — the worst kind of drift; delete or fix them.
2. **Locate the docs.** `README.md`; translated mirrors if the project keeps them (`README.ru.md`, `README.*.md` — they must stay in sync); any `docs/`, `USAGE`, `CONTRIBUTING`; and the help/usage text embedded in the code (`--help` strings, command tables).
3. **Update accurately:**
   - Reflect the real current names, flags, signatures, and default values — verify against the code, don't paraphrase from memory.
   - Update examples so they run as written; where practical, execute a documented command to confirm — but only safe, read-only ones (never a documented deploy/delete/migrate).
   - Keep the existing structure and tone; edit in place, don't rewrite wholesale.
   - Add a short entry for a genuinely new feature (what it does + a one-line example); don't pad.
   - If you edit help text inside source files, re-run the tests — they often assert on usage strings.
4. **Translation parity.** If you changed `README.md` and a translated mirror exists, make the same change there (and vice-versa). Translate naturally — English technical terms are fine where idiomatic.
5. **Stale version references only.** Fix doc text that pins an outdated version (e.g. an install command referencing an old release). Do **not** write `CHANGELOG.md` entries or bump `VERSION` — that's `/changelog`'s job.
6. **Verify.** Re-read the changed sections; check code fences are balanced, tables aren't half-updated, and links/anchors still resolve (for local links, check the target file/heading exists).

## Guardrails

- Never document a feature that doesn't exist or a flag you didn't verify.
- Don't invent badges, screenshots, or sections the user didn't ask for.
- Don't leak secrets/hosts/paths into examples — use placeholders.

## Report

Say which files you updated, which sections changed, what stale content you removed, and confirm translations are in sync. If nothing needed updating, say so.

The user's optional note (what changed) follows.
