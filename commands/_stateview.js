// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Shared state renderer for /status and /applied — one source of truth so the two reports
// can never drift. Produces the full human-readable snapshot: per-scope mode toggles, the
// active plan/development progress (from .qwen/PROGRESS.md), the global guards + automation
// hooks (from ~/.qwen/settings.json), pinned-fact count, and the toolkit version.
// Read-only: it never writes anything. JSON parsing (settings.json) is why this and its
// callers are Node, with thin .sh wrappers.
const { fs, path, readF, exists, qHome } = require('./_qdt.js');
const cat = require('./_hookcat.js');

// ---- per-scope mode toggles (marker blocks in the scope's QWEN.md) ----------
function modesFor(q, GLOBAL) {
  const has = (m) => q.includes(m + ':start');
  const grab = (re) => { const m = q.match(re); return m ? m[0] : ''; };
  const modes = [];
  modes.push(['Development mode', has('devmode') ? 'ON' : 'OFF']);
  modes.push(['Test-coverage mode', has('covermode') ? 'ON (' + (grab(/target ≥[0-9]+%/) || 'target set') + ')' : 'OFF']);
  modes.push(['Bro mode', has('bromode') ? 'ON (' + (q.includes('persona: lamar') ? 'Ламар' : 'Свободовец') + ')' : 'OFF']);
  modes.push(['Subagent limit', has('maxagents') ? (grab(/at most [0-9]+ at a time/) || 'set') : 'none (as needed)']);
  modes.push(['Reality mode', has('realitymode') ? 'ON' : 'OFF']);
  let versioning;
  if (has('versioning')) {
    versioning = q.includes('versioning: custom') ? 'custom scheme (project override)'
      : q.includes('versioning: off') ? 'OFF (project opts out of the global semantic default)'
      : 'semantic (pinned in this project)';
  } else {
    versioning = GLOBAL ? 'semantic (global default)' : 'semantic (global default; no project override)';
  }
  modes.push(['Versioning', versioning]);
  return modes;
}

