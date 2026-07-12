#!/usr/bin/env node
'use strict';
// /hooks — turn the toolkit's hooks (guards + automation) off/on when they get in the way.
//   /hooks | status         -> show every hook with ON/OFF
//   /hooks off <name>       -> disable one hook (sticky, until re-enabled)
//   /hooks on  <name>       -> re-enable one hook
//   /hooks off guards       -> disable ALL guards at once
//   /hooks off all          -> disable everything
//   /hooks on  | on all     -> re-enable everything
// Off hooks stay wired in settings.json but self-disable via ~/.qwen/.hooks-disabled;
// disabled guards are shown loudly here and in /applied so they are never silently lost.
// Real work is in Node (shared catalog) — _hooks.sh is a thin wrapper. Mutates only the
// state file. JSON parse of settings.json is optional (to flag hooks that aren't installed).
const { fs, path } = require('./_qdt.js');
const cat = require('./_hookcat.js');

const argv = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean);
const verb = argv[0] || 'status';
const target = argv[1] || '';

const installed = (() => {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(cat.qHome(), 'settings.json'), 'utf8'));
    const names = new Set();
    for (const ev of Object.keys(s.hooks || {})) for (const g of s.hooks[ev] || []) for (const h of g.hooks || []) if (h && h.name) names.add(h.name);
    return names;
  } catch (_) { return null; } // null = settings unreadable; don't claim anything about install state
})();

function resolveTargets(t) {
  if (t === 'guards') return cat.GUARDS;
  if (t === 'all' || t === '') return cat.NAMES;
  if (cat.NAMES.includes(t)) return [t];
  return null; // unknown
}

const disabled = cat.readDisabled();
let action = '';

if (verb === 'off' || verb === 'on') {
  const targets = resolveTargets(target || (verb === 'on' ? 'all' : ''));
  if (targets === null) {
    console.log(`HOOKS_RESULT: unknown hook "${target}". Valid: ${cat.NAMES.join(', ')}, or the shortcuts "guards" / "all".`);
    process.exit(0);
  }
  if (verb === 'off' && !target) { // bare "/hooks off" is ambiguous — refuse rather than nuke everything
    console.log('HOOKS_RESULT: specify what to turn off — /hooks off <name>, /hooks off guards, or /hooks off all.');
    process.exit(0);
  }
  for (const n of targets) { if (verb === 'off') disabled.add(n); else disabled.delete(n); }
  cat.writeDisabled(disabled);
  action = `${verb === 'off' ? 'Disabled' : 'Re-enabled'}: ${targets.join(', ')}.`;
  const guardsOff = verb === 'off' ? targets.filter((n) => cat.GUARDS.includes(n)) : [];
  if (guardsOff.length) action += ` ⚠ Guard(s) now OFF and NOT protecting until you run /hooks on <name>: ${guardsOff.join(', ')}.`;
} else if (verb !== 'status') {
  console.log(`HOOKS_RESULT: usage — /hooks [status] | /hooks off <name|guards|all> | /hooks on [<name>|all]. Got: '${argv.join(' ')}'`);
  process.exit(0);
}

// ---- render status ----------------------------------------------------------
const out = [];
if (action) { out.push('HOOKS_RESULT: ' + action); out.push(''); }
out.push('Toolkit hooks (OFF = self-disabled via /hooks; still wired, but no-op):');
for (const kind of ['guard', 'auto']) {
  out.push('');
  out.push(kind === 'guard' ? 'Guards / prohibitions (can BLOCK a tool call):' : 'Automation (non-blocking):');
  for (const h of cat.HOOKS.filter((x) => x.kind === kind)) {
    const off = disabled.has(h.name);
    const notInstalled = installed && !installed.has(h.name);
    const flag = off ? '[OFF]' : '[ON ]';
    const warn = off && kind === 'guard' ? '   ⚠ DISABLED' : (notInstalled ? '   (not installed)' : '');
    out.push(`  ${flag} ${h.name.padEnd(20, '.')} ${h.desc}${warn}`);
  }
}
out.push('');
const offNow = cat.NAMES.filter((n) => disabled.has(n));
if (offNow.length) out.push(`Disabled: ${offNow.join(', ')}   (re-enable: /hooks on <name>, or /hooks on to restore all)`);
else out.push('All hooks are ON.');
console.log(out.join('\n'));
