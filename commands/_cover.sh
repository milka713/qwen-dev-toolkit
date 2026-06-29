#!/usr/bin/env bash
# /cover backend — deterministic test-first / coverage mode with a target % parameter.
# Args: ""|on -> default 80% ; <N> (0..100) -> that target ; off ; status
# Pins a covermode block (with the chosen target baked in) into the project QWEN.md.
set -u
ARG="${*:-}"; F="QWEN.md"; M="covermode"; DEFAULT=80
norm="$(printf '%s' "$ARG" | tr '[:upper:]' '[:lower:]' | xargs 2>/dev/null || printf '%s' "$ARG")"

has() { grep -qF "${M}:start" "$F" 2>/dev/null; }
remove() { sed "/${M}:start/,/${M}:end/d" "$F" > "$F.ctmp" && mv "$F.ctmp" "$F"; }

write_block() {
  local pct="$1"
  printf '%s\n' \
    '' \
    '<!-- covermode:start -->' \
    "## 🧪 Test-coverage / TDD mode — ACTIVE (target ≥${pct}%)" \
    'This project is in **test-first mode**. No feature is "done" until it ships tests and they pass:' \
    '- **Work test-first (red → green → refactor):** for each new behavior, write the test FIRST and run it to watch it **fail for the right reason**, then implement until it passes, then refactor with the tests staying green. Do not write a pile of code and bolt tests on at the end.' \
    '- Cover edge cases and error paths, not just the happy path.' \
    "- Target **≥${pct}% line coverage on changed code**. Measure it with the project's real coverage tool (\`pytest --cov\`, \`jest --coverage\`, \`vitest --coverage\`, \`go test -cover\`, \`cargo tarpaulin\`, etc.) and report the **actual measured number** — never claim coverage you did not run." \
    "- Gate completion on it: if tests fail or coverage is below ${pct}%, keep working; do not present hollow, unverified output. When delegating, tell each \`implementer\` subagent to work test-first, ship tests, and report measured coverage." \
    '(Turn off with `/cover off`.)' \
    '<!-- covermode:end -->' >> "$F"
}

case "$norm" in
  off)
    if has; then remove; echo "MODE_RESULT: Test-first / coverage mode is now OFF (block removed from QWEN.md)."
    else echo "MODE_RESULT: Test-first / coverage mode was already OFF."; fi
    ;;
  status)
    if has; then echo "MODE_RESULT: ON ($(grep -oE 'target ≥[0-9]+%' "$F" | head -1))."
    else echo "MODE_RESULT: OFF."; fi
    ;;
  *)
    PCT="$DEFAULT"
    if printf '%s' "$norm" | grep -qE '^[0-9]+$'; then
      if [ "$norm" -ge 0 ] && [ "$norm" -le 100 ]; then PCT="$norm"; fi
    fi
    has && remove
    touch "$F"; write_block "$PCT"
    echo "MODE_RESULT: Test-first / coverage mode is now ON — target ≥${PCT}% (pinned in QWEN.md, survives compaction)."
    ;;
esac
