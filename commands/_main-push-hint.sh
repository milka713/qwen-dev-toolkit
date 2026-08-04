#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /main-push-hint backend (macOS/Linux) — thin wrapper: the real logic lives in
# _main-push-hint.js, a single Node implementation shared by every OS.
exec node "$(cd "$(dirname "$0")" && pwd)/_main-push-hint.js" "$@"
