#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _pin.sh — remember ANY info, compaction-proof, in a gitignored FACTS.md.
const { path, readF, writeF, appendF, exists, norm, rawArg } = require('./_qdt.js');

const arg = rawArg(2);
const FACTS = 'FACTS.md', Q = 'QWEN.md', GI = '.gitignore';
// The header is an INSTRUCTION, not a caption. It is imported into context verbatim, so it is
// the cheapest place to tell the model that these lines are authoritative and must be consulted
// before asking the user for something they already provided — the whole point of pinning.
const HEADER_TITLE = '# Project memory (pinned by the user — authoritative, never compacted, gitignored)';
const HEADER_DIRECTIVE =
  '<!-- HOW TO USE THIS FILE (instruction for the assistant, not a note for humans):\n' +
  '     Every line below is an established fact the USER already gave you. Treat it as ground\n' +
  '     truth and USE it without being reminded. Before asking the user for — or guessing at —\n' +
  '     a host, port, path, URL, command, credential LOCATION, or a standing rule, check here.\n' +
  '     This copy is a snapshot taken when the session started. If what you need is not here,\n' +
  '     re-read FACTS.md from disk before you ask: it may have been pinned after that. -->';
const HEADER = HEADER_TITLE + '\n' + HEADER_DIRECTIVE;
// Marker used to detect (and migrate) the older caption-only header.
const OLD_HEADER_RE = /^# Project memory \(pinned info[^\n]*\n?/;
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

// The line that makes the import self-explanatory in QWEN.md itself. Kept on one line and
// marked so it can be detected, migrated in, and never duplicated.
const IMPORT_BLOCK =
  '\n<!-- pinned project memory (compaction-proof) — see FACTS.md -->\n' +
  '**Pinned project memory.** The facts imported below were pinned by the user and are' +
  ' authoritative — use them instead of asking again or guessing. If something you need looks' +
  ' missing, re-read `FACTS.md` from disk (this import is a session-start snapshot).\n' +
  '@FACTS.md\n';

// Upgrade files written by an older toolkit, in place, without touching the facts themselves.
// Runs on every invocation (including `list`) so an existing project gets the directive header
// without having to pin something new first. Never creates anything.
function migrate() {
  if (exists(FACTS) && OLD_HEADER_RE.test(readF(FACTS))) {
    writeF(FACTS, readF(FACTS).replace(OLD_HEADER_RE, HEADER + '\n'));
  }
  const q = readF(Q);
  if (q.includes('@FACTS.md') && !q.includes('**Pinned project memory.**')) {
    writeF(Q, q.replace(/^@FACTS\.md$/m, IMPORT_BLOCK.trim().split('\n').slice(1).join('\n')));
  }
}

function ensureWiring() {
  if (!exists(FACTS)) writeF(FACTS, HEADER + '\n\n');
  migrate();
  const q = readF(Q);
  if (!q.includes('@FACTS.md')) appendF(Q, IMPORT_BLOCK);
  else if (!q.includes('**Pinned project memory.**')) {
    // Older wiring: the import is there but the directive isn't — insert it above the import.
    writeF(Q, q.replace(/^@FACTS\.md$/m, IMPORT_BLOCK.trim().split('\n').slice(1).join('\n')));
  }
  const gi = readF(GI);
  if (!gi.split('\n').some((l) => l === 'FACTS.md')) appendF(GI, 'FACTS.md\n');
}

migrate();   // keep an older project's wiring current, whatever the subcommand

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
