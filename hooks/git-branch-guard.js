#!/usr/bin/env node
// PreToolUse hook for qwen-code — deterministic branch-flow guard.
// Enforces the toolkit's git discipline at the engine level instead of trusting a small
// model to remember it: new work goes to `dev`; the protected branches (main/master) are
// touched by an OUTWARD/irreversible action (push to main, or merge into main) ONLY when
// the user has explicitly authorized it via `/main-push` (which drops a single-use token).
//
// Blocks, on run_shell_command:
//   - `git push` that targets main/master (explicit `origin main`, `HEAD:main`, `:main`,
//     `refs/heads/main`, `--delete ... main`, force-push to main, …)
//   - `git push` with no explicit branch while the CURRENT branch is main/master
//   - `git merge` / `git rebase` while checked out ON main/master
//   - a one-liner that switches to main/master and then merges/pushes
// Allows everything else (all pushes to dev/feature branches, all read-only git, and any
// main operation once `/main-push` has authorized it). The token is SINGLE-USE: a push to
// main/master CONSUMES it (so a second push needs a fresh `/main-push`); a bare merge/rebase
// onto main does NOT consume it, so one authorization still covers "merge dev then push".
'use strict';
try { if (require('./_hookutil.js').disabled('git-branch-guard')) process.exit(0); } catch (_) {}
const fs = require('fs');
const { execFileSync } = require('child_process');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

if ((input.tool_name || '') !== 'run_shell_command') process.exit(0);

const ti = input.tool_input || {};
const cmd = (ti.command || ti.cmd || '') + '';
if (!cmd || !/\bgit\b/.test(cmd)) process.exit(0);

const PROTECTED = /^(?:main|master)$/;
const hasProtectedWord = (s) => /(?:^|[\s:/=])(?:refs\/heads\/)?(main|master)(?:[\s:]|$)/.test(s);

// Resolve the directory the command would run in, then the current branch there.
function currentBranch() {
  let dir = ti.directory || ti.cwd || process.cwd();
  const cm = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
  if (cm) dir = cm[1].replace(/^['"]|['"]$/g, '');
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) { return ''; }
}

// Split the compound command on separators so we can reason per-segment.
const segments = cmd.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean);

let reason = null;

for (const seg of segments) {
  // --- git push segments ---
  const push = seg.match(/\bgit\b[\s\S]*?\bpush\b([\s\S]*)$/);
  if (push) {
    const args = push[1];
    if (hasProtectedWord(args)) { reason = 'a push that targets the protected branch (main/master)'; break; }
    // No explicit branch given -> depends on the current branch.
    const positionals = args.split(/\s+/).filter((t) => t && !t.startsWith('-'));
    // positionals[0] is the remote (e.g. origin); positionals[1..] would be refspecs.
    const hasExplicitBranch = positionals.length >= 2;
    if (!hasExplicitBranch) {
      const br = currentBranch();
      if (PROTECTED.test(br)) { reason = 'a push of the current branch while you are ON ' + br + ' (a push to main/master)'; break; }
    }
    continue;
  }
  // --- git merge / rebase while ON a protected branch ---
  if (/\bgit\b[\s\S]*?\b(merge|rebase)\b/.test(seg)) {
    const br = currentBranch();
    if (PROTECTED.test(br)) { reason = 'a ' + (seg.match(/\b(merge|rebase)\b/)[1]) + ' while you are ON ' + br + ' (this changes main/master directly)'; break; }
  }
}

// A switch-to-protected followed by a merge/push in the same one-liner (deploy sequence),
// which the per-segment current-branch check can miss (branch changes mid-command).
if (!reason &&
    /\bgit\s+(?:checkout|switch)\s+(?:-\S+\s+)*(main|master)\b/.test(cmd) &&
    /\bgit\b[\s\S]*?\b(?:merge|rebase|push)\b/.test(cmd)) {
  reason = 'switching to main/master and then merging/pushing (a release into the protected branch)';
}

if (!reason) process.exit(0); // allow

// Explicit user authorization? /main-push drops a SINGLE-USE token: it authorizes exactly
// one push to main/master. A push CONSUMES the token here (so a second push needs a fresh
// /main-push); a bare merge/rebase onto main does NOT consume it, so one authorization still
// covers the "merge dev → push" release. The TTL only expires an UNUSED token (a staleness
// guard so a forgotten authorization can't be used much later) — it is not a multi-push window.
const path = require('path');
const QHOME = process.env.QWEN_HOME || path.join(process.env.HOME || require('os').homedir(), '.qwen');
const TOKEN = path.join(QHOME, '.main-approval');
const TTL_MS = 15 * 60 * 1000;
try {
  const st = fs.statSync(TOKEN);
  if (Date.now() - st.mtimeMs <= TTL_MS) {
    // consume on the push (the outward, irreversible act); leave it for a bare merge/rebase.
    if (/\bgit\b[\s\S]*?\bpush\b/.test(cmd)) { try { fs.unlinkSync(TOKEN); } catch (_) {} }
    process.exit(0); // authorized — allow
  }
  try { fs.unlinkSync(TOKEN); } catch (_) {} // stale — drop it
} catch (_) { /* no token */ }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'qwen-dev-toolkit git-flow guard blocked this: it is ' + reason + '. Policy: all new work goes to the `dev` branch; `main`/`master` is only updated on the user\'s EXPLICIT approval. ' +
      'What to do instead: commit/push to `dev` (create it from the current work if it does not exist: `git switch -c dev` then push `dev`). ' +
      'If — and only if — the user has explicitly told you to release to main, do NOT retry this command yourself; ask the user to run `/main-push` first (it authorizes exactly ONE push to main — single-use — which also covers the merge before it), then repeat the command.',
  },
}));
