#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// PreToolUse hook for qwen-code — terminal-handoff guard.
// The /terminal skill hands a command to the user's own Terminal (via `open -a Terminal` or
// `osascript … do script`). That is only safe when the user is in the loop to confirm the
// exact command — but AUTO and YOLO approval modes auto-approve everything, so a destructive
// handoff (dd / format) could fire with no confirmation. This blocks the handoff in those two
// modes (the hook receives `permission_mode`), telling the model to switch to default and
// confirm. Any other command, and any mode other than auto/yolo, passes untouched.
// Output: deny via hookSpecificOutput.permissionDecision; otherwise exit 0 (allow).
'use strict';
try { if (require('./_hookutil.js').disabled('terminal-guard')) process.exit(0); } catch (_) {}
const fs = require('fs');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

if ((input.tool_name || '') !== 'run_shell_command') process.exit(0);

// Only the two modes that auto-approve without asking the user.
const mode = String(input.permission_mode || '').toLowerCase();
if (mode !== 'auto' && mode !== 'yolo') process.exit(0);

// Gather the command string(s) from tool_input (field name varies across builds).
const ti = input.tool_input || {};
const cmd = [ti.command, ti.commands, ti.script, ti.cmd]
  .filter((v) => typeof v === 'string').join('\n') || '';
if (!cmd) process.exit(0);

// Is this a terminal-handoff command (the two recipes the /terminal skill teaches, + keystroke)?
const isHandoff =
  /\bopen\b[^\n]*\s-a\s*["']?(Terminal|iTerm)\b/i.test(cmd) ||
  /\bopen\b[^\n]*\s-b\s*["']?com\.apple\.(Terminal|iTerm)/i.test(cmd) ||
  (/\bosascript\b/i.test(cmd) && /\bTerminal\b/i.test(cmd) &&
    /(do\s+script|keystroke|activate|tell\s+application)/i.test(cmd));
if (!isHandoff) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      '[toolkit] terminal-guard blocked this: the /terminal handoff is disabled in ' + mode +
      ' mode. In auto/yolo nothing is confirmed by the user, so a destructive handoff (dd, disk format, image flash) could run unchecked. Leave auto/yolo (Shift+Tab back to default approval mode), then hand the command to the user\'s Terminal there — show the exact command and get their explicit yes first. Do not route around this by another method.',
  },
}));
