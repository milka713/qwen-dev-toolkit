#!/usr/bin/env node
'use strict';
// Node port of _status.sh — read-only snapshot of the per-project toolkit state.
const { readF, exists } = require('./_qdt.js');

const Q = 'QWEN.md', F = 'FACTS.md', P = '.qwen/PROGRESS.md';
const q = readF(Q);

console.log(q.includes('devmode:start') ? 'STATUS_DEV: ON' : 'STATUS_DEV: OFF');
console.log(q.includes('covermode:start') ? 'STATUS_COVER: ON' : 'STATUS_COVER: OFF');

if (exists(F)) {
  const facts = (readF(F).match(/^- /gm) || []).length;
  console.log(`STATUS_PINNED: ${facts} fact(s) in FACTS.md`);
} else console.log('STATUS_PINNED: none (no FACTS.md)');

if (exists(P)) {
  const lines = readF(P).split('\n');
  // lines under the "## ... Goal" heading, up to the next "## " heading
  const gi = lines.findIndex((l) => /^##\s.*Goal/.test(l));
  let goal = '';
  if (gi >= 0) {
    const out = [];
    for (let i = gi + 1; i < lines.length && out.length < 2; i++) {
      if (/^##\s/.test(lines[i])) break;
      if (lines[i].trim()) out.push(lines[i]);
    }
    // join with spaces and keep a trailing space, matching bash `head -2 | tr '\n' ' '`
    goal = out.length ? out.join(' ') + ' ' : '';
  }
  console.log(`STATUS_GOAL: ${goal || '(none recorded)'}`);
  const done = (readF(P).match(/^- \[x\]/gm) || []).length;
  const todo = (readF(P).match(/^- \[ \]/gm) || []).length;
  console.log(`STATUS_TASKS: ${done} done, ${todo} remaining`);
  const nxtLine = lines.find((l) => /^- \[ \]/.test(l));
  const nxt = nxtLine ? nxtLine.replace(/^- \[ \] */, '') : '';
  console.log(`STATUS_NEXT: ${nxt || '(no unchecked task)'}`);
} else {
  console.log('STATUS_PROGRESS: no .qwen/PROGRESS.md (no active build)');
}
