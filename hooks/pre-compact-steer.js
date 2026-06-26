#!/usr/bin/env node
// PreCompact hook for qwen-code.
// Fires right before the engine compresses the conversation (auto at compressAt,
// or manual /compact). Injects steering so the summary keeps what matters and
// points at the durable disk copy. Output contract: JSON with
// hookSpecificOutput.additionalContext to stdout.
'use strict';
const fs = require('fs');
const path = require('path');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) {}
let trigger = '';
try { trigger = (JSON.parse(raw || '{}').trigger) || ''; } catch (_) {}

const file = path.join(process.cwd(), '.qwen', 'PROGRESS.md');
let hasDoc = false;
try { hasDoc = fs.statSync(file).isFile(); } catch (_) {}

const steer =
  'COMPACTION IN PROGRESS' + (trigger ? ' (' + trigger + ')' : '') + '. ' +
  'When you summarize, PRESERVE these verbatim and do not drop them: ' +
  '(1) the exact end goal and acceptance criteria; ' +
  '(2) every design decision and constraint already agreed; ' +
  '(3) the list of files created/edited and what each is for; ' +
  '(4) which tasks are DONE vs still TODO, in order; ' +
  '(5) any gotchas, blockers, or open questions. ' +
  'You may freely discard tool-call noise, raw file dumps, and abandoned dead ends — never discard the plan or the decisions. ' +
  (hasDoc
    ? 'A durable copy of this state lives in .qwen/PROGRESS.md; after compaction, re-read it to restore any lost detail.'
    : 'There is no durable checkpoint yet — consider writing one to .qwen/PROGRESS.md (the /checkpoint skill) so this state cannot be lost again.');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreCompact',
    additionalContext: steer,
  },
}));
