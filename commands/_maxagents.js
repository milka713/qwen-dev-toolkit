#!/usr/bin/env node
'use strict';
// Node port of _maxagents.sh — HARD cap on concurrent subagents. The "at most N at a time"
// line is the single source of truth read by agent-limit.js.
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const arg = rawArg(2);
const F = 'QWEN.md', M = 'maxagents';
const n = norm(arg);

function writeBlock(num) {
  const seq = num === '1' ? ' Since the limit is 1, run strictly sequentially — one subagent at a time, wait for it to finish before starting the next.' : '';
  const lines = [
    '',
    '<!-- maxagents:start -->',
    `## 🧱 Subagent limit — at most ${num} at a time`,
    `This machine is resource-constrained (a local model). Run **at most ${num} subagent(s) of any type (implementer/scout/tester/…) concurrently** — never launch more than ${num} awaitable subagent(s) in a single response.${seq} This limit is **enforced deterministically** (extra subagent launches are blocked automatically), so launching more just wastes a turn — pace them within the limit. Keep decomposing into right-sized tasks; just process them ${num} at a time. (Remove with \`/maxagents off\`.)`,
    '<!-- maxagents:end -->',
  ];
  appendF(F, lines.join('\n') + '\n');
}

if (n === '' || n === 'status') {
  if (hasMarker(F, M)) { const m = readF(F).match(/at most [0-9]+ at a time/); console.log(`MAXAGENTS_RESULT: ${m ? m[0] : ''} (pinned).`); }
  else console.log('MAXAGENTS_RESULT: no limit set — subagents run as the work needs (sequential by default). Use /maxagents <N> to cap.');
} else if (n === 'off' || n === 'auto' || n === 'none' || n === 'unlimited') {
  if (hasMarker(F, M)) { removeBlock(F, M); console.log('MAXAGENTS_RESULT: limit removed — back to default (as many as the work needs).'); }
  else console.log('MAXAGENTS_RESULT: there was no limit set.');
} else if (/^[0-9]+$/.test(n) && parseInt(n, 10) >= 1) {
  if (hasMarker(F, M)) removeBlock(F, M);
  if (!exists(F)) writeF(F, '');
  writeBlock(n);
  console.log(`MAXAGENTS_RESULT: limit set — at most ${n} subagent(s) at a time (pinned in QWEN.md, survives compaction).`);
} else {
  console.log(`MAXAGENTS_RESULT: usage — /maxagents <N> (N>=1), /maxagents off, or /maxagents status. Got: '${arg}'`);
}
