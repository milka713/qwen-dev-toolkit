#!/usr/bin/env bash
# Deterministic backend for the /dev custom command.
# Arg $1 = on | off | status | <goal text> (empty = on).
# Manages a pinned development-mode block in the project's QWEN.md. That file is
# loaded as system context every request and is never touched by compaction, so the
# flag persists for the whole session and across restarts with no re-declaration.
set -u
ARG="${1:-}"
F="QWEN.md"
KEY="devmode:start"

norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has_block() { grep -q "$KEY" "$F" 2>/dev/null; }

remove_block() {
  # delete the inclusive marker range; portable (no in-place flag)
  sed '/<!-- devmode:start -->/,/<!-- devmode:end -->/d' "$F" > "$F.devtmp" && mv "$F.devtmp" "$F"
}

add_block() {
  touch "$F"
  # single-quoted lines: backticks stay literal, no command substitution
  printf '%s\n' \
    '' \
    '<!-- devmode:start -->' \
    '## 🏗️ Development mode — ACTIVE' \
    'This project is in **development mode**. Operate as an ARCHITECT, not a coder: keep the main context lean (goal, plan, short result summaries); delegate ALL implementation to `implementer` subagents (as many as the work needs, one per small task); delegate exploration to `scout`; keep `.qwen/PROGRESS.md` current. Do not write feature code directly in the main context. (Turn off with `/dev off`.)' \
    '<!-- devmode:end -->' >> "$F"
}

case "$norm" in
  off)
    if has_block; then remove_block; echo "DEVMODE_RESULT: OFF — development-mode block removed from QWEN.md. Answer normally as a single agent from now on."
    else echo "DEVMODE_RESULT: OFF — development mode was already off."; fi
    ;;
  status)
    if has_block; then echo "DEVMODE_RESULT: ON (block present in QWEN.md)."; else echo "DEVMODE_RESULT: OFF."; fi
    ;;
  *)
    if has_block; then echo "DEVMODE_RESULT: ON — already enabled; QWEN.md unchanged."
    else add_block; echo "DEVMODE_RESULT: ON — development-mode block pinned in QWEN.md (survives compaction). Plan in the main context and delegate implementation to implementer subagents."; fi
    ;;
esac
