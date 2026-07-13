#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /autocompact backend (macOS/Linux) — thin wrapper: the real logic lives in
# _autocompact.js, because editing settings.json safely needs a real JSON parser
# and Node is already a hard toolkit prerequisite (the installer itself is Node).
# Output parity with Windows is by construction — it IS the same program.
exec node "$(cd "$(dirname "$0")" && pwd)/_autocompact.js" "$@"
