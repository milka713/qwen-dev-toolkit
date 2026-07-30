#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
// /toolkit-reset backend — bring the toolkit back to the shape the CURRENT version implies
// by default, for the chosen scope. It removes the toolkit's toggle marker blocks and (for
// the global scope) resets the toolkit-managed settings to their defaults.
//
//   /toolkit-reset            -> PROJECT scope preview (this project's ./QWEN.md)
//   /toolkit-reset project    -> same, explicit
//   /toolkit-reset global     -> GLOBAL scope preview (~/.qwen: QWEN.md + settings)
//   /toolkit-reset confirm    -> perform the previewed reset (uses the previewed scope)
//   /toolkit-reset undo       -> restore the pre-reset state from the last confirm (one level)
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
const BACKUP = path.join(QHOME, '.toolkit-reset-backup'); // one-level undo snapshot (JSON)
const TTL_MS = 15 * 60 * 1000;
const DEFAULT_AUTOCOMPACT = 1; // current default: auto-compaction OFF
// Toggle blocks pinned into a QWEN.md by /dev, /cover, /bro, /maxagents, /versioning, /reality.
const MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning', 'realitymode', 'realityoff', 'researchoff', 'sudomode'];

const argv = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean);
const isConfirm = argv.includes('confirm');
const isUndo = argv.includes('undo') || argv.includes('откат') || argv.includes('отмена');
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

// Snapshot everything this reset is about to change, so `/toolkit-reset undo` can restore
// it. One level deep: a new reset overwrites the previous snapshot.
function writeBackup(scope) {
  const file = path.resolve(qwenFileFor(scope));
  const snap = { scope, ts: Date.now(), qwenFile: file, qwenBefore: exists0(file) ? read(file) : null };
  if (scope === 'global') {
    snap.hooksDisabledBefore = exists0(HOOKS_DISABLED) ? read(HOOKS_DISABLED) : null;
    try { const s = JSON.parse(read(SETTINGS) || '{}'); snap.autoCompactBefore = s.context ? s.context.autoCompactThreshold : undefined; }
    catch (_) { snap.autoCompactBefore = undefined; }
  }
  try { fs.writeFileSync(BACKUP, JSON.stringify(snap)); } catch (_) {}
}
function exists0(p) { try { fs.statSync(p); return true; } catch (_) { return false; } }

function applyReset(scope) {
  writeBackup(scope); // capture BEFORE we mutate anything
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

if (isUndo) {
  let snap;
  try { snap = JSON.parse(read(BACKUP)); } catch (_) { snap = null; }
  if (!snap) out('nothing to undo — no reset has been applied since the last undo (a backup is written only when /toolkit-reset confirm actually changes something).');
  const restored = [];
  if (snap.qwenBefore != null) { try { fs.writeFileSync(snap.qwenFile, snap.qwenBefore); restored.push('restored the ' + snap.scope + " scope's QWEN.md (toggle blocks back)"); } catch (_) { out('undo failed: could not write ' + snap.qwenFile + ' (are you in the same project you reset?).'); } }
  if (snap.scope === 'global') {
    if (snap.hooksDisabledBefore != null) { try { fs.writeFileSync(HOOKS_DISABLED, snap.hooksDisabledBefore); restored.push('restored .hooks-disabled'); } catch (_) {} }
    else { try { fs.unlinkSync(HOOKS_DISABLED); } catch (_) {} } // was absent before → keep it absent
    if (snap.autoCompactBefore !== undefined) {
      try { const s = JSON.parse(read(SETTINGS) || '{}'); s.context = s.context || {}; s.context.autoCompactThreshold = snap.autoCompactBefore; fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n'); restored.push('restored autoCompactThreshold to ' + snap.autoCompactBefore); }
      catch (_) {}
    }
  }
  try { fs.unlinkSync(BACKUP); } catch (_) {} // one-level undo — consume it
  out('undo done (' + snap.scope + ' scope): ' + (restored.length ? restored.join('; ') : 'nothing needed restoring') + '.' +
    (snap.scope === 'global' ? ' Restart qwen-code / start a new session for settings changes to take effect.' : ''));
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
    ' toolkit state to the current version\'s defaults; your current toggles/settings in this scope will be replaced. It would: ' + pending.join('; ') +
    '. NOTHING has changed yet. A 15-minute approval window opened for the ' + scope +
    ' scope. You MUST warn the user this is destructive and ASK them to confirm ("точно сбросить до значений по умолчанию?") — for BOTH project and global — and only if they say yes, they themselves run /toolkit-reset confirm. (It is reversible: /toolkit-reset undo restores the pre-reset state one level back.)');
}
