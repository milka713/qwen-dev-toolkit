#!/usr/bin/env bash
# /versioning backend — deterministic version-naming policy toggle, PER-PROJECT (writes the
# project's ./QWEN.md, so different projects can use different schemes in parallel).
# Semantic versioning is the GLOBAL default (stated in ~/.qwen/QWEN.md), so this command sets
# a PER-PROJECT override: a CUSTOM naming scheme, or OFF to opt a project out of the default.
# Args: ""|on -> re-pin semantic ; off -> opt-out block ; status ; <text> -> custom scheme.
set -u
F="QWEN.md"; M="versioning"
ARG="${*:-}"
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.vtmp" && mv "$F.vtmp" "$F"; }
scheme() {
  if grep -qF 'versioning: custom' "$F" 2>/dev/null; then echo custom
  elif grep -qF 'versioning: off' "$F" 2>/dev/null; then echo off
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
    'When the bump is borderline, prefer the smaller one; a same-cycle rework or correction of a just-released change is a PATCH, not a new MINOR.' \
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
write_off() {
  printf '%s\n' \
    '' \
    '<!-- versioning:start -->' \
    '<!-- versioning: off -->' \
    '## 🏷️ Version naming — OFF (this project)' \
    'This project opts OUT of the global semantic-versioning default: use no special version-naming policy here. (Re-enable with /versioning on.)' \
    '<!-- versioning:end -->' >> "$F"
}

case "$norm" in
  off)
    touch "$F"; has && remove; write_off
    echo "VERSIONING_RESULT: version-naming OFF for THIS project — overrides the global semantic-versioning default here. /versioning on to restore semver."
    ;;
  status)
    case "$(scheme)" in
      default) echo "VERSIONING_RESULT: ON (semantic versioning by significance).";;
      custom)  echo "VERSIONING_RESULT: ON (custom scheme).";;
      off)     echo "VERSIONING_RESULT: OFF for this project (overrides the global semantic default).";;
      *)       echo "VERSIONING_RESULT: ON (semantic — global default; no project override).";;
    esac
    ;;
  ""|on)
    touch "$F"; has && remove; write_default
    echo "VERSIONING_RESULT: version-naming mode ON — semantic versioning by significance (patch/minor/major), explicit version names. Pinned in this project's QWEN.md; /versioning off to disable."
    ;;
  *)
    touch "$F"; has && remove; write_custom
    echo "VERSIONING_RESULT: version-naming mode ON — custom scheme applied. Pinned in this project's QWEN.md; /versioning off to disable."
    ;;
esac
