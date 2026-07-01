#!/usr/bin/env node
'use strict';
// Node port of _versioning.sh — version-naming policy toggle (GLOBAL ~/.qwen/QWEN.md).
const { fs, path, readF, writeF, appendF, exists, norm, hasMarker, removeBlock, qHome, rawArg } = require('./_qdt.js');

const F = path.join(qHome(), 'QWEN.md');
const M = 'versioning';
const arg = rawArg(2);
const n = norm(arg);

const scheme = () => {
  const c = readF(F);
  if (c.includes('versioning: custom')) return 'custom';
  if (c.includes('versioning: default')) return 'default';
  return 'none';
};

const DEFAULT = [
  '',
  '<!-- versioning:start -->',
  '<!-- versioning: default -->',
  '## 🏷️ Version naming — ON (semantic, by significance)',
  'When you announce, bump, tag or report a version, use semantic versioning and choose the bump by how significant the change is:',
  '- PATCH (x.y.Z) — a small fix, tweak, docs change, or refactor with no behavior change (e.g. 1.4.6 → 1.4.7).',
  '- MINOR (x.Y.0) — a notable new feature or backward-compatible behavior change (e.g. 1.4.7 → 1.5.0).',
  '- MAJOR (X.0.0) — a breaking / incompatible change (e.g. 1.5.0 → 2.0.0).',
  'Always state the concrete version explicitly (e.g. "v1.4.7", "v1.5.0") when reporting a release, and say which part you bumped and why. (Turn off with /versioning off.)',
  '<!-- versioning:end -->',
];
const custom = () => [
  '',
  '<!-- versioning:start -->',
  '<!-- versioning: custom -->',
  '## 🏷️ Version naming — ON (custom scheme)',
  `When you announce, bump, tag or report a version, follow this scheme: ${arg}`,
  'Always state the concrete version explicitly when reporting a release, and say which part you bumped and why. (Turn off with /versioning off.)',
  '<!-- versioning:end -->',
];

function ensureFile() { if (!exists(F)) { fs.mkdirSync(path.dirname(F), { recursive: true }); writeF(F, ''); } }

if (n === 'off') {
  if (hasMarker(F, M)) { removeBlock(F, M); console.log('VERSIONING_RESULT: version-naming mode OFF — back to normal.'); }
  else console.log('VERSIONING_RESULT: version-naming mode was already OFF.');
} else if (n === 'status') {
  const s = scheme();
  if (s === 'default') console.log('VERSIONING_RESULT: ON (semantic versioning by significance).');
  else if (s === 'custom') console.log('VERSIONING_RESULT: ON (custom scheme).');
  else console.log('VERSIONING_RESULT: OFF (default).');
} else if (n === '' || n === 'on') {
  ensureFile(); if (hasMarker(F, M)) removeBlock(F, M); appendF(F, DEFAULT.join('\n') + '\n');
  console.log('VERSIONING_RESULT: version-naming mode ON — semantic versioning by significance (patch/minor/major), explicit version names. Pinned globally; /versioning off to disable.');
} else {
  ensureFile(); if (hasMarker(F, M)) removeBlock(F, M); appendF(F, custom().join('\n') + '\n');
  console.log('VERSIONING_RESULT: version-naming mode ON — custom scheme applied. Pinned globally; /versioning off to disable.');
}
