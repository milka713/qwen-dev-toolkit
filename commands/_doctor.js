#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /doctor — read-only self-diagnostic. Checks the things that silently rot: the install's
// hook scripts + command backends actually present, every toolkit hook wired into
// settings.json (a wired-but-missing or missing-but-wired gap ships bugs), guards not
// accidentally disabled, stale approval tokens / a leaked subagent counter, and — if a
// model provider is configured — a live /health ping with latency. Never mutates anything.
// Output: sectioned OK/WARN/FAIL lines and a one-line summary. JSON + network is why this
// is Node with a thin .sh wrapper.
const { fs, path, readF, exists, qHome } = require('./_qdt.js');
const cat = require('./_hookcat.js');
const cp = require('child_process');
const http = require('http');
const https = require('https');

const H = qHome();
const out = [];
let warn = 0, fail = 0;
const OK = (m) => out.push('  ✓ ' + m);
const WARN = (m) => { out.push('  ⚠ ' + m); warn++; };
const FAIL = (m) => { out.push('  ✗ ' + m); fail++; };
const section = (t) => { out.push(''); out.push(t); };

// ---- 1) dependencies --------------------------------------------------------
section('Dependencies:');
for (const [cmd, args] of [['node', ['--version']], ['git', ['--version']], ['qwen', ['--version']]]) {
  const r = cp.spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status === 0) OK(cmd + '  ' + (r.stdout || r.stderr || '').trim().split('\n')[0]);
  else if (cmd === 'qwen') WARN('qwen not found on PATH (are you running inside qwen-code?)');
  else FAIL(cmd + ' missing — the toolkit needs it');
}

// ---- 2) install integrity: critical files present ---------------------------
section('Install integrity (' + H + '):');
const need = {
  'command backends': ['commands/_qdt.js', 'commands/_stateview.js', 'commands/_hookcat.js', 'commands/_status.js', 'commands/_hooks.js', 'commands/_toolkit-reset.js', 'commands/_doctor.js'].map((p) => path.join(H, p)),
  'hook scripts': ['hooks/_hookutil.js', 'hooks/secret-guard.js', 'hooks/git-branch-guard.js', 'hooks/release-guard.js', 'hooks/main-push-consume.js', 'hooks/toolkit-reset-guard.js', 'hooks/agent-limit.js', 'hooks/session-start-restore.js', 'hooks/pre-compact-steer.js', 'hooks/compact-warn.js', 'hooks/skill-reminder.js', 'hooks/checkpoint-nudge.js'].map((p) => path.join(H, p)),
  'skills': ['implement', 'plan', 'checkpoint', 'audit', 'brainstorm', 'gitflow', 'commit', 'review', 'docs', 'changelog', 'release', 'toolkit-update'].map((s) => path.join(H, 'skills', s, 'SKILL.md')),
  'subagents': ['implementer', 'scout', 'debugger', 'tester', 'researcher', 'verifier'].map((a) => path.join(H, 'agents', a + '.md')),
};
for (const [label, files] of Object.entries(need)) {
  const missing = files.filter((f) => !exists(f)).map((f) => path.relative(H, f));
  if (!missing.length) OK(label + ': all ' + files.length + ' present');
  else FAIL(label + ': ' + missing.length + ' missing (' + missing.join(', ') + ') — run /toolkit-update');
}
const ver = readF(path.join(H, '.toolkit-version')).trim();
if (ver) OK('installed version: ' + ver + '  (refresh with /toolkit-update)');
else WARN('.toolkit-version not recorded — reinstall with /toolkit-update to stamp it');

// ---- 3) hooks wired into settings.json --------------------------------------
section('Hook wiring (settings.json):');
let wired = new Set();
let settingsOk = true;
try {
  const s = JSON.parse(readF(path.join(H, 'settings.json')) || '{}');
  for (const ev of Object.keys(s.hooks || {})) for (const g of s.hooks[ev] || []) for (const h of g.hooks || []) if (h && h.name) wired.add(h.name);
} catch (_) { settingsOk = false; }
if (!settingsOk) FAIL('~/.qwen/settings.json missing or unparseable — reinstall with /toolkit-update');
else {
  const missing = cat.NAMES.filter((n) => !wired.has(n));
  if (!missing.length) OK('all ' + cat.NAMES.length + ' toolkit hooks wired');
  else FAIL(missing.length + ' toolkit hook(s) NOT wired: ' + missing.join(', ') + ' — reinstall with /toolkit-update');
}

