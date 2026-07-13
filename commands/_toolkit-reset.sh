#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /toolkit-reset backend (macOS/Linux) — thin wrapper: the real logic lives in
# _toolkit-reset.js (editing QWEN.md's marker blocks and the approval token safely
# needs a real parser, and Node is already a hard toolkit prerequisite anyway).
exec node "$(cd "$(dirname "$0")" && pwd)/_toolkit-reset.js" "$@"
