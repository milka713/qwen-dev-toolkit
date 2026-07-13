#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _versioning.sh — semantic versioning is the GLOBAL default (~/.qwen/QWEN.md);
// this sets a PER-PROJECT override in ./QWEN.md: a CUSTOM scheme, or OFF to opt a project out.
const { readF, writeF, appendF, exists, norm, hasMarker, removeBlock, rawArg } = require('./_qdt.js');

const F = 'QWEN.md';
const M = 'versioning';
const arg = rawArg(2);
const n = norm(arg);

const scheme = () => {
  const c = readF(F);
  if (c.includes('versioning: custom')) return 'custom';
  if (c.includes('versioning: off')) return 'off';
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
  'When the bump is borderline, prefer the smaller one; a same-cycle rework or correction of a just-released change is a PATCH, not a new MINOR.',
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
const OFF = [
  '',
  '<!-- versioning:start -->',
  '<!-- versioning: off -->',
  '## 🏷️ Version naming — OFF (this project)',
  'This project opts OUT of the global semantic-versioning default: use no special version-naming policy here. (Re-enable with /versioning on.)',
  '<!-- versioning:end -->',
];

function ensureFile() { if (!exists(F)) writeF(F, ''); }

if (n === 'off') {
  ensureFile(); if (hasMarker(F, M)) removeBlock(F, M); appendF(F, OFF.join('\n') + '\n');
  console.log('VERSIONING_RESULT: version-naming OFF for THIS project — overrides the global semantic-versioning default here. /versioning on to restore semver.');
} else if (n === 'status') {
  const s = scheme();
  if (s === 'default') console.log('VERSIONING_RESULT: ON (semantic versioning by significance).');
  else if (s === 'custom') console.log('VERSIONING_RESULT: ON (custom scheme).');
  else if (s === 'off') console.log('VERSIONING_RESULT: OFF for this project (overrides the global semantic default).');
  else console.log('VERSIONING_RESULT: ON (semantic — global default; no project override).');
} else if (n === '' || n === 'on') {
  ensureFile(); if (hasMarker(F, M)) removeBlock(F, M); appendF(F, DEFAULT.join('\n') + '\n');
  console.log('VERSIONING_RESULT: version-naming mode ON — semantic versioning by significance (patch/minor/major), explicit version names. Pinned in this project\'s QWEN.md; /versioning off to disable.');
} else {
  ensureFile(); if (hasMarker(F, M)) removeBlock(F, M); appendF(F, custom().join('\n') + '\n');
  console.log('VERSIONING_RESULT: version-naming mode ON — custom scheme applied. Pinned in this project\'s QWEN.md; /versioning off to disable.');
}
