#!/usr/bin/env bash
# /pin backend — append an important fact (server IP/port, deploy command, env quirk,
# where credentials live) to a compaction-proof FACTS.md.
# FACTS.md is auto-loaded into context via an `@FACTS.md` include added to the project
# QWEN.md (so it is never compacted), and is added to .gitignore so the facts — which
# may include IPs or credential locations — never get committed to the repo.
set -u
ARG="${*:-}"
FACTS="FACTS.md"; Q="QWEN.md"; GI=".gitignore"
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

ensure_wiring() {
  [ -f "$FACTS" ] || printf '%s\n' '# Project facts (pinned — always in context, gitignored, never compacted)' '' > "$FACTS"
  if ! grep -qF '@FACTS.md' "$Q" 2>/dev/null; then
    touch "$Q"
    printf '%s\n' '' '<!-- pinned project facts (compaction-proof) — see FACTS.md -->' '@FACTS.md' >> "$Q"
  fi
  grep -qxF 'FACTS.md' "$GI" 2>/dev/null || printf 'FACTS.md\n' >> "$GI"
}

case "$norm" in
  ""|list|status|show)
    if [ -f "$FACTS" ]; then echo "PIN_RESULT: current pinned facts —"; cat "$FACTS"
    else echo "PIN_RESULT: no FACTS.md yet — use /pin <fact> to add one (e.g. /pin deploy server 10.0.0.5 port 2222, ssh user mark)."; fi
    ;;
  *)
    ensure_wiring
    printf -- '- %s\n' "$ARG" >> "$FACTS"
    echo "PIN_RESULT: pinned to FACTS.md (loaded into context every session via @FACTS.md, gitignored so it won't be committed): $ARG"
    ;;
esac
