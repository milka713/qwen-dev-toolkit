---
name: release
description: Cut a version release so the published tag / GitHub Release never lags behind the code. Detects drift between the latest tag, the VERSION file, and the commits on main, then (when a bump is ready) creates the annotated git tag and a GitHub Release with notes from CHANGELOG. Use when the user says "release", "cut a release", "выпусти релиз", "publish the release", "tag a version", or right after merging to main. Invoke with /release (assess + cut), /release check (report only), or /release <version>.
argument-hint: '[check | <version>]'
priority: 20
allowedTools:
  - run_shell_command
  - read_file
  - grep_search
---

# /release — keep the published release in step with the code

The stable branch and the published release must agree: you should never have new code on `main` under an old tag, nor a `VERSION` bump that was never tagged or released. This skill detects that drift and cuts a correct release. It is the step that closes the loop `/changelog` and `/gitflow` deliberately leave to a release action.

## 1. Read the state (always — this is all `/release check` does)

Gather deterministically, never guess:
- **Current version `V`** — read `VERSION` (else `package.json` `"version"`, `pyproject.toml`, or `qwen-extension.json`).
- **Highest release tag `T`** — `git tag --sort=-v:refname | head -1`. This repo tags as `v<semver>`; match the existing style.
- **Is `V` tagged?** — `git tag --list "v$V"`; and what `HEAD` carries: `git tag --points-at HEAD`.
- **Commits since the last tag** — `git log "$T"..HEAD --no-merges --oneline` (empty `$T` → whole history).
- **Branch & cleanliness** — `git rev-parse --abbrev-ref HEAD`, `git status --porcelain`.
- **Version-file agreement** — `VERSION` vs `qwen-extension.json` / `package.json` must all state `V`.

## 2. Classify the drift and report it

Always print a one-line summary first: `latest tag T · VERSION V · N commits since T · <verdict>`. Then:

- **Up to date** — `vV` exists and points at `HEAD`: nothing to release. Say so and stop.
- **Release pending** — `vV` does **not** exist yet (VERSION was bumped but never tagged): the common drift. Go to step 3 and cut `vV`.
- **Code ahead of the release** — `vV` exists but there are new commits after it: code moved without a version bump. **Do not tag stale code.** Stop and tell the user to bump first — run `/changelog` (it adds the entry and offers the VERSION bump), then re-run `/release`.
- **Inconsistent** — the latest tag is higher than `V`, or the version files disagree: stop and report the exact mismatch; reconcile before releasing.

## 3. Preconditions before cutting (all must hold)

- **On `main`/`master`** — releases come from the stable branch. On `dev`/a feature branch, stop: the code must reach `main` first via `/gitflow` + `/main-push`. Never release from `dev`.
- **Clean tree** — no uncommitted changes.
- **Changelog ready** — a `## [V]` section exists in `CHANGELOG.md`. If the project keeps a changelog and it's missing, stop and suggest `/changelog V` first.
- **GitHub reachable** — `gh auth status` succeeds and an `origin` GitHub remote exists.
- **Versions agree** — the check from step 1.

If any fails, stop and report exactly what to fix — never cut a partial release.

## 4. Cut the release

1. **Tag** the release commit: `git tag -a "v$V" -m "v$V — <one-line summary from the CHANGELOG entry>"`, then `git push origin "v$V"`. Never move or overwrite an existing tag.
2. **Notes** — extract the `## [V]` section body from `CHANGELOG.md` (everything between that header and the next `## [`) into a notes file. No changelog? fall back to `--generate-notes`.
3. **Publish** — `gh release create "v$V" --title "v$V — <short title>" --notes-file <notes>`, adding `--latest` when it is the newest version. Never overwrite an existing release for that tag.
4. **Report** the release URL and the new in-sync state (`vV` now points at `HEAD`).

Use the version-naming scheme pinned by `/versioning` (semantic `vX.Y.Z` by default) for the tag name.

## Guardrails

- Publishing a GitHub Release is **outward-facing and hard to undo** — on a bare `/release`, state the exact tag + notes you will publish and get a go-ahead before `gh release create`, unless the user's request already clearly says to cut/publish it. `/release check` writes nothing.
- **One tag = one immutable release.** Never delete or move a published tag, and never edit a past release to carry new code — ship a new version instead.
- Never release from `dev` or with a dirty tree. Never invent a version — it comes from the VERSION file (or the user's explicit argument).
- Keep secrets and private hosts out of tag messages and release notes.

The user's optional argument (`check`, or an explicit version) follows.