// ---- 4) disabled guards -----------------------------------------------------
section('Guard state:');
const disabled = cat.readDisabled();
const offGuards = cat.GUARDS.filter((g) => disabled.has(g));
if (!offGuards.length) OK('all guards active');
else WARN(offGuards.length + ' guard(s) DISABLED via /hooks: ' + offGuards.join(', ') + ' — re-enable with /hooks on <name>');

// ---- 5) stale state ---------------------------------------------------------
section('Stale state:');
let clean = true;
const TTL = 15 * 60 * 1000;
for (const [file, label] of [['.main-approval', '/main-push authorization'], ['.toolkit-reset-approval', '/toolkit-reset approval']]) {
  const p = path.join(H, file);
  try {
    const age = Date.now() - fs.statSync(p).mtimeMs;
    if (age > TTL) { WARN(label + ' token present but EXPIRED (' + Math.round(age / 60000) + 'm old) — harmless, cleared on next use'); clean = false; }
    else { WARN(label + ' token ACTIVE (' + Math.round(age / 1000) + 's old) — a push/reset is currently authorized'); clean = false; }
  } catch (_) { /* absent — good */ }
}
const acount = path.join(process.cwd(), '.qwen', '.agentcount');
try {
  const n = parseInt(readF(acount).trim(), 10);
  if (n > 0) { WARN('.qwen/.agentcount = ' + n + ' in this project (subagents counted as running) — /maxagents resets it at session start; if no subagents are running it is a stale leak'); clean = false; }
} catch (_) {}
const lock = path.join(process.cwd(), '.qwen', '.agentcount.lock');
try { if (Date.now() - fs.statSync(lock).mtimeMs > 10000) { WARN('.qwen/.agentcount.lock is stale (>10s) — a crashed hook left it; harmless, the next run steals it'); clean = false; } } catch (_) {}
if (clean) OK('no stale tokens, counters, or locks');

// ---- 6) model health --------------------------------------------------------
section('Model providers:');
const urls = [];
try {
  const s = JSON.parse(readF(path.join(H, 'settings.json')) || '{}');
  const walk = (o) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (k.toLowerCase() === 'baseurl' && typeof o[k] === 'string') urls.push(o[k]); else walk(o[k]); } };
  walk(s.modelProviders);
} catch (_) {}
if (!urls.length) { OK('no OpenAI-compatible provider baseUrl in settings (nothing to ping)'); finish(); }
else {
  let pending = urls.length;
  for (const u of [...new Set(urls)]) pingHealth(u, (line, bad) => { if (bad) WARN(line); else OK(line); if (--pending === 0) finish(); });
}

function pingHealth(baseUrl, cb) {
  let health;
  try { health = baseUrl.replace(/\/v\d+\/?$/, '') + '/health'; } catch (_) { return cb('bad baseUrl: ' + baseUrl, true); }
  const lib = health.startsWith('https') ? https : http;
  const t0 = Date.now();
  const req = lib.get(health, { timeout: 4000 }, (res) => {
    let body = ''; res.on('data', (c) => (body += c));
    res.on('end', () => {
      const ms = Date.now() - t0;
      const okStatus = res.statusCode >= 200 && res.statusCode < 300;
      cb(baseUrl + ' → ' + (okStatus ? 'healthy' : 'HTTP ' + res.statusCode) + ' (' + ms + 'ms)', !okStatus);
    });
  });
  req.on('timeout', () => { req.destroy(); cb(baseUrl + ' → no response within 4s (server down or unreachable)', true); });
  req.on('error', (e) => cb(baseUrl + ' → unreachable (' + e.code + ')', true));
}

function finish() {
  section((fail ? '✗ ' : warn ? '⚠ ' : '✓ ') + 'Summary: ' + (fail ? fail + ' problem(s), ' : '') + (warn ? warn + ' warning(s), ' : '') + (!fail && !warn ? 'everything healthy.' : 'see above.'));
  console.log('DOCTOR_REPORT\n' + out.join('\n'));
  process.exit(0);
}
