#!/usr/bin/env bash
# /mainok backend — deterministic, user-only authorization for ONE main/master operation.
# The git-branch-guard hook blocks pushes/merges to the protected branch unless a fresh
# token exists here. Only the user can run a slash command, so this makes "explicit main
# approval" un-fakeable by the model. Token opens a 15-minute window (covers the whole
# merge+push release, not just one command); revoke early with /mainok off.
# Args: ""|on -> authorize ; off|revoke -> revoke ; status -> report.
set -u
QHOME="${QWEN_HOME:-$HOME/.qwen}"; T="$QHOME/.main-approval"
norm="$(printf '%s' "${*:-}" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "${*:-}")"

case "$norm" in
  off|revoke|cancel)
    rm -f "$T"
    echo "MAINOK_RESULT: main authorization revoked. Pushes/merges to main are blocked again."
    ;;
  status)
    if [ -f "$T" ]; then
      age=$(( $(date +%s) - $(stat -f %m "$T" 2>/dev/null || stat -c %Y "$T" 2>/dev/null || echo 0) ))
      if [ "$age" -le 900 ]; then echo "MAINOK_RESULT: main is AUTHORIZED (window open ~$(( (900 - age) / 60 ))m more; covers merge+push)."
      else rm -f "$T"; echo "MAINOK_RESULT: main is NOT authorized (previous token expired)."; fi
    else echo "MAINOK_RESULT: main is NOT authorized (default). Pushes/merges to main are blocked."; fi
    ;;
  *)
    mkdir -p "$QHOME"; : > "$T"
    echo "MAINOK_RESULT: main AUTHORIZED for a 15-minute release window (covers the merge and the push). Proceed with the main release now. Revoke early with /mainok off."
    ;;
esac
