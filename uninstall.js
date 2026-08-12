#!/usr/bin/env node
'use strict';
/*
 * qwen-dev-toolkit cross-platform uninstaller (macOS · Linux · Windows).
 * Removes ONLY this toolkit's own skills/subagents/commands/hooks and strips its hook
 * entries + QWEN.md blocks. Leaves your other settings, env vars, memories, any other
 * skills you have, and .qwen/PROGRESS.md files untouched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const rm = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } };

const SKILLS = ['implement', 'plan', 'checkpoint', 'audit', 'brainstorm', 'gitflow', 'commit', 'review', 'docs', 'changelog', 'release', 'toolkit-update', 'research', 'terminal'];
for (const s of SKILLS) rm(path.join(QHOME, 'skills', s));
for (const a of ['implementer', 'scout', 'debugger', 'tester', 'researcher', 'verifier']) rm(path.join(QHOME, 'agents', a + '.md'));

const CMD_MD = ['dev', 'cover', 'pin', 'checkpoint', 'status', 'maxagents', 'bro', 'main-push', 'main-push-hint', 'versioning', 'reality', 'research', 'autocompact', 'toolkit-reset', 'applied', 'hooks', 'doctor', 'sudo-on', 'sudo-off', 'devedit', 'classifier-window', 'settings-sync'];
const CMD_BACKENDS = ['_qdt', '_mode-toggle', '_cover', '_pin', '_status', '_maxagents', '_bro', '_main-push', '_main-push-hint', '_versioning', '_reality', '_research', '_autocompact', '_toolkit-reset', '_applied', '_hooks', '_hookcat', '_stateview', '_doctor', '_sudoctl', '_devedit', '_classifier-window', '_settings-sync'];
for (const c of CMD_MD) rm(path.join(QHOME, 'commands', c + '.md'));
for (const b of CMD_BACKENDS) { rm(path.join(QHOME, 'commands', b + '.sh')); rm(path.join(QHOME, 'commands', b + '.js')); }
rm(path.join(QHOME, 'commands', '_devmode.block'));
rm(path.join(QHOME, '.toolkit-version'));
rm(path.join(QHOME, '.hooks-disabled'));
rm(path.join(QHOME, '.classifier-window'));  // /classifier-window preference (toolkit-only state)
rm(path.join(QHOME, '.settings-repo'));      // /settings-sync connected-repo state
rm(path.join(QHOME, '.settings-sync-repo')); // /settings-sync working clone (settings.json itself is left alone)
// approval tokens, the /toolkit-reset undo snapshot, and the /sudo-on state (toolkit-only files)
for (const f of ['.toolkit-reset-backup', '.toolkit-reset-approval', '.main-approval', '.sudo-pending', '.sudo-pass', '.sudo-askpass']) rm(path.join(QHOME, f));
// legacy names from older releases
for (const f of ['mainok.md', '_mainok.sh', '_mainok.js', '_dev-toggle.sh', '_covermode.block']) rm(path.join(QHOME, 'commands', f));

for (const h of ['session-start-restore.js', 'pre-compact-steer.js', 'secret-guard.js', 'git-branch-guard.js', 'release-guard.js', 'main-push-consume.js', 'skill-reminder.js', 'agent-limit.js', 'compact-warn.js', 'classifier-window-check.js', 'toolkit-reset-guard.js', 'checkpoint-nudge.js', 'devmode-guard.js', 'terminal-guard.js', 'search-on-stuck.js', '_hookutil.js']) rm(path.join(QHOME, 'hooks', h));
console.log('  ✓ removed skills, commands, subagents, hook scripts');

// strip our hook entries from settings.json (keep everything else, incl. memory setting)
(function () {
  const file = path.join(QHOME, 'settings.json');
  let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return; }
  const names = new Set(['restore-progress', 'steer-compaction', 'compact-warn', 'classifier-window-check', 'secret-guard', 'git-branch-guard', 'release-guard', 'main-push-consume', 'toolkit-reset-guard', 'devmode-guard', 'terminal-guard', 'skill-reminder', 'agent-limit-reset', 'agent-limit-pre', 'agent-limit-post', 'checkpoint-nudge', 'search-on-stuck', 'search-on-stuck-ok', 'search-on-stuck-reset']);
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = (s.hooks[ev] || []).filter((g) => !(g.hooks || []).some((h) => names.has(h.name)));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  console.log('  ✓ removed hook entries from settings.json (your other settings kept)');
})();

// strip our QWEN.md guidance block + every toolkit toggle block (the same marker set
// /toolkit-reset owns — the modes normally pin these in a PROJECT QWEN.md, but an older
// release pinned some globally, and a stale one must not survive the uninstall)
(function () {
  const file = path.join(QHOME, 'QWEN.md');
  let cur = read(file); if (cur == null) return;
  const MARKERS = ['qwen-dev-toolkit', 'bromode', 'covermode', 'devmode', 'maxagents', 'versioning', 'realitymode', 'realityoff', 'researchoff', 'sudomode'];
  let out = cur;
  for (const m of MARKERS) out = out.replace(new RegExp('\\n*<!-- ' + m + ':start -->[\\s\\S]*?<!-- ' + m + ':end -->\\n*', 'g'), '\n');
  fs.writeFileSync(file, out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log('  ✓ removed QWEN.md guidance + toolkit toggle blocks');
})();

console.log('Done. Restart qwen-code.');
console.log('Note: per-project toggle blocks (/dev, /cover, /bro, …) live in each project\'s own');
console.log('QWEN.md and are not touched by a global uninstall — run /toolkit-reset project in a');
console.log('project (before uninstalling) or delete its marker blocks by hand to clear them.');
