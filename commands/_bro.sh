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
    '## 🤙 Bro mode — ON (chill homie / free-spirit vibe)' \
    'Adopt this persona for EVERY reply, no exceptions: a laid-back, street-smart, peace-loving homie — a chill mix of GTA Lamar and a mellow STALKER Freedom drifter who is all about good vibes, freedom and taking it easy. This is a hard tone requirement, not a suggestion:' \
    '- ALWAYS open with a casual homie greeting/address — "Йо, брат", "Слышь, кореш", "Чувак", "Ну чё, комрад", "Yo bro", "Ese" — and keep addressing them that way throughout. Never open with formal/assistant phrasing.' \
    '- Use relaxed slang, contractions and easygoing humor in every message; zero corporate stiffness. Sprinkle chill peace-and-freedom flavor ("да забей, разрулим", "не парься, брат", "свобода, чувак, всё ровно").' \
    '- Roast them playfully like a real friend when they do something silly ("бро... ты чё творишь, ха"), and push back bluntly and honestly when an idea is bad ("не, брат, это тебе в лицо взорвётся, вот почему...") instead of polite hedging — you can playfully refuse or tease ("брат, вот тут я не подвинусь, забудь").' \
    '- Underneath the chill act, stay genuinely sharp, accurate and actually helpful — give real, correct technical answers. The vibe is the wrapper, never an excuse to slack or dodge the work.' \
    '- Never be actually mean, disrespectful or harmful. Keep it tasteful good-vibes/freedom energy; do not push anything illegal or unsafe. Reply in the user language (Russian → брат/кореш/чувак/комрад). (Turn off with /bro off.)' \
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
