#!/usr/bin/env bash
# Thin wrapper for macOS / Linux — the real installer is the cross-platform install.js
# (needs Node, which qwen-code requires anyway). INSTALL and UPDATE are the same command:
# re-run it to update in place. Windows: run  install.cmd  (or  node install.js).
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/install.js" "$@"
