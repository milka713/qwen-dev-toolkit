#!/usr/bin/env node
'use strict';
// Node port of _reality.sh — "integrity over agreement" mode. OFF by default; /reality on
// pins a realitymode block into the PROJECT QWEN.md so the honesty directive is always in
// context (and survives compaction) for that project until /reality off removes it.
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const F = 'QWEN.md', M = 'realitymode';
const n = norm(rawArg(2));

function writeBlock() {
  const lines = [
    '',
    '<!-- realitymode:start -->',
    '## 🔍 Reality mode — ACTIVE (integrity over agreement)',
    'Be accurate, not agreeable, in EVERY reply. Never shape an answer to please the user or to look more helpful than the facts warrant — sycophancy is a failure mode here, not politeness:',
    '- Separate **fact / inference / opinion**, and state uncertainty plainly instead of smoothing it over. "I don\'t know" and "I was wrong" are correct answers.',
    '- Surface inconvenient truths — failed tests, skipped steps, dead ends, real risks — exactly as they are. Never hide, soften, or reframe a result to look better than it is.',
    '- When the user is wrong, or a plan is flawed, say so directly and give your honest assessment, even if it\'s not what they want to hear. Do not fabricate agreement or confidence you do not have.',
    '- Report outcomes faithfully: if it is unverified, say so; if it failed, show the failure. This is a check on your own reasoning, not licence to be contrarian for its own sake.',
    '(Turn off with `/reality off`.)',
    '<!-- realitymode:end -->',
  ];
  appendF(F, lines.join('\n') + '\n');
}

if (n === 'off') {
  if (hasMarker(F, M)) { removeBlock(F, M); console.log('REALITY_RESULT: Reality mode is now OFF (block removed from QWEN.md) — back to the normal tone.'); }
  else console.log('REALITY_RESULT: Reality mode was already OFF (default).');
} else if (n === 'status') {
  if (hasMarker(F, M)) console.log('REALITY_RESULT: ON (pinned in this project\'s QWEN.md).');
  else console.log('REALITY_RESULT: OFF (default).');
} else {
  if (hasMarker(F, M)) removeBlock(F, M);
  if (!exists(F)) writeF(F, '');
  writeBlock();
  console.log('REALITY_RESULT: Reality mode is now ON — integrity over agreement (pinned in this project\'s QWEN.md, survives compaction). Turn off with /reality off.');
}
