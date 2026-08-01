#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// SessionStart hook for qwen-code.
// The /classifier-window command patches a constant in the qwen-code bundle. A qwen-code
// update (brew upgrade / npm i -g) replaces the whole bundle and silently reverts that window
// to the stock 40 — a harmless-but-invisible "slow again" regression. If a non-stock preference
// was recorded (~/.qwen/.classifier-window) and the live bundle no longer matches it, print one
// line telling the user to re-apply. Read-only: it never patches anything itself.
// Output contract: print JSON with hookSpecificOutput.additionalContext to stdout, or exit 0.
'use strict';
try { if (require('./_hookutil.js').disabled('classifier-window-check')) process.exit(0); } catch (_) {}
const fs = require('fs');
const os = require('os');
const path = require('path');

// Drain stdin (hook input is JSON) so we never block; content is unused.
try { fs.readFileSync(0, 'utf8'); } catch (_) {}

const qHome = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');

// Recorded preference (written by /classifier-window). Absent → nothing to enforce.
let pref = NaN;
try { pref = parseInt(fs.readFileSync(path.join(qHome, '.classifier-window'), 'utf8').trim(), 10); } catch (_) {}
if (!Number.isInteger(pref) || pref < 8 || pref > 40) process.exit(0);

// Read the live bundle value via the command backend's finder (single source of truth).
let loc = null;
try { loc = require(path.join(__dirname, '..', 'commands', '_classifier-window.js')).tryReadCurrent(); } catch (_) {}
if (!loc || typeof loc.current !== 'number') process.exit(0); // can't tell → stay silent (fail-safe)
if (loc.current === pref) process.exit(0);                    // in sync → nothing to say

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: '[toolkit] The qwen-code permission-classifier window is ' + loc.current
      + ', but your recorded preference is ' + pref + ' — a qwen-code update likely replaced the bundle and reverted it. '
      + 'Suggest the user run `/classifier-window ' + pref + '` to re-apply (takes effect after restarting qwen-code).',
  },
}));
