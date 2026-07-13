#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /applied — read-only introspection: what from the toolkit is currently applied.
//   /applied            -> PROJECT scope (marker blocks from ./QWEN.md)
//   /applied global     -> GLOBAL scope  (marker blocks from ~/.qwen/QWEN.md)
// Hooks & guards live in ~/.qwen/settings.json and apply to EVERY project, so they are
// reported (clearly labelled) in both scopes. Mutates nothing. JSON parsing is why the
// real logic is here in Node and _applied.sh is just a thin wrapper (like /autocompact).
const { fs, path, readF, exists, norm, qHome, rawArg } = require('./_qdt.js');

const scopeArg = norm(rawArg(2));
const GLOBAL = ['global', 'g', '-g', '--global', 'glob', 'глобал', 'глобально'].includes(scopeArg);
const scope = GLOBAL ? 'GLOBAL' : 'PROJECT';
const qwenFile = GLOBAL ? path.join(qHome(), 'QWEN.md') : 'QWEN.md';
const q = readF(qwenFile);

// ---- modes (per-scope QWEN.md marker blocks) --------------------------------
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

// ---- hooks & guards (always from GLOBAL settings.json — they apply everywhere) --
const cat = require('./_hookcat.js');
const KNOWN_NAMES = new Set(cat.NAMES);
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
const disabledHooks = cat.readDisabled();
const guards = cat.HOOKS.filter((h) => h.kind === 'guard' && present.has(h.name));
const autos = cat.HOOKS.filter((h) => h.kind === 'auto' && present.has(h.name));
const others = installedNames.filter((k) => !KNOWN_NAMES.has(k)).length;

// ---- version ----------------------------------------------------------------
let version = readF(path.join(qHome(), '.toolkit-version')).trim();
if (!version) version = readF(path.join(qHome(), '.src', 'qwen-dev-toolkit', 'VERSION')).trim();

// ---- render -----------------------------------------------------------------
const out = [];
out.push(`APPLIED — toolkit state · scope: ${scope} (${GLOBAL ? qwenFile : './QWEN.md'})`);
out.push('');
const anyMode = modes.some(([, v]) => v !== 'OFF' && !/^none|^semantic \(global/.test(v));
out.push(`Modes — ${GLOBAL ? 'global' : 'per-project'} marker blocks in ${GLOBAL ? '~/.qwen/QWEN.md' : './QWEN.md'}:`);
for (const [name, val] of modes) out.push(`  • ${name.padEnd(18, '.')} ${val}`);
if (!anyMode) out.push('  (nothing pinned beyond the global semantic-versioning default)');
out.push('');

if (!settingsReadable) {
  out.push('Hooks & guards: could not read ~/.qwen/settings.json (none applied, or unreadable).');
} else {
  out.push('Guards / prohibitions (global — can BLOCK a tool call in every project, incl. this one):');
  if (guards.length) for (const g of guards) out.push(`  ${disabledHooks.has(g.name) ? '▫' : '⛔'} ${g.name.padEnd(20, '.')} ${g.desc}${disabledHooks.has(g.name) ? '   ⚠ DISABLED via /hooks' : ''}`);
  else out.push('  (none installed)');
  out.push('');
  out.push('Automation hooks (global — non-blocking):');
  if (autos.length) for (const a of autos) out.push(`  • ${a.name.padEnd(20, '.')} ${a.event} — ${a.desc}${disabledHooks.has(a.name) ? '   (off via /hooks)' : ''}`);
  else out.push('  (none installed)');
  if (others) { out.push(''); out.push(`  (+ ${others} other hook(s) in settings.json, not from this toolkit)`); }
  const offGuards = guards.filter((g) => disabledHooks.has(g.name)).map((g) => g.name);
  if (offGuards.length) { out.push(''); out.push(`  ⚠ ${offGuards.length} guard(s) currently DISABLED: ${offGuards.join(', ')} — re-enable with /hooks on <name>.`); }
}
out.push('');
out.push(`Toolkit version: ${version || '(unknown)'}`);
console.log(out.join('\n'));
