#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// [toolkit] PostToolUse companion to git-branch-guard — consumes the single-use /main-push
// token, but ONLY when a push to main/master has actually SUCCEEDED. (This hook is silent; it
// never writes to stdout — the [toolkit] tag lives here so tooling can attribute the file.)
//
// Why this exists: git-branch-guard (PreToolUse) authorizes a main push while the token is
// present, but must NOT consume it there — a PreToolUse guard fires before the command runs,
// so consuming at that point burns the authorization even when the push is then blocked by
// the Auto-Mode classifier, fails on auth, or aborts because an earlier segment errored
// (`git switch main` on a branch that doesn't exist yet). That is exactly the failure the
// user hit: /main-push looked "already consumed" while no push had landed. So consumption is
// moved here, keyed on the OUTCOME: we look at tool_response, and only when a main-targeting
// push exited 0 do we delete ~/.qwen/.main-approval. Blocked/failed attempts leave it intact,
// so the model can fix the error and retry under the same authorization. A bare merge/rebase
// never matches (no push) and so never consumes — one /main-push still covers "merge → push".
'use strict';
try { if (require('./_hookutil.js').disabled('main-push-consume')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }
if ((input.tool_name || '') !== 'run_shell_command') process.exit(0);

const ti = input.tool_input || {};
const cmd = (ti.command || ti.cmd || '') + '';
if (!/\bgit\b[\s\S]*?\bpush\b/.test(cmd)) process.exit(0); // only a push can consume the token

// --- Did this command push to main/master? (mirror git-branch-guard's detection) ---
const PROTECTED = /^(?:main|master)$/;
const hasProtectedWord = (s) => /(?:^|[\s:/=])(?:refs\/heads\/)?(main|master)(?:[\s:]|$)/.test(s);
function currentBranch() {
  let dir = ti.directory || ti.cwd || process.cwd();
  const cm = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
  if (cm) dir = cm[1].replace(/^['"]|['"]$/g, '');
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) { return ''; }
}
let pushesToProtected = false;
for (const seg of cmd.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean)) {
  const push = seg.match(/\bgit\b[\s\S]*?\bpush\b([\s\S]*)$/);
  if (!push) continue;
  const args = push[1];
  if (hasProtectedWord(args)) { pushesToProtected = true; break; }
  const positionals = args.split(/\s+/).filter((t) => t && !t.startsWith('-'));
  if (positionals.length < 2 && PROTECTED.test(currentBranch())) { pushesToProtected = true; break; }
}
// A one-liner that switches onto main and then pushes (bare push lands on main).
if (!pushesToProtected &&
    /\bgit\s+(?:checkout|switch)\s+(?:-\S+\s+)*(main|master)\b/.test(cmd) &&
    /\bgit\b[\s\S]*?\bpush\b/.test(cmd)) pushesToProtected = true;
if (!pushesToProtected) process.exit(0);

// --- Did it SUCCEED? Prefer the shell's exit code; fall back to failure markers. ---
function succeeded(resp) {
  if (resp == null) return false;
  const s = typeof resp === 'string' ? resp : (() => { try { return JSON.stringify(resp); } catch (_) { return String(resp); } })();
  const m = s.match(/Exit Code:\s*(-?\d+)/i);
  if (m) return m[1] === '0';
  if (typeof resp === 'object') {
    if (typeof resp.exitCode === 'number') return resp.exitCode === 0;
    if (typeof resp.exit_code === 'number') return resp.exit_code === 0;
    if (resp.error && !resp.output && !resp.stdout) return false;
  }
  // No exit code visible — treat unmistakable git-push failures as not-success.
  if (/(?:^|\n)fatal:|\brejected\b|!\s*\[remote|Permission denied|Could not read from remote|Updates were rejected/i.test(s)) return false;
  return true; // looks like it went through
}
if (!succeeded(input.tool_response)) process.exit(0); // failed/blocked — keep the authorization

// --- Consume the token (if a fresh one is present). ---
const QHOME = process.env.QWEN_HOME || path.join(process.env.HOME || require('os').homedir(), '.qwen');
const TOKEN = path.join(QHOME, '.main-approval');
try { fs.unlinkSync(TOKEN); } catch (_) { /* nothing to consume */ }
process.exit(0);
