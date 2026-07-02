---
name: toolkit-update
description: Install or update the qwen-dev-toolkit itself from its GitHub repo with one command — fetches the latest version and runs the cross-platform installer. Use when the user says "update the toolkit", "обнови тулкит/скиллы", "reinstall the skills", or asks to get the newest version. Invoke with /toolkit-update.
priority: 20
allowedTools:
  - run_shell_command
  - read_file
---

# /toolkit-update — get/refresh the toolkit from GitHub

One command to **install or update** this toolkit (the two are the same operation — the installer is idempotent and updates in place). Works on macOS, Linux and Windows because it only uses `git` and `node` (which qwen-code already needs).

Repo: `https://github.com/milka713/qwen-dev-toolkit`

## Steps

1. **Check prerequisites.** Confirm `git --version` and `node --version` both work. If `git` is missing, tell the user how to install it and stop. (`qwen` is obviously present — you're running in it.)
2. **Get the latest source** into a stable cache dir so updates are fast:
   - Cache path: `<HOME>/.qwen/.src/qwen-dev-toolkit` (use `$HOME` on macOS/Linux, `%USERPROFILE%` on Windows — or just let git use an absolute path).
   - If that dir already exists: note the current version (`read <cache>/VERSION`), then `git -C "<cache>" pull --ff-only`.
   - If not: `mkdir -p "$HOME/.qwen/.src"`, then `git clone --depth 1 https://github.com/milka713/qwen-dev-toolkit "<cache>"`.
   - **If the clone/pull fails** (offline, GitHub unreachable): report it and stop — or, if a cached copy exists, ask the user whether to (re)install that cached version instead. Never present a stale install as "updated".
3. **Run the cross-platform installer** from the cache dir:
   - macOS/Linux: `node "<cache>/install.js"` (or `bash "<cache>/install.sh"`).
   - Windows: `node "<cache>/install.js"` (or `"<cache>/install.cmd"`).
   - The installer copies only this toolkit's own files, merges its hook/memory settings and its `QWEN.md` block, and **never deletes any other skills/commands you have** or touches your keys/settings.
4. **Read the installer output** and confirm it reported the skills, agents, commands and hooks, plus `settings.json merged` and `QWEN.md guidance updated/added`. If it flagged a missing dependency (e.g. `git`), relay that.
5. **Report** what happened, grounded in `<cache>/VERSION`: fresh install ("installed v1.6.1"), an update ("updated v1.6.0 → v1.6.1" — you noted the old version in step 2), or already current ("already at v1.6.1, files refreshed"). Remind the user to **restart qwen-code / start a new session** for the changes to load.

## Notes

- Install vs update: identical — running this the first time installs; running it again updates. Say which one it was based on whether the cache dir already existed.
- If `git pull` fails because of local changes in the cache dir, re-clone fresh (delete the cache dir and clone again) rather than forcing.
- Don't modify the user's project with this — it only refreshes `~/.qwen`.
