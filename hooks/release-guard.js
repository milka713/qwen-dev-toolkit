#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// PreToolUse hook — deterministic release-drift reminder (never blocks).
// The /release skill only runs when invoked, so it can be forgotten. This hook makes the
// check automatic: whenever the stable branch (main/master) is about to be pushed, it
// compares the project's VERSION against the git tags and, if the published release would
// lag the code, injects a NON-BLOCKING reminder to run /release (or /changelog then
// /release). It never blocks — tagging happens *after* the push — it only surfaces the drift
// so a fast, forgetful model can't ship a bumped VERSION that was never tagged/released.
// Output: hookSpecificOutput.additionalContext (allow + note), or exit 0 (silent, in sync).
'use strict';
try { if (require('./_hookutil.js').disabled('release-guard')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }
if ((input.tool_name || '') !== 'run_shell_command') process.exit(0);

const ti = input.tool_input || {};
const cmd = (ti.command || ti.cmd || '') + '';
if (!/\bgit\b[\s\S]*?\bpush\b/.test(cmd)) process.exit(0);   // only guard git push

// Resolve the working dir (honor `git -C <dir>`).
let dir = ti.directory || ti.cwd || process.cwd();
const cm = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
if (cm) dir = cm[1].replace(/^['"]|['"]$/g, '');

const git = (args) => {
  try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (_) { return ''; }
};

// Only speak when the push advances main/master (that is where a release should be cut).
const PROTECTED = /^(?:main|master)$/;
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const pushArgs = cmd.replace(/[\s\S]*?\bpush\b/, '');
const targetsProtected = /(?:^|[\s:/=])(?:refs\/heads\/)?(main|master)(?:[\s:]|$)/.test(pushArgs);
const positionals = pushArgs.split(/\s+/).filter((t) => t && !t.startsWith('-'));
const bareOnProtected = positionals.length < 2 && PROTECTED.test(branch); // `git push` while on main
if (!targetsProtected && !bareOnProtected) process.exit(0);

// Read the project version (VERSION file, else a "version" field).
function readVersion() {
  for (const f of ['VERSION', 'package.json', 'qwen-extension.json']) {
    try {
      const c = fs.readFileSync(path.join(dir, f), 'utf8');
      if (f === 'VERSION') { const v = c.trim().split(/\s+/)[0]; if (v) return v; }
      else { const m = c.match(/"version"\s*:\s*"([^"]+)"/); if (m) return m[1]; }
    } catch (_) { /* not present */ }
  }
  return '';
}
const V = readVersion();
if (!V) process.exit(0);                 // project doesn't track a version file — nothing to check

const tagExists = !!(git(['tag', '--list', 'v' + V]) || git(['tag', '--list', V]));
const latestTag = (git(['tag', '--sort=-v:refname']).split('\n').filter(Boolean)[0]) || 'none';

let note = '';
if (!tagExists) {
  note = `pushing ${branch} at VERSION ${V}, but no tag v${V} exists (latest tag: ${latestTag}). ` +
    `After the push, cut it with /release so the published GitHub Release doesn't lag the code (/release check to just verify).`;
} else {
  const ahead = git(['rev-list', `v${V}..HEAD`, '--count']) || git(['rev-list', `${V}..HEAD`, '--count']);
  if (ahead && ahead !== '0') {
    note = `${branch} is ${ahead} commit(s) past the released v${V} with no version bump. ` +
      `Run /changelog to bump the version, then /release — don't ship new code under an already-released tag.`;
  }
}
if (!note) process.exit(0);              // release is in step with the code — stay silent

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: '[toolkit] release-guard: ' + note,
  },
}));
