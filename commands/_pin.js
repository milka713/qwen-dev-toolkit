#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _pin.sh — remember ANY info, compaction-proof, in a gitignored FACTS.md.
const { path, readF, writeF, appendF, exists, norm, rawArg } = require('./_qdt.js');

const arg = rawArg(2);
const FACTS = 'FACTS.md', Q = 'QWEN.md', GI = '.gitignore';
const HEADER = '# Project memory (pinned info — always in context, never compacted, gitignored)';
const n = norm(arg);

// The fact lines only (the header and blank lines are not facts).
const factLines = () => readF(FACTS).split('\n').filter((l) => l.startsWith('- '));

// Print the whole pinned memory, with enough framing that the model can relay it verbatim.
// This is also the ONLY way to see facts pinned during the current session: qwen-code
// assembles QWEN.md and its @imports once at startup and never re-reads them, so a pin made
// now is not in the running session's context — but this output lands in the transcript.
function dump(label) {
  const facts = factLines();
  console.log('PIN_RESULT: ' + label + ' — ' + facts.length + ' fact(s) in ' + path.resolve(FACTS));
  if (facts.length === 0) {
    console.log('(no facts pinned yet — use /pin <anything to remember>)');
    return;
  }
  console.log('PIN_BEGIN');
  for (const l of facts) console.log(l);
  console.log('PIN_END');
}

function ensureWiring() {
  if (!exists(FACTS)) writeF(FACTS, HEADER + '\n\n');
  if (!readF(Q).includes('@FACTS.md')) {
    appendF(Q, '\n<!-- pinned project memory (compaction-proof) — see FACTS.md -->\n@FACTS.md\n');
  }
  const gi = readF(GI);
  if (!gi.split('\n').some((l) => l === 'FACTS.md')) appendF(GI, 'FACTS.md\n');
}

if (n === '' || n === 'list' || n === 'status' || n === 'show') {
  if (exists(FACTS)) dump('current pinned memory');
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
  console.log('PIN_RESULT: pinned to ' + path.resolve(FACTS) + " (gitignored, so it won't be committed): " + arg);
  console.log('PIN_NOTE: this lands in context automatically from the NEXT session onward (QWEN.md and its' +
    ' @FACTS.md import are read once at startup and never re-read). For the rest of THIS session the line' +
    ' above is what you have — run /pin list to pull the full memory back into the conversation.');
}
