// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Shared helper for the toolkit's hook scripts: is this hook currently switched OFF?
// State lives in ~/.qwen/.hooks-disabled (one hook name per line), edited by /hooks.
// The hooks stay wired in settings.json but each one calls disabled(<its name>) at the
// very top and no-ops (exit 0 = allow / do nothing) when listed. NEVER throws: on any
// error it returns false, so a guard stays active by default (fail-safe, not fail-open).
const fs = require('fs');
const os = require('os');
const path = require('path');

function disabled(name) {
  try {
    const home = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
    const raw = fs.readFileSync(path.join(home, '.hooks-disabled'), 'utf8');
    return raw.split('\n').some((l) => l.trim() === name);
  } catch (_) { return false; }
}

module.exports = { disabled };
