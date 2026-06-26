#!/usr/bin/env bash
# Removes qwen-dev-toolkit: deletes its skills/agents/hook scripts, strips its hook
# entries and QWEN.md block from your config. Leaves your other settings, env vars,
# memory and any .qwen/PROGRESS.md files untouched.
set -euo pipefail
QHOME="${QWEN_HOME:-$HOME/.qwen}"

rm -rf "$QHOME/skills/implement" "$QHOME/skills/checkpoint" "$QHOME/skills/plan" \
       "$QHOME/skills/audit" "$QHOME/skills/brainstorm"
rm -f  "$QHOME/agents/implementer.md" "$QHOME/agents/scout.md"
rm -f  "$QHOME/commands/dev.md" "$QHOME/commands/cover.md" "$QHOME/commands/pin.md" \
       "$QHOME/commands/status.md" "$QHOME/commands/_mode-toggle.sh" \
       "$QHOME/commands/_devmode.block" "$QHOME/commands/_covermode.block" \
       "$QHOME/commands/_pin.sh" "$QHOME/commands/_status.sh" \
       "$QHOME/commands/_dev-toggle.sh"
rm -f  "$QHOME/hooks/session-start-restore.js" "$QHOME/hooks/pre-compact-steer.js" \
       "$QHOME/hooks/secret-guard.js" "$QHOME/hooks/skill-reminder.js"
echo "  ✓ removed skills, commands, subagents, hook scripts"

node - "$QHOME" <<'NODE'
const fs = require('fs'), path = require('path');
const qhome = process.argv[2];
const file = path.join(qhome, 'settings.json');
let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { process.exit(0); }
const names = new Set(['restore-progress', 'steer-compaction', 'secret-guard', 'skill-reminder']);
for (const ev of Object.keys(s.hooks || {})) {
  s.hooks[ev] = (s.hooks[ev] || []).filter(g => !(g.hooks || []).some(h => names.has(h.name)));
  if (!s.hooks[ev].length) delete s.hooks[ev];
}
if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
console.log('  ✓ removed hook entries from settings.json (memory setting left as-is)');
NODE

node - "$QHOME" <<'NODE'
const fs = require('fs'), path = require('path');
const file = path.join(process.argv[2], 'QWEN.md');
let cur; try { cur = fs.readFileSync(file, 'utf8'); } catch (_) { process.exit(0); }
const re = /\n*<!-- qwen-dev-toolkit:start -->[\s\S]*?<!-- qwen-dev-toolkit:end -->\n*/;
fs.writeFileSync(file, cur.replace(re, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
console.log('  ✓ removed QWEN.md guidance block');
NODE

echo "Done. Restart qwen-code."
