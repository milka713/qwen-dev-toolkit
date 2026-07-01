---
name: changelog
description: Generate or update CHANGELOG.md from the git history since the last release/tag, grouped by change type (Added/Changed/Fixed/…) in Keep-a-Changelog style. Use when the user says "changelog", "обнови changelog", or when cutting a release. Invoke with /changelog or /changelog <version>.
priority: 15
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
---

# /changelog — a human changelog from the git log

Turn commits into a changelog entry a person would actually want to read — grouped and de-noised, not a raw `git log` dump.

## Steps

1. **Find the range.** Get the last tag: `git describe --tags --abbrev=0` (if none, use the whole history). Collect commits since it: `git log <lasttag>..HEAD --no-merges --pretty=format:'%h %s'`.
2. **Pick the version.** Use the argument if given; else read `VERSION` (or the latest tag) and propose the next semver based on the changes (breaking → major, `feat` → minor, only `fix`/`chore` → patch). State which you chose and why.
3. **Group by type** in [Keep a Changelog](https://keepachangelog.com) sections, in this order, omitting empty ones:
   - **Added** (`feat`), **Changed** (`refactor`, behavior changes), **Fixed** (`fix`), **Removed**, **Security**, **Docs** (`docs`), **Internal** (`chore`/`ci`/`build` — keep terse or drop).
   - Rewrite each commit subject into a user-facing, past-tense line (drop the `type(scope):` prefix, merge duplicates, skip pure noise like "wip"/"fix typo"). Reference the short hash where useful.
4. **Write it.** Prepend a new section to `CHANGELOG.md` (create it with a standard header if missing):
   ```
   ## [<version>] - <YYYY-MM-DD>
   ### Added
   - ...
   ### Fixed
   - ...
   ```
   Keep the newest version on top; never rewrite past released sections.
5. **Report** the version chosen and a one-line summary. Do not tag or commit unless asked (that's the user's / [[gitflow]]'s call).

## Guardrails

- Ground every line in a real commit — don't invent entries.
- Don't expose secrets, internal hosts, or private paths from commit messages.
- Keep it concise: a reader wants the shape of the release, not every micro-commit.

The user's optional version argument follows.
