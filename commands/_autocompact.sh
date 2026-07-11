#!/usr/bin/env bash
# /autocompact backend (macOS/Linux) — thin wrapper: the real logic lives in
# _autocompact.js, because editing settings.json safely needs a real JSON parser
# and Node is already a hard toolkit prerequisite (the installer itself is Node).
# Output parity with Windows is by construction — it IS the same program.
exec node "$(cd "$(dirname "$0")" && pwd)/_autocompact.js" "$@"
