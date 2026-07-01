#!/usr/bin/env bash
# Thin wrapper for macOS / Linux — the real uninstaller is the cross-platform uninstall.js.
# Windows: run  uninstall.cmd  (or  node uninstall.js).
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/uninstall.js" "$@"
