#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /main-push backend (macOS/Linux) — thin wrapper: the real logic lives in _main-push.js, a single
# Node implementation shared by every OS (Node is already a hard toolkit prerequisite,
# so a parallel bash implementation added maintenance cost without adding portability).
exec node "$(cd "$(dirname "$0")" && pwd)/_main-push.js" "$@"
