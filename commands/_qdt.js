// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Shared helpers for the qwen-dev-toolkit Node command backends (used on Windows, where
// the bash `_*.sh` backends can't run). Each backend `require('./_qdt.js')`; both live in
// ~/.qwen/commands so the relative require resolves. Behaviour mirrors the bash versions.
const fs = require('fs');
const os = require('os');
const path = require('path');

const readF = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };
const writeF = (p, s) => fs.writeFileSync(p, s);
const appendF = (p, s) => fs.appendFileSync(p, s);
const exists = (p) => { try { fs.statSync(p); return true; } catch (_) { return false; } };

// lowercase + collapse/trim whitespace, like `tr '[:upper:]' '[:lower:]' | xargs`.
const norm = (arg) => (arg || '').replace(/\s+/g, ' ').trim().toLowerCase();

const hasMarker = (file, marker) => readF(file).includes(marker + ':start');

// Delete the first `<marker>:start` line through the next `<marker>:end` line (inclusive),
// like `sed "/marker:start/,/marker:end/d"`.
function removeBlock(file, marker) {
  const lines = readF(file).split('\n');
  const s = lines.findIndex((l) => l.includes(marker + ':start'));
  if (s < 0) return;
  let e = lines.findIndex((l, i) => i >= s && l.includes(marker + ':end'));
  if (e < 0) e = lines.length - 1;
  lines.splice(s, e - s + 1);
  writeF(file, lines.join('\n'));
}

// The global ~/.qwen home (honours QWEN_HOME like the shell backends).
const qHome = () => process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');

// The raw joined user argument (everything after the fixed positional args).
const rawArg = (fromIndex) => process.argv.slice(fromIndex).join(' ');

module.exports = { fs, os, path, readF, writeF, appendF, exists, norm, hasMarker, removeBlock, qHome, rawArg };
