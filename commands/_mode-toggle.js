#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _mode-toggle.sh — generic pinned-mode toggle in the project QWEN.md.
// Args: <marker> <blockfile> <label> [user arg...]
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const marker = process.argv[2];
const blockfile = process.argv[3];
const label = process.argv[4];
if (!marker || !blockfile || !label) { console.error('usage: _mode-toggle.js <marker> <blockfile> <label> [arg]'); process.exit(1); }
const arg = rawArg(5);
const F = 'QWEN.md';
const n = norm(arg);

if (n === 'off') {
  if (hasMarker(F, marker)) { removeBlock(F, marker); console.log(`MODE_RESULT: ${label} is now OFF — its block was removed from QWEN.md.`); }
  else console.log(`MODE_RESULT: ${label} was already OFF.`);
} else if (n === 'status') {
  console.log(hasMarker(F, marker) ? `MODE_RESULT: ${label} is ON (block present in QWEN.md).` : `MODE_RESULT: ${label} is OFF.`);
} else {
  if (hasMarker(F, marker)) { console.log(`MODE_RESULT: ${label} already ON; QWEN.md unchanged.`); }
  else {
    if (!exists(F)) writeF(F, '');
    appendF(F, '\n' + readF(blockfile));
    console.log(`MODE_RESULT: ${label} is now ON — block pinned in QWEN.md (survives compaction, no re-declaration needed).`);
  }
}
