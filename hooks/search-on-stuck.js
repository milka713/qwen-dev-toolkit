#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
//
// Breaks the thrashing loop: after two failed attempts in a row, tell the model to STOP
// guessing and go find information. The `/research` skill already says this, but a small
// model reads it once at session start and then, mid-fight with a red build, keeps trying
// variations — the reminder has to arrive at the moment of the failure, not before it.
//
// Why PostToolUseFailure: verified against qwen-code 0.21.10 on a real session — a shell
// command exiting non-zero fires PostToolUseFailure (NOT PostToolUse), and its `error`
// field carries the full "Command / Output / Exit Code" text. So a red test run, a failed
// build and a rejected edit all land here.
//
// Modes (argv[2]):
//   fail  — PostToolUseFailure on the "attempt" tools: count it, and from the 2nd
//           consecutive failure on, inject the search directive.
//   ok    — PostToolUse on the same tools: an attempt worked, so we are not stuck — reset.
//   reset — SessionStart: clear the counter so it never leaks across sessions.
'use strict';
try { if (require('./_hookutil.js').disabled('search-on-stuck')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'fail';
const stateFile = path.join(process.cwd(), '.qwen', '.stuckcount');
const STALE_MS = 2 * 60 * 60 * 1000; // an hour-old streak is not "in a row" any more

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { payload = {}; }

const read = () => {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!s || typeof s.n !== 'number') return { n: 0 };
    if (Date.now() - (s.at || 0) > STALE_MS) return { n: 0 };
    return s;
  } catch (_) { return { n: 0 }; }
};
const write = (s) => {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(s));
  } catch (_) {}
};

if (mode === 'reset') { try { fs.unlinkSync(stateFile); } catch (_) {} process.exit(0); }
if (mode === 'ok') { write({ n: 0, at: Date.now() }); process.exit(0); }

// --- fail ---------------------------------------------------------------------------
// A user interrupt is not a failed attempt — counting it would nag for pressing Esc.
if (payload.is_interrupt) process.exit(0);

const st = read();
const n = st.n + 1;
write({ n, at: Date.now() });
if (n < 2) process.exit(0);  // one failure is normal work; two in a row is a pattern

// Give the model the exact string worth searching: the first real line of the tool's
// output, not the whole "Command/Directory/Output/Exit Code" envelope.
const errRaw = typeof payload.error === 'string' ? payload.error : '';
let snippet = '';
const m = errRaw.match(/Output:\s*([^\n]{4,160})/) || errRaw.match(/Error:\s*(?!\(none\))([^\n]{4,160})/);
if (m) snippet = m[1].trim();
else snippet = errRaw.split('\n').find((l) => l.trim().length > 3) || '';
snippet = snippet.replace(/\s+/g, ' ').slice(0, 160);

const what = payload.tool_name === 'run_shell_command'
  ? (payload.tool_input && payload.tool_input.command ? String(payload.tool_input.command).slice(0, 120) : 'a shell command')
  : (payload.tool_name || 'an edit');

const head = n === 2
  ? `${n} attempts in a row have now failed.`
  : `${n} attempts in a row have now failed — you are in the loop this rule exists to stop.`;

const msg =
  `[toolkit] ${head} Last failure: \`${what}\`` + (snippet ? ` → "${snippet}"` : '') + '. ' +
  'Do NOT try another variation of the same fix. Follow the `/research` skill now: ' +
  '(1) look at the real current state — the exact error text, the config, the version actually installed; ' +
  '(2) search the web for the distinctive part of that error verbatim — MCP search is exposed prefixed, ' +
  'so use any tool ending in `_web_search` (e.g. `mcp__searxng__searxng_web_search`), then read the ' +
  'authoritative hit with `web_fetch` / `mcp__searxng__web_url_read`; ' +
  '(3) only then attempt a fix, and say what new information makes this attempt different. ' +
  'If you genuinely already know the cause, state it explicitly instead of guessing again.';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PostToolUseFailure', additionalContext: msg },
}));
