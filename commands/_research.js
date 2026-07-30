#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /research — "think & research before flailing" directive. ON BY DEFAULT in every project
// (the directive lives in the global ~/.qwen/QWEN.md guidance; the detailed how-to is the
// /research skill). This command only lets a project OPT OUT: /research off pins a `researchoff`
// block into the PROJECT QWEN.md telling the model to disregard the global research-first
// directive here; /research on removes it (back to the default). Inverse of a normal mode toggle.
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const F = 'QWEN.md', OFF = 'researchoff';
const n = norm(rawArg(2));

function pinOff() {
  const lines = [
    '',
    '<!-- researchoff:start -->',
    '## 🔎 Research-first — OFF for this project',
    'The global "think & research before flailing" directive is **disabled in this project** by explicit request. Don\'t auto-research; act on what you have and ask the user when unsure. (Re-enable with `/research on`.)',
    '<!-- researchoff:end -->',
  ];
  if (!exists(F)) writeF(F, '');
  appendF(F, lines.join('\n') + '\n');
}

if (n === 'off') {
  if (hasMarker(F, OFF)) console.log('RESEARCH_RESULT: Research-first was already OFF in this project.');
  else { pinOff(); console.log('RESEARCH_RESULT: Research-first is now OFF for this project (opt-out pinned in QWEN.md). Re-enable with /research on.'); }
} else if (n === 'status') {
  console.log(hasMarker(F, OFF)
    ? 'RESEARCH_RESULT: OFF for this project (opt-out pinned in QWEN.md). Default is ON everywhere else.'
    : 'RESEARCH_RESULT: ON (default — investigate before flailing; see the /research skill). Opt out here with /research off.');
} else { // bare or "on" → ensure ON (remove any opt-out)
  if (hasMarker(F, OFF)) { removeBlock(F, OFF); console.log('RESEARCH_RESULT: Research-first is back ON for this project (opt-out removed) — investigate before flailing, as everywhere by default.'); }
  else console.log('RESEARCH_RESULT: Research-first is ON (the default in every project) — see the /research skill for how to search well. Nothing to change. Opt out here with /research off.');
}
