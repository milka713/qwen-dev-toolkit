#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /maxagents backend — HARD cap on how many subagents run at once.
# The "at most N at a time" line written here is the single source of truth read by the
# agent-limit.js hook, which DETERMINISTICALLY denies `agent` launches beyond N at the
# PreToolUse layer (not just an instruction the model may ignore). The block also tells
# the model to self-limit. Default (no block) = "as many as the work needs".
# Args: <N> (>=1) -> cap at N ; off | auto -> remove the cap ; status.
set -u
ARG="${*:-}"; F="QWEN.md"; M="maxagents"
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.atmp" && mv "$F.atmp" "$F"; }

write_block() {
  local n="$1" seq=""
  [ "$n" = 1 ] && seq=' Since the limit is 1, run strictly sequentially — one subagent at a time, wait for it to finish before starting the next.'
  printf '%s\n' \
    '' \
    '<!-- maxagents:start -->' \
    "## 🧱 Subagent limit — at most ${n} at a time" \
    "This machine is resource-constrained (a local model). Run **at most ${n} subagent(s) of any type (implementer/scout/tester/…) concurrently** — never launch more than ${n} awaitable subagent(s) in a single response.${seq} This limit is **enforced deterministically** (extra subagent launches are blocked automatically), so launching more just wastes a turn — pace them within the limit. Keep decomposing into right-sized tasks; just process them ${n} at a time. (Remove with \`/maxagents off\`.)" \
    '<!-- maxagents:end -->' >> "$F"
}

case "$norm" in
  ""|status)
    if has; then echo "MAXAGENTS_RESULT: $(grep -oE 'at most [0-9]+ at a time' "$F" | head -1) (pinned)."
    else echo "MAXAGENTS_RESULT: no limit set — subagents run as the work needs (sequential by default). Use /maxagents <N> to cap."; fi
    ;;
  off|auto|none|unlimited)
    if has; then remove; echo "MAXAGENTS_RESULT: limit removed — back to default (as many as the work needs)."
    else echo "MAXAGENTS_RESULT: there was no limit set."; fi
    ;;
  *)
    if printf '%s' "$norm" | grep -qE '^[0-9]+$' && [ "$norm" -ge 1 ]; then
      has && remove
      touch "$F"; write_block "$norm"
      echo "MAXAGENTS_RESULT: limit set — at most ${norm} subagent(s) at a time (pinned in QWEN.md, survives compaction)."
    else
      echo "MAXAGENTS_RESULT: usage — /maxagents <N> (N>=1), /maxagents off, or /maxagents status. Got: '${ARG}'"
    fi
    ;;
esac
