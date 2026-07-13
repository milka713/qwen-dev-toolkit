#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /hooks backend (macOS/Linux) — thin wrapper: the real logic lives in _hooks.js (it shares
# the hook catalog with /applied and optionally parses settings.json — Node is a hard
# toolkit prerequisite anyway). Edits only ~/.qwen/.hooks-disabled.
exec node "$(cd "$(dirname "$0")" && pwd)/_hooks.js" "$@"
