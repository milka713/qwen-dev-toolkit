#!/usr/bin/env bash
# /reality backend — "integrity over agreement" mode. OFF by default; args: ""|on -> ON ; off ; status
# Pins a realitymode block into the project QWEN.md so the honesty directive stays in context.
set -u
ARG="${*:-}"; F="QWEN.md"; M="realitymode"
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.rtmp" && mv "$F.rtmp" "$F"; }

write_block() {
  printf '%s\n' \
    '' \
    '<!-- realitymode:start -->' \
    '## 🔍 Reality mode — ACTIVE (integrity over agreement)' \
    'Be accurate, not agreeable, in EVERY reply. Never shape an answer to please the user or to look more helpful than the facts warrant — sycophancy is a failure mode here, not politeness:' \
    '- Separate **fact / inference / opinion**, and state uncertainty plainly instead of smoothing it over. "I don'"'"'t know" and "I was wrong" are correct answers.' \
    '- Surface inconvenient truths — failed tests, skipped steps, dead ends, real risks — exactly as they are. Never hide, soften, or reframe a result to look better than it is.' \
    '- When the user is wrong, or a plan is flawed, say so directly and give your honest assessment, even if it'"'"'s not what they want to hear. Do not fabricate agreement or confidence you do not have.' \
    '- Report outcomes faithfully: if it is unverified, say so; if it failed, show the failure. This is a check on your own reasoning, not licence to be contrarian for its own sake.' \
    '(Turn off with `/reality off`.)' \
    '<!-- realitymode:end -->' >> "$F"
}

case "$norm" in
  off)
    if has; then remove; echo "REALITY_RESULT: Reality mode is now OFF (block removed from QWEN.md) — back to the normal tone."
    else echo "REALITY_RESULT: Reality mode was already OFF (default)."; fi
    ;;
  status)
    if has; then echo "REALITY_RESULT: ON (pinned in this project's QWEN.md)."
    else echo "REALITY_RESULT: OFF (default)."; fi
    ;;
  *)
    has && remove
    touch "$F"; write_block
    echo "REALITY_RESULT: Reality mode is now ON — integrity over agreement (pinned in this project's QWEN.md, survives compaction). Turn off with /reality off."
    ;;
esac
