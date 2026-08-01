#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /settings-sync backend (macOS/Linux) — thin wrapper: the real logic lives in
# _settings-sync.js, a single Node implementation shared by every OS.
exec node "$(cd "$(dirname "$0")" && pwd)/_settings-sync.js" "$@"
