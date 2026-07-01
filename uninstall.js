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

const SKILLS = ['implement', 'plan', 'checkpoint', 'audit', 'brainstorm', 'gitflow', 'commit', 'review', 'docs', 'changelog', 'toolkit-update'];
for (const s of SKILLS) rm(path.join(QHOME, 'skills', s));
for (const a of ['implementer', 'scout', 'debugger']) rm(path.join(QHOME, 'agents', a + '.md'));

const CMD_MD = ['dev', 'cover', 'pin', 'status', 'maxagents', 'bro', 'main-push', 'versioning'];
const CMD_BACKENDS = ['_qdt', '_mode-toggle', '_cover', '_pin', '_status', '_maxagents', '_bro', '_main-push', '_versioning'];
for (const c of CMD_MD) rm(path.join(QHOME, 'commands', c + '.md'));
for (const b of CMD_BACKENDS) { rm(path.join(QHOME, 'commands', b + '.sh')); rm(path.join(QHOME, 'commands', b + '.js')); }
rm(path.join(QHOME, 'commands', '_devmode.block'));
// legacy names from older releases
for (const f of ['mainok.md', '_mainok.sh', '_mainok.js', '_dev-toggle.sh', '_covermode.block']) rm(path.join(QHOME, 'commands', f));

for (const h of ['session-start-restore.js', 'pre-compact-steer.js', 'secret-guard.js', 'git-branch-guard.js', 'skill-reminder.js', 'agent-limit.js']) rm(path.join(QHOME, 'hooks', h));
console.log('  ✓ removed skills, commands, subagents, hook scripts');

// strip our hook entries from settings.json (keep everything else, incl. memory setting)
(function () {
  const file = path.join(QHOME, 'settings.json');
  let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return; }
  const names = new Set(['restore-progress', 'steer-compaction', 'secret-guard', 'git-branch-guard', 'skill-reminder', 'agent-limit-reset', 'agent-limit-pre', 'agent-limit-post']);
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = (s.hooks[ev] || []).filter((g) => !(g.hooks || []).some((h) => names.has(h.name)));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  console.log('  ✓ removed hook entries from settings.json (your other settings kept)');
})();

// strip our QWEN.md guidance block + the /bro persona block
(function () {
  const file = path.join(QHOME, 'QWEN.md');
  let cur = read(file); if (cur == null) return;
  let out = cur.replace(/\n*<!-- qwen-dev-toolkit:start -->[\s\S]*?<!-- qwen-dev-toolkit:end -->\n*/, '\n')
               .replace(/\n*<!-- bromode:start -->[\s\S]*?<!-- bromode:end -->\n*/, '\n');
  fs.writeFileSync(file, out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log('  ✓ removed QWEN.md guidance + bro-mode block');
})();

console.log('Done. Restart qwen-code.');
