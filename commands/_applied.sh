#!/usr/bin/env bash
# /applied backend (macOS/Linux) — thin wrapper: the real logic lives in _applied.js
# (it parses ~/.qwen/settings.json, and JSON needs a real parser — Node is a hard
# toolkit prerequisite anyway). Read-only introspection; mutates nothing.
exec node "$(cd "$(dirname "$0")" && pwd)/_applied.js" "$@"
