#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /reality — "integrity over agreement" honesty directive. It is now ON BY DEFAULT in every
// project (the directive lives in the global ~/.qwen/QWEN.md guidance). This command only lets
// a project OPT OUT: /reality off pins a `realityoff` block into the PROJECT QWEN.md telling the
// model to disregard the global honesty directive here; /reality on removes it (back to the
// default). Inverse of the old default-off behaviour — the legacy `realitymode` ON-block is
// swept if present (it is now redundant with the always-on global directive).
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const F = 'QWEN.md', OFF = 'realityoff', LEGACY = 'realitymode';
const n = norm(rawArg(2));

function pinOff() {
  const lines = [
    '',
    '<!-- realityoff:start -->',
    '## 🔍 Honesty mode — OFF for this project',
    'The global "integrity over agreement" directive is **disabled in this project** by explicit request. A normal, more accommodating tone is fine here. (Re-enable with `/reality on`.)',
    '<!-- realityoff:end -->',
  ];
  if (!exists(F)) writeF(F, '');
  appendF(F, lines.join('\n') + '\n');
}

if (hasMarker(F, LEGACY)) removeBlock(F, LEGACY); // legacy ON-block is now redundant — clean it

if (n === 'off') {
  if (hasMarker(F, OFF)) console.log('REALITY_RESULT: Honesty mode was already OFF in this project.');
  else { pinOff(); console.log('REALITY_RESULT: Honesty mode is now OFF for this project (opt-out pinned in QWEN.md) — you may use the normal tone here. Re-enable with /reality on.'); }
} else if (n === 'status') {
  console.log(hasMarker(F, OFF)
    ? 'REALITY_RESULT: OFF for this project (opt-out pinned in QWEN.md). Default is ON everywhere else.'
    : 'REALITY_RESULT: ON (default — integrity over agreement, from the global directive). Opt out here with /reality off.');
} else { // bare or "on" → ensure ON (remove any opt-out)
  if (hasMarker(F, OFF)) { removeBlock(F, OFF); console.log('REALITY_RESULT: Honesty mode is back ON for this project (opt-out removed) — integrity over agreement, as everywhere by default.'); }
  else console.log('REALITY_RESULT: Honesty mode is ON (the default in every project) — integrity over agreement. Nothing to change. Opt out here with /reality off.');
}
