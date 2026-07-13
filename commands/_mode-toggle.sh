#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# Generic pinned-mode toggle for qwen-dev-toolkit custom commands.
# Pins/removes a marked block in the project's QWEN.md. That file is loaded as system
# context every request and is never touched by compaction, so the mode persists for the
# whole session and across restarts with no re-declaration.
#
# Args: $1=marker id (e.g. devmode)  $2=block file path  $3=human label  $4..=user arg
set -u
MARKER="${1:?marker}"; BLOCKFILE="${2:?blockfile}"; LABEL="${3:?label}"; shift 3
ARG="${*:-}"
F="QWEN.md"

norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"
has() { grep -qF "${MARKER}:start" "$F" 2>/dev/null; }

case "$norm" in
  off)
    if has; then
      sed "/${MARKER}:start/,/${MARKER}:end/d" "$F" > "$F.mtmp" && mv "$F.mtmp" "$F"
      echo "MODE_RESULT: ${LABEL} is now OFF — its block was removed from QWEN.md."
    else
      echo "MODE_RESULT: ${LABEL} was already OFF."
    fi
    ;;
  status)
    if has; then echo "MODE_RESULT: ${LABEL} is ON (block present in QWEN.md)."
    else echo "MODE_RESULT: ${LABEL} is OFF."; fi
    ;;
  *)
    if has; then
      echo "MODE_RESULT: ${LABEL} already ON; QWEN.md unchanged."
    else
      touch "$F"
      { printf '\n'; cat "$BLOCKFILE"; } >> "$F"
      echo "MODE_RESULT: ${LABEL} is now ON — block pinned in QWEN.md (survives compaction, no re-declaration needed)."
    fi
    ;;
esac
