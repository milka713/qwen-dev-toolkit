#!/usr/bin/env node
// SessionStart hook for qwen-code.
// Re-injects the durable project state from .qwen/PROGRESS.md so the model recovers
// full context after a restart, /resume, /clear, or a lossy auto-compaction.
// (The development-mode flag does NOT need re-injecting — it is pinned as a block in
// the project's QWEN.md, which is loaded as system context every request and is never
// compacted. PROGRESS.md is re-injected here instead of pinned because it grows and
// would be costly to carry on every single request.)
// Output contract: print JSON with hookSpecificOutput.additionalContext to stdout.
'use strict';
try { if (require('./_hookutil.js').disabled('restore-progress')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');

// Drain stdin (hook input is JSON: { source, model, ... }). Best-effort.
let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) {}
let source = '';
try { source = (JSON.parse(raw || '{}').source) || ''; } catch (_) {}

let content = '';
try { content = fs.readFileSync(path.join(process.cwd(), '.qwen', 'PROGRESS.md'), 'utf8'); }
catch (_) { process.exit(0); } // no checkpoint here — nothing to restore
if (!content.trim()) process.exit(0);

const MAX = 12000; // cap injection so a huge doc can't itself eat the budget
if (content.length > MAX) {
  content = content.slice(0, MAX) + '\n\n…[truncated — open .qwen/PROGRESS.md for the full state]';
}

const lead =
  (source === 'compact'
    ? 'The conversation was just COMPACTED, so earlier detail may be lost. '
    : '') +
  'DURABLE PROJECT STATE loaded from .qwen/PROGRESS.md (ground truth for the goal, decisions, what is done, and what to do next; it survives compaction). Continue from the first unchecked task and do not redo finished work.';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: lead + '\n\n' + content,
  },
}));
