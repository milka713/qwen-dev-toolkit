#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /main-push backend — deterministic, user-only authorization for ONE main/master push.
# The git-branch-guard hook blocks pushes/merges to the protected branch unless a fresh
# token exists here. Only the user can run a slash command, so this makes "explicit main
# approval" un-fakeable by the model. Token is SINGLE-USE: it authorizes one push to main
# (which covers the merge before it), then the guard consumes it. A TTL only expires an
# unused token; revoke early with /main-push off.
# Args: ""|on -> authorize ; off|revoke -> revoke ; status -> report.
set -u
QHOME="${QWEN_HOME:-$HOME/.qwen}"; T="$QHOME/.main-approval"
norm="$(printf '%s' "${*:-}" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "${*:-}")"

case "$norm" in
  off|revoke|cancel)
    rm -f "$T"
    echo "MAIN_PUSH_RESULT: main authorization revoked. Pushes/merges to main are blocked again."
    ;;
  status)
    if [ -f "$T" ]; then
      age=$(( $(date +%s) - $(stat -f %m "$T" 2>/dev/null || stat -c %Y "$T" 2>/dev/null || echo 0) ))
      if [ "$age" -le 900 ]; then echo "MAIN_PUSH_RESULT: main is AUTHORIZED — single-use: ONE push pending (not yet used), covers the merge before it. Expires in ~$(( (900 - age) / 60 ))m if unused."
      else rm -f "$T"; echo "MAIN_PUSH_RESULT: main is NOT authorized (previous token expired unused)."; fi
    else echo "MAIN_PUSH_RESULT: main is NOT authorized (default). Pushes/merges to main are blocked."; fi
    ;;
  *)
    mkdir -p "$QHOME"; : > "$T"
    echo "MAIN_PUSH_RESULT: main AUTHORIZED for ONE push (single-use — it covers the merge and the one push, then is consumed; a second push needs /main-push again). Expires if unused in 15 min. Proceed with the release now. Revoke early with /main-push off."
    ;;
esac
