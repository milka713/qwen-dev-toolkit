#!/usr/bin/env node
// /toolkit-reset backend — bring the toolkit back to the shape the CURRENT version implies
// by default, for the chosen scope. It removes the toolkit's toggle marker blocks and (for
// the global scope) resets the toolkit-managed settings to their defaults.
//
//   /toolkit-reset            -> PROJECT scope preview (this project's ./QWEN.md)
//   /toolkit-reset project    -> same, explicit
//   /toolkit-reset global     -> GLOBAL scope preview (~/.qwen: QWEN.md + settings)
//   /toolkit-reset confirm    -> perform the previewed reset (uses the previewed scope)
//
// Scope:
//   project -> remove the toggle blocks (dev/cover/bro/maxagents/versioning/reality) from the
//              current project's ./QWEN.md. Turns the project's per-project modes back to
//              default (off / semantic). Does NOT touch global settings.
//   global  -> remove those blocks from ~/.qwen/QWEN.md (stale drift a toggle left behind),
//              AND reset the toolkit's global settings to the current defaults: re-enable all
//              hooks (clear ~/.qwen/.hooks-disabled) and set context.autoCompactThreshold back
//              to the default (auto-compaction OFF).
//
// Pure local cleanup, no network — deliberately UNRELATED to /toolkit-update. Requires a real
// confirm step before it mutates anything:
//   1. preview -> lists what WOULD change, drops a 15-minute approval token (with the scope), nothing changes.
//   2. confirm -> applies it, ONLY if a valid token exists.
// The token can only be created by a REAL slash-command invocation (user-only), and the
// `toolkit-reset-guard` PreToolUse hook additionally denies any raw shell attempt to run the
// confirm step without a valid token — so the model cannot skip straight to "confirm".
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const GLOBAL_FILE = path.join(QHOME, 'QWEN.md');
const PROJECT_FILE = 'QWEN.md'; // relative to the cwd the command runs in
const SETTINGS = path.join(QHOME, 'settings.json');
const HOOKS_DISABLED = path.join(QHOME, '.hooks-disabled');
const TOKEN = path.join(QHOME, '.toolkit-reset-approval');
const TTL_MS = 15 * 60 * 1000;
const DEFAULT_AUTOCOMPACT = 1; // current default: auto-compaction OFF
// Toggle blocks pinned into a QWEN.md by /dev, /cover, /bro, /maxagents, /versioning, /reality.
const MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning', 'realitymode'];

const argv = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean);
const isConfirm = argv.includes('confirm');
const scopeArg = argv.includes('global') ? 'global' : argv.includes('project') ? 'project' : null;
const out = (msg) => { console.log('TOOLKIT_RESET_RESULT: ' + msg); process.exit(0); };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };

function qwenFileFor(scope) { return scope === 'global' ? GLOBAL_FILE : PROJECT_FILE; }
function staleBlocks(scope) {
  const body = read(qwenFileFor(scope));
  return MARKERS.filter((m) => new RegExp('<!-- ' + m + ':start -->').test(body));
}
function disabledHooks() {
  return read(HOOKS_DISABLED).split('\n').map((s) => s.trim()).filter(Boolean);
}
function autoCompactNeedsReset() {
  try {
    const s = JSON.parse(read(SETTINGS) || '{}');
    return s.context && s.context.autoCompactThreshold !== undefined && s.context.autoCompactThreshold !== DEFAULT_AUTOCOMPACT;
  } catch (_) { return false; }
}

// Human-readable list of pending changes for a scope; empty array = nothing to reset.
function changes(scope) {
  const list = [];
  const blocks = staleBlocks(scope);
  if (blocks.length) list.push('remove toggle block(s) from ' + (scope === 'global' ? 'the global' : "this project's") + ' QWEN.md: ' + blocks.join(', '));
  if (scope === 'global') {
    const dh = disabledHooks();
    if (dh.length) list.push('re-enable ' + dh.length + ' disabled hook(s) (clear .hooks-disabled): ' + dh.join(', '));
    if (autoCompactNeedsReset()) list.push('reset context.autoCompactThreshold to the default (' + DEFAULT_AUTOCOMPACT + ', auto-compaction OFF)');
  }
  return list;
}

function applyReset(scope) {
  // 1) strip the toggle blocks from the scope's QWEN.md
  const file = qwenFileFor(scope);
  const blocks = staleBlocks(scope);
  if (blocks.length) {
    let body = read(file);
    for (const m of blocks) {
      const re = new RegExp('\\n?<!-- ' + m + ':start -->[\\s\\S]*?<!-- ' + m + ':end -->\\n?', 'g');
      body = body.replace(re, '\n');
    }
    fs.writeFileSync(file, body.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, ''));
  }
  // 2) global scope only: reset toolkit-managed settings to defaults
  if (scope === 'global') {
    try { fs.unlinkSync(HOOKS_DISABLED); } catch (_) {} // re-enable all hooks
    try {
      const s = JSON.parse(read(SETTINGS) || '{}');
      if (s.context && s.context.autoCompactThreshold !== undefined) {
        s.context.autoCompactThreshold = DEFAULT_AUTOCOMPACT;
        fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
      }
    } catch (_) { /* settings unreadable/absent — leave it */ }
  }
}

function tokenScope() {
  try {
    if (Date.now() - fs.statSync(TOKEN).mtimeMs > TTL_MS) return null;
    const s = read(TOKEN).trim();
    return s === 'global' ? 'global' : 'project';
  } catch (_) { return null; }
}

if (isConfirm) {
  const scope = tokenScope();
  if (!scope) {
    out('no pending approval (run /toolkit-reset [project|global] first, with no confirm, to preview and open a 15-minute approval window — it must be a real slash command the user types, not something you run for them) — nothing changed.');
  }
  try { fs.unlinkSync(TOKEN); } catch (_) {}
  const pending = changes(scope); // recompute fresh — state may have changed since preview
  if (!pending.length) out('nothing to reset for the ' + scope + ' scope at confirm time — nothing changed.');
  applyReset(scope);
  out('reset done (' + scope + ' scope): ' + pending.join('; ') + '.' +
    (scope === 'global' ? ' Restart qwen-code / start a new session for the settings changes to take effect.' : ''));
}

if (!isConfirm) {
  const scope = scopeArg || 'project';
  const pending = changes(scope);
  if (!pending.length) {
    try { fs.unlinkSync(TOKEN); } catch (_) {}
    out('nothing to reset — the ' + scope + ' scope already matches the current version\'s defaults.');
  }
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(TOKEN, scope);
  out('PREVIEW (' + scope + ' scope) — ⚠ WARNING: this RESETS the ' + scope +
    ' toolkit state to the current version\'s defaults; your current toggles/settings in this scope will be LOST and it is not auto-reversible. It would: ' + pending.join('; ') +
    '. NOTHING has changed yet. A 15-minute approval window opened for the ' + scope +
    ' scope. You MUST warn the user this is destructive and ASK them to confirm ("точно сбросить до значений по умолчанию?") — for BOTH project and global — and only if they say yes, they themselves run /toolkit-reset confirm.');
}
