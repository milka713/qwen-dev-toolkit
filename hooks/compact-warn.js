#!/usr/bin/env node
// SessionStart(source=compact) hook for qwen-code — compaction-efficiency warning.
// Fires right after a compaction. Reads the freshest chat_compression record from the
// session transcript (transcript_path in the hook input); if the compression reduced
// the history by LESS than 15%, the session has hit compaction saturation: what's left
// is mostly already-compressed summary, so each further auto-compaction burns a slow
// LLM call to free almost nothing. Injects a warning telling the model to say so to
// the user and suggest wrapping up in a fresh session (PROGRESS.md carries the state).
// Output contract: JSON with hookSpecificOutput.additionalContext to stdout; silent
// exit 0 in every other case (healthy compression, no record, any parse error).
'use strict';
try { if (require('./_hookutil.js').disabled('compact-warn')) process.exit(0); } catch (_) {}
const fs = require('fs');

const MIN_REDUCTION = 0.15; // warn when a compaction frees less than this share

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) {}
let evt = {};
try { evt = JSON.parse(raw || '{}'); } catch (_) {}

// Belt over the settings matcher: only act right after a compaction.
if (evt.source && evt.source !== 'compact') process.exit(0);

const transcript = evt.transcript_path;
if (!transcript || !fs.existsSync(transcript)) process.exit(0);

let lines;
try { lines = fs.readFileSync(transcript, 'utf8').trim().split('\n'); } catch (_) { process.exit(0); }

for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i].includes('"chat_compression"')) continue;
  let rec;
  try { rec = JSON.parse(lines[i]); } catch (_) { break; }
  const info = rec && rec.systemPayload && rec.systemPayload.info;
  const orig = info && info.originalTokenCount;
  const next = info && info.newTokenCount;
  if (!orig || !next || orig <= 0) break;
  const reduction = 1 - next / orig;
  if (reduction >= MIN_REDUCTION) break; // healthy compression — stay silent
  const pct = Math.max(0, Math.round(reduction * 100));
  const ctx =
    `⚠️ COMPACTION SATURATION: the compaction that just ran reduced this session's history by only ${pct}% ` +
    `(${orig} → ${next} tokens; anything under 15% means the context is mostly already-compressed summary). ` +
    `Compacting this session again will free almost nothing while costing a full model call. ` +
    `Tell the user plainly, in your first reply: automatic compaction is no longer effective for this session; ` +
    `recommend finishing the current step and starting a fresh session — durable state is preserved in ` +
    `.qwen/PROGRESS.md (run /checkpoint first to update it).`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx },
  }));
  break;
}
process.exit(0);
