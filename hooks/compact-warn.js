#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// SessionStart(source=compact) hook for qwen-code — compaction-efficiency warning +
// auto-disable. Fires right after a compaction. Reads the freshest chat_compression record
// from the session transcript (transcript_path in the hook input); if the compression
// reduced the history by LESS than 15%, the session has hit compaction saturation: what's
// left is mostly already-compressed summary, so each further auto-compaction burns a slow
// LLM call to free almost nothing — and on a reasoning model the summary can come back empty
// and hard-fail the turn. So on top of warning the model, this hook LATCHES auto-compaction
// OFF (sets context.autoCompactThreshold to 1 in ~/.qwen/settings.json, if it was enabled),
// so qwen-code stops trying to compact this dead-end context and the durable-checkpoint +
// fresh-session path takes over. Output contract: JSON with hookSpecificOutput.additionalContext
// to stdout; silent exit 0 in every other case (healthy compression, no record, any parse error).
'use strict';
try { if (require('./_hookutil.js').disabled('compact-warn')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');
const os = require('os');

const MIN_REDUCTION = 0.15;   // warn when a compaction frees less than this share
const AUTOCOMPACT_OFF = 1;    // threshold 1.0 = auto-compaction fires only at a full window (off)

// Latch auto-compaction OFF once it has proven ineffective for this session. Only writes if
// it was actually enabled (< 1), preserves every other settings key, and never throws.
// Returns true if it changed the setting (so the message can say so).
function disableAutoCompact() {
  try {
    const f = path.join(process.env.QWEN_HOME || path.join(os.homedir(), '.qwen'), 'settings.json');
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!s.context || typeof s.context.autoCompactThreshold !== 'number' || s.context.autoCompactThreshold >= AUTOCOMPACT_OFF) return false;
    s.context.autoCompactThreshold = AUTOCOMPACT_OFF;
    fs.writeFileSync(f, JSON.stringify(s, null, 2) + '\n');
    return true;
  } catch (_) { return false; }
}

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
  const turnedOff = disableAutoCompact(); // latch it off now that it's proven ineffective
  const ctx =
    `[toolkit] compaction warning: the compaction that just ran reduced this session's history by only ${pct}% ` +
    `(${orig} → ${next} tokens; anything under 15% means the context is mostly already-compressed summary). ` +
    `Compacting again would free almost nothing while costing a full model call, and on a reasoning model it can ` +
    `come back empty and hard-fail the turn. ` +
    (turnedOff
      ? `To prevent that, auto-compaction has been turned OFF for you (context.autoCompactThreshold set to 1). `
      : `Auto-compaction is already off (it only fires at a completely full window). `) +
    `Tell the user plainly, in your first reply: automatic compaction is no longer effective for this session; ` +
    `finish the current step and start a FRESH session — durable state is preserved in .qwen/PROGRESS.md ` +
    `(run /checkpoint first to update it, then a new session reloads it automatically).`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx },
  }));
  break;
}
process.exit(0);
