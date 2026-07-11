#!/usr/bin/env node
// /toolkit-reset backend — sweeps toolkit marker blocks left behind in the WRONG (global)
// scope by an older toolkit version. A toggle's scope has moved before (/bro: global in
// versions <1.8.0, project-local from 1.8.0 on) and left orphaned blocks that no current
// command manages anymore — e.g. a stale "/bro свобода" that keeps applying to every
// project even though /bro now only affects the current one.
//
// Pure local cleanup, no network — deliberately UNRELATED to /toolkit-update (which fetches
// a new release). Requires a real confirm step before it mutates anything:
//   1. /toolkit-reset            -> PREVIEW ONLY. Lists what would be removed, drops a
//                                    15-minute approval token, changes nothing.
//   2. /toolkit-reset confirm    -> performs the removal, but ONLY if a valid token exists.
// The token can only be created by a REAL slash-command invocation (custom commands are
// user-only — a model cannot invoke one itself), and the `toolkit-reset-guard` PreToolUse
// hook additionally denies any shell attempt to run the confirm step directly without a
// valid token — so the model cannot skip straight to "confirm" on its own initiative even
// via a raw shell call. Together this is the same "un-fakeable by the model" guarantee
// /main-push gives git releases, applied to this destructive-ish settings change.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const FILE = path.join(QHOME, 'QWEN.md');
const TOKEN = path.join(QHOME, '.toolkit-reset-approval');
const TTL_MS = 15 * 60 * 1000;
// Toggles that pin a "<!-- NAME:start -->...<!-- NAME:end -->" block into PROJECT QWEN.md
// today. Any of these found in the GLOBAL file is always a leftover — no live command
// manages it there.
const MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning'];

const arg = (process.argv[2] || '').trim().toLowerCase();
const out = (msg) => { console.log('TOOLKIT_RESET_RESULT: ' + msg); process.exit(0); };

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }

function findStale() {
  const body = read(FILE);
  return MARKERS.filter((m) => new RegExp('<!-- ' + m + ':start -->').test(body));
}

function tokenValid() {
  try { return Date.now() - fs.statSync(TOKEN).mtimeMs <= TTL_MS; } catch (_) { return false; }
}

if (arg === 'confirm') {
  if (!tokenValid()) {
    out('no pending approval (run /toolkit-reset first, with no arguments, to preview and start a 15-minute approval window — it must be a real slash command the user types, not something you run for them) — nothing changed.');
  }
  try { fs.unlinkSync(TOKEN); } catch (_) {}
  const stale = findStale(); // recompute fresh — the file may have changed since the preview
  if (!stale.length) out('nothing to reset (no stale global blocks found at confirm time) — nothing changed.');
  let body = read(FILE);
  for (const m of stale) {
    const re = new RegExp('\\n?<!-- ' + m + ':start -->[\\s\\S]*?<!-- ' + m + ':end -->\\n?', 'g');
    body = body.replace(re, '\n');
  }
  body = body.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
  fs.writeFileSync(FILE, body);
  out('removed stale global block(s) — ' + stale.join(', ') +
    ' (these are project-local now; re-apply per project with /bro, /cover, /dev, /maxagents, /versioning if you still want them there).');
}

if (arg === '' || arg === 'status' || arg === 'preview') {
  const stale = findStale();
  if (!stale.length) {
    try { fs.unlinkSync(TOKEN); } catch (_) {} // no point leaving a stale token armed
    out('nothing to reset — no stale global blocks found in ' + FILE + '.');
  }
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(TOKEN, '');
  out('PREVIEW — would remove from the global QWEN.md: ' + stale.join(', ') +
    '. Nothing has changed yet. A 15-minute approval window just opened; ask the user to confirm, ' +
    'then run /toolkit-reset confirm to actually remove them.');
}

out("usage - /toolkit-reset (preview) | /toolkit-reset confirm. Got: '" + arg + "'");
