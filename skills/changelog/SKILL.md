---
name: changelog
description: Generate or update CHANGELOG.md from the git history since the last release/tag, grouped by change type (Added/Changed/Fixed/…) in Keep-a-Changelog style. Use when the user says "changelog", "обнови changelog", or when cutting a release. Invoke with /changelog or /changelog <version>.
argument-hint: '[version]'
priority: 15
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
  - edit
  - write_file
---

# /changelog — a human changelog from the git log

Turn commits into a changelog entry a person would actually want to read — grouped and de-noised, not a raw `git log` dump.

## Steps

1. **Find the range.** Get the last tag: `git describe --tags --abbrev=0`. If there are no tags but `CHANGELOG.md` already has released sections, don't re-list what's covered there — start after the commit of the newest listed release. If neither exists, use the whole history. Collect: `git log <boundary>..HEAD --no-merges --pretty=format:'%h %s'`.
2. **Pick the version.** Use the argument if given; else read the current version (`VERSION`, `package.json`, `pyproject.toml`, or the latest tag) and propose the next one: breaking change → major, any feature → minor, only fixes/chores → patch. If the project has a custom scheme pinned by `/versioning` in its QWEN.md, follow that scheme instead. State which version you chose and why. Get today's date from `date +%F` — never guess it.
3. **Group by type** in [Keep a Changelog](https://keepachangelog.com) sections, in this order, omitting empty ones:
   - **Added** (`feat`), **Changed** (`refactor`, behavior changes), **Fixed** (`fix`), **Removed**, **Security**, **Docs** (`docs`), **Internal** (`chore`/`ci`/`build` — keep terse or drop).
   - Put **breaking changes first**, as bold `**Breaking:**` lines under Changed/Removed. Detect them by `type!:` subjects and `git log <boundary>..HEAD --grep='BREAKING' --oneline`.
   - Rewrite each commit subject into a user-facing, past-tense line: drop the `type(scope):` prefix, merge duplicates and fixup chains into one line, skip pure noise ("wip", "fix typo"). Reference the short hash where useful.
4. **Write it.** Prepend a new section to `CHANGELOG.md` (create it with a standard Keep-a-Changelog header if missing). If an `[Unreleased]` section exists, fold its content into the new version and leave `[Unreleased]` empty.
   ```
   ## [<version>] - <YYYY-MM-DD>
   ### Added
   - ...
   ### Fixed
   - ...
   ```
   Newest version on top; **never rewrite past released sections**.
5. **Report.** Show the new entry and state the version chosen and why. If the repo tracks its version in a file (`VERSION`, `package.json`, `qwen-extension.json`), offer to bump it to match. Do not commit unless asked (`/gitflow`'s call), and do not tag or publish a release here — once the bump lands on `main`, **`/release`** cuts the tag + GitHub Release from this entry so the release never lags the code.

## Guardrails

- Ground every line in a real commit. If a subject is too vague to describe ("fix", "update"), run `git show --stat <hash>` and write the line from what it actually touched — don't invent, don't copy the vague subject.
- Don't expose secrets, internal hosts, or private paths from commit messages.
- Keep it concise: a reader wants the shape of the release, not every micro-commit.

The user's optional version argument follows.
