#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
// /autocompact backend — controls qwen-code's auto-compaction via
// context.autoCompactThreshold in ~/.qwen/settings.json (read at startup).
// The threshold is the share of the INPUT budget (contextWindowSize − max_tokens)
// at which auto-compaction fires. The toolkit's default stance is OFF (1.0):
// compaction is lossy, durable state lives in PROGRESS.md, and /checkpoint
// compacts deliberately — so nothing compacts behind your back.
// Args: status | <0.3–0.99 | 30–99> | off (=1.0) | on (=0.7, qwen's own default).
// Single logic for all OSes; the .sh twin is a thin wrapper over this file.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const SETTINGS = path.join(QHOME, 'settings.json');
const arg = process.argv.slice(2).join(' ').trim().toLowerCase();

const out = (msg) => { console.log('AUTOCOMPACT_RESULT: ' + msg); process.exit(0); };
const RESTART = ' Restart qwen-code to apply.';

let s;
try { s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); }
catch (_) { out('cannot read ' + SETTINGS + ' (missing or invalid JSON) — nothing changed.'); }

const save = () => fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
const cur = s.context && typeof s.context.autoCompactThreshold === 'number'
  ? s.context.autoCompactThreshold : undefined;
const describe = (v) =>
  v === undefined ? 'qwen default (0.7)'
  : v >= 1 ? '1.0 — auto-compaction OFF (fires only at a completely full window)'
  : String(v);

if (arg === '' || arg === 'status') {
  out('threshold is ' + describe(cur) +
    '. It fires at threshold x (contextWindowSize - max_tokens). Set: /autocompact <0.3-0.99>, disable: /autocompact off, re-enable default: /autocompact on.');
}

if (['off', 'never', 'disable', 'disabled'].includes(arg)) {
  s.context = s.context || {};
  s.context.autoCompactThreshold = 1;
  save();
  out('auto-compaction DISABLED (threshold 1.0 - it can only fire at a completely full window). ' +
    'You own the overflow now: past the window the server errors or truncates, so run /checkpoint before long sessions get close.' + RESTART);
}

if (['on', 'default', 'auto', 'enable', 'enabled'].includes(arg)) {
  s.context = s.context || {};
  s.context.autoCompactThreshold = 0.7;
  save();
  out('auto-compaction ENABLED at the stable default 0.7 - compaction fires at ~70% of the input budget.' + RESTART);
}

let n = Number(arg);
if (Number.isFinite(n)) {
  if (n > 1 && n <= 99) n = n / 100; // accept percent form: 85 -> 0.85
  n = Math.round(n * 100) / 100;
  if (n >= 0.3 && n <= 0.99) {
    s.context = s.context || {};
    s.context.autoCompactThreshold = n;
    save();
    out('threshold set to ' + n + ' - auto-compaction fires at ~' + Math.round(n * 100) +
      '% of the input budget. Higher = later compaction but less headroom for a fat turn plus the summary call itself; 0.7 is the stable default.' + RESTART);
  }
}

out("usage - /autocompact status | <0.3-0.99 or 30-99> | off | on. Got: '" + arg + "'");
