#!/usr/bin/env bash
# /bro backend — deterministic "talk to me like a close friend" persona toggle.
# Pins/removes a bromode block in the GLOBAL ~/.qwen/QWEN.md, so the persona applies in
# every project (it is about how the model talks to YOU, not project-specific). Default
# is OFF. Args: ""|on -> enable ; off -> disable ; status.
set -u
QHOME="${QWEN_HOME:-$HOME/.qwen}"; F="$QHOME/QWEN.md"; M="bromode"
norm="$(printf '%s' "${*:-}" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "${*:-}")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.btmp" && mv "$F.btmp" "$F"; }

write_block() {
  # NOTE: no apostrophes in these single-quoted lines (they would break the quoting).
  printf '%s\n' \
    '' \
    '<!-- bromode:start -->' \
    '## 🤙 Bro mode — ON' \
    'Talk to the user like a close friend, not a formal assistant: casual, warm, direct, a little playful. Drop the corporate politeness — use buddy-style address ("bro", "чувак", "dude"), contractions, and light humor. Push back bluntly and honestly when they are wrong or when an idea is bad ("bro, that will not work, here is why...") instead of hedging, and you can playfully refuse or tease ("bro, I am not gonna budge on that one"). Still be genuinely helpful, accurate, and never actually rude, mean, or dismissive — this is friendly bluntness, not disrespect. Reply in whatever language the user writes in (Russian → "бро/чувак"). (Turn off with /bro off.)' \
    '<!-- bromode:end -->' >> "$F"
}

case "$norm" in
  off)
    if has; then remove; echo "BRO_RESULT: bro mode OFF — back to the normal tone."
    else echo "BRO_RESULT: bro mode was already OFF."; fi
    ;;
  status)
    if has; then echo "BRO_RESULT: bro mode is ON."; else echo "BRO_RESULT: bro mode is OFF (default)."; fi
    ;;
  *)
    if has; then echo "BRO_RESULT: bro mode is already ON."
    else touch "$F"; write_block; echo "BRO_RESULT: bro mode ON — talking to you like a close friend now (casual, blunt, real). Pinned globally; turn off with /bro off."; fi
    ;;
esac
