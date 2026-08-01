#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /classifier-window — set the fast-model permission-classifier transcript window by patching
// the single constant `var MAX_TRANSCRIPT_MESSAGES = 40;` in the INSTALLED qwen-code bundle.
//
// Why: the classifier prompt = stable system prompt + the last N transcript messages. The
// window slides on almost every call, which busts llama.cpp's prefix cache and forces a full
// cold prefill each verdict (measured: same window 0.6s vs shifted 57.6s). Fewer messages =
// shorter prompt = faster verdict, at no change to safety (same model). Stock 40 (~16.7k tok,
// ~33s on the local 4B) → 16 (~6.7k, ~13s). Floor 8 (below that a long tool-call chain can
// leave the window with zero user messages, and intent is judged from those).
//
// This patches ONE constant in an unminified JS bundle — no rebuild, applied at next qwen start.
// It must be DETERMINISTIC: find exactly one definition or fail loudly; never guess. A qwen-code
// update replaces the whole bundle and silently reverts the window to 40 — the command is
// idempotent (re-run to reapply) and a SessionStart hook (classifier-window-check) warns on drift.
const { fs, path, readF, writeF, exists, qHome, norm, rawArg } = require('./_qdt.js');

const FLOOR = 8, STOCK = 40;
// The definition (assignment). Two other chunks import the binding, so patching this one
// definition covers all uses. Kept as a factory so we get fresh (non-shared lastIndex) regexes.
const defReG = () => /var MAX_TRANSCRIPT_MESSAGES\s*=\s*(\d+)\s*;/g;
const defRe = () => /var MAX_TRANSCRIPT_MESSAGES\s*=\s*(\d+)\s*;/;

const prefFile = () => path.join(qHome(), '.classifier-window');

function E(msg) { const e = new Error(msg); e.qdt = true; return e; }