// ---- active plan / development progress (project scope, .qwen/PROGRESS.md) ---
// This is the "what is /dev (or any plan) actually doing right now" view the user asked
// /status to surface: the goal, done/remaining task counts, and the next unchecked task.
function planLines(devOn) {
  const P = '.qwen/PROGRESS.md';
  const out = [];
  if (!exists(P)) {
    out.push('Active plan / development:');
    out.push(devOn
      ? '  • Development mode is ON, but there is no .qwen/PROGRESS.md yet — run /plan (or /checkpoint) to start a durable task list.'
      : '  • no active build (no .qwen/PROGRESS.md).');
    return out;
  }
  const body = readF(P);
  const lines = body.split('\n');
  const gi = lines.findIndex((l) => /^##\s.*Goal/i.test(l));
  let goal = '';
  if (gi >= 0) {
    const acc = [];
    for (let i = gi + 1; i < lines.length && acc.length < 2; i++) {
      if (/^##\s/.test(lines[i])) break;
      if (lines[i].trim()) acc.push(lines[i].trim());
    }
    goal = acc.join(' ');
  }
  const done = (body.match(/^\s*- \[x\]/gim) || []).length;
  const todo = (body.match(/^\s*- \[ \]/gm) || []).length;
  const nextLine = lines.find((l) => /^\s*- \[ \]/.test(l));
  const next = nextLine ? nextLine.replace(/^\s*- \[ \] */, '').trim() : '';
  const pct = done + todo > 0 ? Math.round((done / (done + todo)) * 100) : 0;
  out.push('Active plan / development (.qwen/PROGRESS.md):');
  out.push('  • Goal.... ' + (goal || '(none recorded)'));
  out.push('  • Progress ' + done + ' done, ' + todo + ' remaining (' + pct + '% complete)');
  out.push('  • Next.... ' + (next || '(no unchecked task — plan may be complete)'));
  return out;
}

// ---- global guards + automation (settings.json), pinned facts, version ------
function render(scope /* 'PROJECT' | 'GLOBAL' */) {
  const GLOBAL = scope === 'GLOBAL';
  const qwenFile = GLOBAL ? path.join(qHome(), 'QWEN.md') : 'QWEN.md';
  const q = readF(qwenFile);
  const modes = modesFor(q, GLOBAL);

  const settingsFile = path.join(qHome(), 'settings.json');
  let installedNames = [];
  let settingsReadable = true;
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    for (const ev of Object.keys(s.hooks || {})) {
      for (const g of s.hooks[ev] || []) for (const h of g.hooks || []) if (h && h.name) installedNames.push(h.name);
    }
  } catch (_) { settingsReadable = false; }
  const present = new Set(installedNames);
  const KNOWN = new Set(cat.NAMES);
  const disabledHooks = cat.readDisabled();
  const guards = cat.HOOKS.filter((h) => h.kind === 'guard' && present.has(h.name));
  const autos = cat.HOOKS.filter((h) => h.kind === 'auto' && present.has(h.name));
  const others = installedNames.filter((k) => !KNOWN.has(k)).length;

  let version = readF(path.join(qHome(), '.toolkit-version')).trim();
  if (!version) version = readF(path.join(qHome(), '.src', 'qwen-dev-toolkit', 'VERSION')).trim();

  const out = [];
  out.push('TOOLKIT STATE — scope: ' + scope + ' (' + (GLOBAL ? qwenFile : './QWEN.md') + ')');
  out.push('');
  const anyMode = modes.some(([, v]) => v !== 'OFF' && !/^none|^semantic \(global/.test(v));
  out.push('Modes — ' + (GLOBAL ? 'global' : 'per-project') + ' marker blocks in ' + (GLOBAL ? '~/.qwen/QWEN.md' : './QWEN.md') + ':');
  for (const [name, val] of modes) out.push('  • ' + name.padEnd(18, '.') + ' ' + val);
  if (!anyMode) out.push('  (nothing pinned beyond the global semantic-versioning default)');
  out.push('');

  // Plan/development progress only makes sense per-project (PROGRESS.md is per-project).
  if (!GLOBAL) {
    const devOn = q.includes('devmode:start');
    for (const l of planLines(devOn)) out.push(l);
    const facts = exists('FACTS.md') ? (readF('FACTS.md').match(/^- /gm) || []).length : 0;
    out.push('  • Pinned.. ' + (facts ? facts + ' fact(s) in FACTS.md (/pin)' : 'none (no FACTS.md)'));
    out.push('');
  }

  if (!settingsReadable) {
    out.push('Guards & hooks: could not read ~/.qwen/settings.json (none applied, or unreadable).');
  } else {
    out.push('Guards / prohibitions (global — can BLOCK a tool call in every project, incl. this one):');
    if (guards.length) for (const g of guards) out.push('  ' + (disabledHooks.has(g.name) ? '▫' : '⛔') + ' ' + g.name.padEnd(20, '.') + ' ' + g.desc + (disabledHooks.has(g.name) ? '   ⚠ DISABLED via /hooks' : ''));
    else out.push('  (none installed)');
    out.push('');
    out.push('Automation hooks (global — non-blocking):');
    if (autos.length) for (const a of autos) out.push('  • ' + a.name.padEnd(20, '.') + ' ' + a.event + ' — ' + a.desc + (disabledHooks.has(a.name) ? '   (off via /hooks)' : ''));
    else out.push('  (none installed)');
    if (others) { out.push(''); out.push('  (+ ' + others + ' other hook(s) in settings.json, not from this toolkit)'); }
    const offGuards = guards.filter((g) => disabledHooks.has(g.name)).map((g) => g.name);
    if (offGuards.length) { out.push(''); out.push('  ⚠ ' + offGuards.length + ' guard(s) currently DISABLED: ' + offGuards.join(', ') + ' — re-enable with /hooks on <name>.'); }
  }
  out.push('');
  out.push('Toolkit version: ' + (version || '(unknown)'));
  return out.join('\n');
}

module.exports = { render };
