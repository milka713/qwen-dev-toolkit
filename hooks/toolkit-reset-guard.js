#!/usr/bin/env node
// PreToolUse hook for qwen-code — engine-level backstop for /toolkit-reset.
// _toolkit-reset.js already self-checks its approval token before mutating, but that
// check only fires when the model runs the script itself — nothing stops a model with
// unrestricted run_shell_command from just calling `_toolkit-reset.js confirm` (or the
// .sh wrapper) directly, skipping the user ever seeing the preview or being asked.
// This hook denies exactly that attempt at the engine level, mirroring how
// git-branch-guard.js backstops /main-push: the approval token can only be CREATED by a
// real slash-command invocation of plain `/toolkit-reset` (custom commands are user-only
// — a model cannot invoke one itself), so a confirm attempt with no valid token is always
// either the model trying to bypass confirmation, or a stale/expired window — both denied.
// Read-only preview calls (no "confirm" arg) are always allowed; they don't mutate anything.
'use strict';
try { if (require('./_hookutil.js').disabled('toolkit-reset-guard')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');
const os = require('os');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

if ((input.tool_name || '') !== 'run_shell_command') process.exit(0);

const ti = input.tool_input || {};
const cmd = (ti.command || ti.cmd || '') + '';
if (!/_toolkit-reset\.(sh|js)/.test(cmd)) process.exit(0);
if (!/\bconfirm\b/.test(cmd)) process.exit(0); // preview-only invocation — harmless, allow

const QHOME = process.env.QWEN_HOME || path.join(process.env.HOME || os.homedir(), '.qwen');
const TOKEN = path.join(QHOME, '.toolkit-reset-approval');
const TTL_MS = 15 * 60 * 1000;
try {
  const st = fs.statSync(TOKEN);
  if (Date.now() - st.mtimeMs <= TTL_MS) process.exit(0); // real approval window open — allow
} catch (_) { /* no token */ }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      '🧰 qwen-dev-toolkit toolkit-reset guard blocked this: there is no active /toolkit-reset approval window. ' +
      'This action can only run after the USER themselves types the plain `/toolkit-reset` command (not you — custom ' +
      'commands cannot be invoked by the model), reviews the preview, and then types `/toolkit-reset confirm` within ' +
      '15 minutes. Do not retry this yourself — ask the user to run `/toolkit-reset` if they want to proceed.',
  },
}));
