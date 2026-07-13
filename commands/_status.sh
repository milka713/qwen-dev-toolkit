#!/usr/bin/env bash
# qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
# /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
# /status backend — read-only snapshot of the per-project toolkit state.
set -u
Q="QWEN.md"; F="FACTS.md"; P=".qwen/PROGRESS.md"

grep -qF 'devmode:start'   "$Q" 2>/dev/null && echo "STATUS_DEV: ON"   || echo "STATUS_DEV: OFF"
grep -qF 'covermode:start' "$Q" 2>/dev/null && echo "STATUS_COVER: ON" || echo "STATUS_COVER: OFF"

if [ -f "$F" ]; then echo "STATUS_PINNED: $(grep -c '^- ' "$F" 2>/dev/null || echo 0) fact(s) in FACTS.md"
else echo "STATUS_PINNED: none (no FACTS.md)"; fi

if [ -f "$P" ]; then
  goal="$(awk '/^##[[:space:]].*Goal/{g=1;next} g&&/^##[[:space:]]/{exit} g&&NF{print}' "$P" 2>/dev/null | head -2 | tr '\n' ' ')"
  echo "STATUS_GOAL: ${goal:-(none recorded)}"
  done_n="$(grep -cE '^- \[x\]' "$P" 2>/dev/null || echo 0)"
  todo_n="$(grep -cE '^- \[ \]' "$P" 2>/dev/null || echo 0)"
  echo "STATUS_TASKS: $done_n done, $todo_n remaining"
  nxt="$(grep -m1 -E '^- \[ \]' "$P" 2>/dev/null | sed 's/^- \[ \] *//')"
  echo "STATUS_NEXT: ${nxt:-(no unchecked task)}"
else
  echo "STATUS_PROGRESS: no .qwen/PROGRESS.md (no active build)"
fi
