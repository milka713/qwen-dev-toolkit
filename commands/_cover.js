#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _cover.sh — test-first / coverage mode with a target % baked into the block.
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const arg = rawArg(2);
const F = 'QWEN.md', M = 'covermode', DEFAULT = 80;
const n = norm(arg);

function writeBlock(pct) {
  const lines = [
    '',
    '<!-- covermode:start -->',
    `## 🧪 Test-coverage / TDD mode — ACTIVE (target ≥${pct}%)`,
    'This project is in **test-first mode**. No feature is "done" until it ships tests and they pass:',
    '- **Work test-first (red → green → refactor):** for each new behavior, write the test FIRST and run it to watch it **fail for the right reason**, then implement until it passes, then refactor with the tests staying green. Do not write a pile of code and bolt tests on at the end.',
    '- Cover edge cases and error paths, not just the happy path.',
    `- Target **≥${pct}% line coverage on changed code**. Measure it with the project's real coverage tool (\`pytest --cov\`, \`jest --coverage\`, \`vitest --coverage\`, \`go test -cover\`, \`cargo tarpaulin\`, etc.) and report the **actual measured number** — never claim coverage you did not run.`,
    `- Gate completion on it: if tests fail or coverage is below ${pct}%, keep working; do not present hollow, unverified output. When delegating, tell each \`implementer\` subagent to work test-first, ship tests, and report measured coverage.`,
    '(Turn off with `/cover off`.)',
    '<!-- covermode:end -->',
  ];
  appendF(F, lines.join('\n') + '\n');
}

if (n === 'off') {
  if (hasMarker(F, M)) { removeBlock(F, M); console.log('MODE_RESULT: Test-first / coverage mode is now OFF (block removed from QWEN.md).'); }
  else console.log('MODE_RESULT: Test-first / coverage mode was already OFF.');
} else if (n === 'status') {
  if (hasMarker(F, M)) { const m = readF(F).match(/target ≥[0-9]+%/); console.log(`MODE_RESULT: ON (${m ? m[0] : ''}).`); }
  else console.log('MODE_RESULT: OFF.');
} else {
  let pct = DEFAULT;
  if (/^[0-9]+$/.test(n)) { const v = parseInt(n, 10); if (v >= 0 && v <= 100) pct = v; }
  if (hasMarker(F, M)) removeBlock(F, M);
  if (!exists(F)) writeF(F, '');
  writeBlock(pct);
  console.log(`MODE_RESULT: Test-first / coverage mode is now ON — target ≥${pct}% (pinned in QWEN.md, survives compaction).`);
}
