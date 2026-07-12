#!/usr/bin/env node
// Deterministic concurrent-subagent cap. qwen-code has no native setting for this, so we
// enforce it at the hook layer: a counter of currently-running `agent` subagents, gated
// by a hard limit. The limit N is read from the project QWEN.md "at most N at a time"
// block written by /maxagents (no block = no limit). This is a real cap — agent launches
// beyond N are DENIED at PreToolUse, not merely discouraged.
//
// Modes (passed as argv[2]):
//   pre   — PreToolUse on `agent`: if running >= N, deny; else increment (allow).
//   post  — PostToolUse on `agent`: decrement (a launched agent finished).
//   reset — SessionStart: clear the counter (avoid leaks across sessions).
'use strict';
try { if (require('./_hookutil.js').disabled('agent-limit-' + (process.argv[2] || ''))) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'pre';
const qdir = path.join(process.cwd(), '.qwen');
const countFile = path.join(qdir, '.agentcount');
const lockDir = path.join(qdir, '.agentcount.lock');

// Drain stdin (hook JSON) so the process doesn't block; we don't need its body except to
// be polite about exit.
try { fs.readFileSync(0, 'utf8'); } catch (_) {}

function readCap() {
  // Single source of truth: the "Subagent limit — at most N at a time" line in project QWEN.md.
  try {
    const q = fs.readFileSync(path.join(process.cwd(), 'QWEN.md'), 'utf8');
    const m = q.match(/at most\s+(\d+)\s+at a time/i);
    if (m) { const n = parseInt(m[1], 10); if (n >= 1) return n; }
  } catch (_) {}
  return 0; // no cap
}

function withLock(fn) {
  // Atomic lock via mkdir; serializes concurrent hook processes from one turn.
  for (let i = 0; i < 200; i++) {
    try { fs.mkdirSync(lockDir); break; }
    catch (_) {
      // Steal a stale lock left by a crashed hook process, else it lives forever
      // and every later call spins the full timeout and runs unserialized.
      try { if (Date.now() - fs.statSync(lockDir).mtimeMs > 10000) { fs.rmdirSync(lockDir); continue; } } catch (_) {}
      const until = Date.now() + 5; while (Date.now() < until) {}
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(lockDir); } catch (_) {} }
}

function readCount() { try { return Math.max(0, parseInt(fs.readFileSync(countFile, 'utf8'), 10) || 0); } catch (_) { return 0; } }
function writeCount(n) { try { fs.mkdirSync(qdir, { recursive: true }); fs.writeFileSync(countFile, String(Math.max(0, n))); } catch (_) {} }

if (mode === 'reset') { try { fs.mkdirSync(qdir, { recursive: true }); } catch (_) {} writeCount(0); process.exit(0); }

if (mode === 'post') { withLock(() => writeCount(readCount() - 1)); process.exit(0); }

// mode === 'pre'
const cap = readCap();
if (cap <= 0) process.exit(0); // no limit configured → allow

const decision = withLock(() => {
  const running = readCount();
  if (running >= cap) return { deny: true, running };
  writeCount(running + 1); // reserve a slot
  return { deny: false, running: running + 1 };
});

if (!decision.deny) process.exit(0); // allowed

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `Subagent limit reached: at most ${cap} subagent(s) may run at once in this project (set via /maxagents), and ${decision.running} ` +
      `is/are already running. Do NOT launch this subagent now — wait for a running one to finish, then launch the next. ` +
      `Run them sequentially (or in batches of ${cap}) rather than all at once.`,
  },
}));
