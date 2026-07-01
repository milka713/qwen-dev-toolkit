#!/usr/bin/env bash
# /pin backend — remember ANY important info, compaction-proof.
# Appends to a project-root FACTS.md (hosts/ports, deploy commands, decisions, URLs,
# snippets, gotchas — anything worth always having on hand). FACTS.md is auto-loaded
# into context via an `@FACTS.md` include added to the project QWEN.md (so it is never
# compacted), and is gitignored so the contents (which may include IPs or credential
# locations) can't leak to the repo.
set -u
ARG="${*:-}"
FACTS="FACTS.md"; Q="QWEN.md"; GI=".gitignore"
HEADER='# Project memory (pinned info — always in context, never compacted, gitignored)'
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

ensure_wiring() {
  [ -f "$FACTS" ] || printf '%s\n\n' "$HEADER" > "$FACTS"
  if ! grep -qF '@FACTS.md' "$Q" 2>/dev/null; then
    touch "$Q"
    printf '%s\n' '' '<!-- pinned project memory (compaction-proof) — see FACTS.md -->' '@FACTS.md' >> "$Q"
  fi
  grep -qxF 'FACTS.md' "$GI" 2>/dev/null || printf 'FACTS.md\n' >> "$GI"
}

case "$norm" in
  ""|list|status|show)
    if [ -f "$FACTS" ]; then echo "PIN_RESULT: current pinned memory —"; cat "$FACTS"
    else echo "PIN_RESULT: nothing pinned yet — use /pin <anything to remember> (e.g. /pin deploy server 10.0.0.5:2222, ssh user mark)."; fi
    ;;
  clear)
    if [ -f "$FACTS" ]; then printf '%s\n\n' "$HEADER" > "$FACTS"; echo "PIN_RESULT: cleared all pinned memory in FACTS.md."
    else echo "PIN_RESULT: nothing to clear."; fi
    ;;
  remove|forget)
    echo "PIN_RESULT: usage — /pin remove <text of the pinned line to remove>."
    ;;
  remove\ *|forget\ *)
    # Only fact lines ("- ...") are candidates — never the header.
    pat="${ARG#* }"
    if [ -f "$FACTS" ] && grep '^- ' "$FACTS" 2>/dev/null | grep -qiF -- "$pat"; then
      lc="$(printf '%s' "$pat" | tr '[:upper:]' '[:lower:]')"
      awk -v pat="$lc" '{ if ($0 ~ /^- / && index(tolower($0), pat)) next; print }' "$FACTS" > "$FACTS.ptmp" && mv "$FACTS.ptmp" "$FACTS"
      echo "PIN_RESULT: removed pinned lines matching: $pat"
    else echo "PIN_RESULT: no pinned line matches: $pat"; fi
    ;;
  *)
    ensure_wiring
    printf -- '- %s\n' "$ARG" >> "$FACTS"
    echo "PIN_RESULT: pinned (loaded into context every session via @FACTS.md, gitignored so it won't be committed): $ARG"
    ;;
esac
