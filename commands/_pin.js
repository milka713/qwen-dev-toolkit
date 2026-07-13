#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _pin.sh — remember ANY info, compaction-proof, in a gitignored FACTS.md.
const { readF, writeF, appendF, exists, norm, rawArg } = require('./_qdt.js');

const arg = rawArg(2);
const FACTS = 'FACTS.md', Q = 'QWEN.md', GI = '.gitignore';
const HEADER = '# Project memory (pinned info — always in context, never compacted, gitignored)';
const n = norm(arg);

function ensureWiring() {
  if (!exists(FACTS)) writeF(FACTS, HEADER + '\n\n');
  if (!readF(Q).includes('@FACTS.md')) {
    appendF(Q, '\n<!-- pinned project memory (compaction-proof) — see FACTS.md -->\n@FACTS.md\n');
  }
  const gi = readF(GI);
  if (!gi.split('\n').some((l) => l === 'FACTS.md')) appendF(GI, 'FACTS.md\n');
}

if (n === '' || n === 'list' || n === 'status' || n === 'show') {
  if (exists(FACTS)) { console.log('PIN_RESULT: current pinned memory —'); process.stdout.write(readF(FACTS)); }
  else console.log('PIN_RESULT: nothing pinned yet — use /pin <anything to remember> (e.g. /pin deploy server 10.0.0.5:2222, ssh user mark).');
} else if (n === 'clear') {
  if (exists(FACTS)) { writeF(FACTS, HEADER + '\n\n'); console.log('PIN_RESULT: cleared all pinned memory in FACTS.md.'); }
  else console.log('PIN_RESULT: nothing to clear.');
} else if (n === 'remove' || n === 'forget') {
  console.log('PIN_RESULT: usage — /pin remove <text of the pinned line to remove>.');
} else if (n.startsWith('remove ') || n.startsWith('forget ')) {
  // Only fact lines ("- ...") are candidates — never the header.
  const pat = arg.slice(arg.indexOf(' ') + 1);
  const lc = pat.toLowerCase();
  const isMatch = (l) => l.startsWith('- ') && l.toLowerCase().includes(lc);
  if (exists(FACTS) && readF(FACTS).split('\n').some(isMatch)) {
    const kept = readF(FACTS).split('\n').filter((l) => !isMatch(l));
    writeF(FACTS, kept.join('\n'));
    console.log('PIN_RESULT: removed pinned lines matching: ' + pat);
  } else console.log('PIN_RESULT: no pinned line matches: ' + pat);
} else {
  ensureWiring();
  appendF(FACTS, '- ' + arg + '\n');
  console.log("PIN_RESULT: pinned (loaded into context every session via @FACTS.md, gitignored so it won't be committed): " + arg);
}
