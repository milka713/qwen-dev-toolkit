#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// Stop hook for qwen-code — durable-checkpoint freshness guard.
// The toolkit's whole compaction-survival story rests on .qwen/PROGRESS.md being kept
// current (its checkboxes are the anchor a post-compaction/restarted session continues
// from). But that update depends on the model's discipline — exactly what a small local
// model is unreliable at. This hook closes that gap deterministically: when a turn is about
// to end and PROGRESS.md has drifted (code was edited AFTER the checkpoint was last written,
// and it still has unchecked tasks), it BLOCKS the stop ONCE to make the model tick the
// finished boxes / update the notes before ending. It is loop-safe (stop_hook_active guards
// re-entry, so at most one extra turn) and self-resolving (updating PROGRESS.md makes the
// drift disappear). No PROGRESS.md ⇒ no active plan ⇒ always silent.
'use strict';
try { if (require('./_hookutil.js').disabled('checkpoint-nudge')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');

let evt = {};
try { evt = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

// Already nudged this turn (we're in the continuation we forced) — never block twice.
if (evt.stop_hook_active === true) process.exit(0);

const cwd = evt.cwd || process.cwd();
const progress = path.join(cwd, '.qwen', 'PROGRESS.md');

// --- proactive context-fill guard -------------------------------------------
// qwen-code 0.20.x sends context_usage (ratio of window used) on Stop. When the window is
// nearly full, the NEXT turn risks tipping into an auto-compaction that, on a reasoning
// model, can come back empty and hard-fail the turn — the exact failure this is meant to
// pre-empt. So before the window fills, hold the turn once to force the durable-checkpoint
// + fresh-session path (the only thing that actually survives a full window). Degrades to
// silent on older qwen-code that doesn't send the field. Loop-safe (stop_hook_active above).
const FULL = 0.88; // fraction of the context window at which we insist on checkpointing
const usage = evt.context_usage;
if (typeof usage === 'number' && isFinite(usage) && usage >= FULL) {
  const pct = Math.round(usage * 100);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      '[toolkit] context-fill guard: the context window is ~' + pct + '% full. Do NOT keep going and let it fill — ' +
      'a full window forces an auto-compaction that can come back empty and hard-fail the session. Instead, right now: ' +
      'run /checkpoint to save the goal/decisions/done-todo to .qwen/PROGRESS.md, then tell the user to start a FRESH ' +
      'session (a new session reloads PROGRESS.md automatically and continues from the next unchecked task). Do this ' +
      'before doing more work.',
  }));
  process.exit(0);
}

let pStat, body;
try { pStat = fs.statSync(progress); body = fs.readFileSync(progress, 'utf8'); }
catch (_) { process.exit(0); } // no checkpoint here — nothing to keep fresh

// Nothing left to do ⇒ don't nag (the plan is complete or has no task list).
const remaining = (body.match(/^\s*- \[ \]/gm) || []).length;
if (remaining === 0) process.exit(0);

// Has any source file been edited AFTER the checkpoint was last written? Walk the working
// tree shallowly (skip vcs/deps/build and the .qwen dir itself), stop early once we find a
// newer file, and cap the work so a huge tree can't stall the turn.
const GRACE_MS = 45 * 1000;                 // small edits right before /checkpoint are fine
const cutoff = pStat.mtimeMs + GRACE_MS;
const SKIP = new Set(['.git', '.qwen', 'node_modules', 'dist', 'build', '.next', '.venv', 'venv', '__pycache__', 'target', 'vendor', '.idea', '.cache', 'coverage']);
const CODE = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|rb|java|kt|c|h|cpp|cc|hpp|cs|php|swift|sh|sql|json|ya?ml|toml|md|html|css|scss|vue|svelte)$/i;
let budget = 4000; // max entries to stat before giving up (keeps the hook fast)

function drifted(dir, depth) {
  if (depth > 6 || budget <= 0) return false;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return false; }
  for (const e of entries) {
    if (budget-- <= 0) return false;
    const name = e.name;
    if (name.startsWith('.') && name !== '.gitignore') { if (SKIP.has(name)) continue; }
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (e.isDirectory()) { if (drifted(full, depth + 1)) return true; continue; }
    if (!e.isFile() || !CODE.test(name)) continue;
    try { if (fs.statSync(full).mtimeMs > cutoff) return true; } catch (_) {}
  }
  return false;
}

if (!drifted(cwd, 0)) process.exit(0); // checkpoint is at least as fresh as the code — fine

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason:
    '[toolkit] checkpoint-nudge: source files were edited after .qwen/PROGRESS.md was last ' +
    'updated, and it still has ' + remaining + ' unchecked task(s). Before you stop: update ' +
    '.qwen/PROGRESS.md — tick each task you actually finished (`- [ ]` → `- [x]`) and adjust the ' +
    'notes / next-step so a compaction or restart continues correctly (its checkboxes are the ' +
    'anchor a recovered session resumes from). If nothing is actually done yet, that is fine — ' +
    'just note current progress. Then finish. (Run /checkpoint for a fuller save.)',
}));
