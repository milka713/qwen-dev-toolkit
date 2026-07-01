#!/usr/bin/env bash
# /versioning backend — deterministic version-naming policy toggle (GLOBAL ~/.qwen/QWEN.md).
# Default OFF. When ON, the model names versions with semver by significance (patch/minor/
# major) and states the bump. A free-text argument pins a CUSTOM naming scheme instead.
# Args: ""|on -> semantic default ; off -> disable ; status ; <text> -> custom scheme.
set -u
QHOME="${QWEN_HOME:-$HOME/.qwen}"; F="$QHOME/QWEN.md"; M="versioning"
ARG="${*:-}"
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.vtmp" && mv "$F.vtmp" "$F"; }
scheme() {
  if grep -qF 'versioning: custom' "$F" 2>/dev/null; then echo custom
  elif grep -qF 'versioning: default' "$F" 2>/dev/null; then echo default
  else echo none; fi
}

write_default() {
  printf '%s\n' \
    '' \
    '<!-- versioning:start -->' \
    '<!-- versioning: default -->' \
    '## 🏷️ Version naming — ON (semantic, by significance)' \
    'When you announce, bump, tag or report a version, use semantic versioning and choose the bump by how significant the change is:' \
    '- PATCH (x.y.Z) — a small fix, tweak, docs change, or refactor with no behavior change (e.g. 1.4.6 → 1.4.7).' \
    '- MINOR (x.Y.0) — a notable new feature or backward-compatible behavior change (e.g. 1.4.7 → 1.5.0).' \
    '- MAJOR (X.0.0) — a breaking / incompatible change (e.g. 1.5.0 → 2.0.0).' \
    'Always state the concrete version explicitly (e.g. "v1.4.7", "v1.5.0") when reporting a release, and say which part you bumped and why. (Turn off with /versioning off.)' \
    '<!-- versioning:end -->' >> "$F"
}
write_custom() {
  printf '%s\n' \
    '' \
    '<!-- versioning:start -->' \
    '<!-- versioning: custom -->' \
    '## 🏷️ Version naming — ON (custom scheme)' \
    "When you announce, bump, tag or report a version, follow this scheme: ${ARG}" \
    'Always state the concrete version explicitly when reporting a release, and say which part you bumped and why. (Turn off with /versioning off.)' \
    '<!-- versioning:end -->' >> "$F"
}

case "$norm" in
  off)
    if has; then remove; echo "VERSIONING_RESULT: version-naming mode OFF — back to normal."
    else echo "VERSIONING_RESULT: version-naming mode was already OFF."; fi
    ;;
  status)
    case "$(scheme)" in
      default) echo "VERSIONING_RESULT: ON (semantic versioning by significance).";;
      custom)  echo "VERSIONING_RESULT: ON (custom scheme).";;
      *)       echo "VERSIONING_RESULT: OFF (default).";;
    esac
    ;;
  ""|on)
    touch "$F"; has && remove; write_default
    echo "VERSIONING_RESULT: version-naming mode ON — semantic versioning by significance (patch/minor/major), explicit version names. Pinned globally; /versioning off to disable."
    ;;
  *)
    touch "$F"; has && remove; write_custom
    echo "VERSIONING_RESULT: version-naming mode ON — custom scheme applied. Pinned globally; /versioning off to disable."
    ;;
esac