// ---- deterministic bundle discovery -----------------------------------------
// Never hard-code the path: it differs per platform, and the chunk filename carries a
// content hash that changes every release. Resolve `qwen` on PATH, follow symlinks, then find
// the package's chunks/ dir. QDT_CLASSIFIER_BUNDLE overrides the chunks dir (test hook only).
function resolveEntry() {
  const isWin = process.platform === 'win32';
  const names = isWin ? ['qwen.cmd', 'qwen.exe', 'qwen'] : ['qwen'];
  for (const d of (process.env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    for (const n of names) {
      const p = path.join(d, n);
      try { fs.lstatSync(p); let real = p; try { real = fs.realpathSync(p); } catch (_) {} return { bin: p, real, binDir: d }; } catch (_) {}
    }
  }
  return null;
}

function candidateRoots(res) {
  const roots = [];
  const push = (p) => { if (p && !roots.includes(p)) roots.push(p); };
  if (res.real) { let dir = path.dirname(res.real); for (let i = 0; i < 8; i++) { push(dir); const up = path.dirname(dir); if (up === dir) break; dir = up; } }
  const bd = res.binDir;
  if (bd) for (const rel of ['node_modules/@qwen-code/qwen-code', '../lib/node_modules/@qwen-code/qwen-code', '../node_modules/@qwen-code/qwen-code']) push(path.resolve(bd, rel));
  return roots;
}

function findChunksDir(res) {
  for (const root of candidateRoots(res)) {
    for (const c of [path.join(root, 'chunks'), path.join(root, 'dist', 'chunks')]) {
      try { if (fs.statSync(c).isDirectory()) return c; } catch (_) {}
    }
  }
  return null;
}

function pkgVersion(chunksDir) {
  let dir = chunksDir;
  for (let i = 0; i < 6; i++) {
    try { const j = JSON.parse(readF(path.join(dir, 'package.json'))); if (j && /qwen-code/.test(j.name || '')) return j.version || null; } catch (_) {}
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
}

// Locate the single definition. Throws (e.qdt) with an actionable message on any ambiguity.
function locate() {
  const override = process.env.QDT_CLASSIFIER_BUNDLE;
  let chunksDir, version;
  if (override) { chunksDir = override; version = pkgVersion(override) || 'test'; }
  else {
    const res = resolveEntry();
    if (!res) throw E('qwen not found on PATH. Install qwen-code (brew install qwen-code  /  npm i -g @qwen-code/qwen-code), then retry.');
    chunksDir = findChunksDir(res);
    if (!chunksDir) throw E('could not locate the qwen-code bundle chunks/ dir from ' + (res.real || res.bin) + '. The install layout looks unusual — report this so the toolkit finder can be updated. Nothing was changed.');
    version = pkgVersion(chunksDir);
  }
  let files;
  try { files = fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js')); } catch (_) { throw E('cannot read the bundle chunks dir: ' + chunksDir); }
  const hits = [];
  for (const f of files) {
    const full = path.join(chunksDir, f);
    const m = readF(full).match(defReG());
    if (m && m.length) hits.push({ file: full, count: m.length });
  }
  const total = hits.reduce((a, h) => a + h.count, 0);
  if (total === 0) throw E('the MAX_TRANSCRIPT_MESSAGES definition was NOT found in the qwen-code bundle. Upstream may have renamed or refactored the constant — update qwen-dev-toolkit (the finder needs adjusting). Nothing was changed.');
  if (total > 1) throw E('expected exactly ONE MAX_TRANSCRIPT_MESSAGES definition but found ' + total + ' across: ' + hits.map((h) => h.file + ' (' + h.count + ')').join(', ') + '. Refusing to guess — nothing was changed.');
  const file = hits[0].file;
  const current = parseInt(readF(file).match(defRe())[1], 10);
  return { chunksDir, file, current, version: version || 'unknown' };
}

function tryReadCurrent() { try { return locate(); } catch (_) { return null; } }

// ---- patch (idempotent, backed up, verified) --------------------------------
function applyPatch(loc, target) {
  const file = loc.file;
  try { fs.accessSync(file, fs.constants.W_OK); } catch (_) {
    throw E('the qwen-code bundle is not writable (root-owned install). Re-apply the one-constant edit with elevated rights:\n'
      + '  sudo perl -i -pe \'s/var MAX_TRANSCRIPT_MESSAGES = \\d+;/var MAX_TRANSCRIPT_MESSAGES = ' + target + ';/\' "' + file + '"\n'
      + 'then restart qwen-code. (perl ships on macOS and most Linux.) Nothing was changed.');
  }
  // Back up the pristine chunk once per version, so `reset` works even if stock is later unknown.
  const bak = file + '.qdt-bak';
  if (!exists(bak)) { try { fs.copyFileSync(file, bak); } catch (_) {} }
  const before = readF(file);
  const after = before.replace(defRe(), 'var MAX_TRANSCRIPT_MESSAGES = ' + target + ';');
  writeF(file, after);
  // Verify by re-reading — never report success off the write call alone.
  const check = readF(file).match(defRe());
  if (!check || parseInt(check[1], 10) !== target) throw E('post-write verification FAILED — the bundle does not read back as ' + target + '. It may have been modified concurrently; re-run. (A backup is at ' + bak + '.)');
}

function setPref(n) { try { writeF(prefFile(), String(n) + '\n'); } catch (_) {} }
function clearPref() { try { fs.unlinkSync(prefFile()); } catch (_) {} }
function readPref() { const v = parseInt(norm(readF(prefFile())), 10); return Number.isInteger(v) ? v : null; }

const out = (s) => console.log('CLASSIFIER_WINDOW_RESULT: ' + s);
const tag = (loc) => 'qwen-code ' + loc.version + ', ' + loc.file;

function doStatus() {
  const loc = locate();
  const pref = readPref();
  const stock = loc.current === STOCK ? 'stock' : 'NON-stock (stock ' + STOCK + ')';
  out('STATUS — window is ' + loc.current + ' [' + stock + ']. ' + tag(loc)
    + '. Recorded preference: ' + (pref == null ? 'none' : pref)
    + (pref != null && pref !== loc.current ? ' (DRIFT — bundle differs from your preference; a qwen update likely reset it — run /classifier-window ' + pref + ')' : '') + '.');
}

function doSet(target, isReset) {
  const loc = locate();
  if (loc.current === target) {
    if (isReset) clearPref(); else setPref(target);
    out('NOOP — already ' + target + (isReset ? ' (stock)' : '') + '. ' + tag(loc) + '. Nothing changed; restart qwen-code only if you haven\'t since a prior change.');
    return;
  }
  const was = loc.current;
  applyPatch(loc, target);
  if (isReset) clearPref(); else setPref(target);
  out((isReset ? 'RESET' : 'SET') + ' ok — MAX_TRANSCRIPT_MESSAGES ' + was + ' → ' + target + (isReset ? ' (stock)' : '') + '. ' + tag(loc)
    + '. ⚠ Takes effect only after you RESTART / re-open qwen-code.');
}

function main() {
  const arg = norm(rawArg(2));
  try {
    if (arg === '' || arg === 'status') return doStatus();
    if (arg === 'off' || arg === 'reset') return doSet(STOCK, true);
    if (/^\d+$/.test(arg)) {
      const n = parseInt(arg, 10);
      if (n < FLOOR) return out('ERROR — ' + n + ' is below the floor of ' + FLOOR + '. A smaller window can leave zero user messages in a long tool-call chain, and the classifier judges intent from those. Nothing changed.');
      if (n > STOCK) return out('ERROR — ' + n + ' is above the stock maximum of ' + STOCK + '. Use ' + FLOOR + '..' + STOCK + ', or `reset` for stock. Nothing changed.');
      return doSet(n, false);
    }
    out('ERROR — unrecognised argument "' + arg + '". Usage: /classifier-window <' + FLOOR + '..' + STOCK + '> | status | reset. Nothing changed.');
  } catch (e) {
    out('ERROR — ' + (e && e.qdt ? e.message : 'unexpected: ' + (e && e.message || e)));
    process.exitCode = 0; // report via the RESULT line, not a nonzero exit (the .md reads stdout)
  }
}

module.exports = { locate, tryReadCurrent, FLOOR, STOCK };
if (require.main === module) main();
