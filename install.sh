#!/usr/bin/env bash
# qwen-dev-toolkit installer.
# Copies skills, subagents and hook scripts into ~/.qwen, then idempotently merges
# the hook + memory settings into ~/.qwen/settings.json and the workflow guidance
# into ~/.qwen/QWEN.md — without touching any of your existing keys, env vars, or
# API secrets. Safe to re-run (it overwrites only this toolkit's own files/blocks).
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QHOME="${QWEN_HOME:-$HOME/.qwen}"
HOOKS_DIR="$QHOME/hooks"

command -v node >/dev/null || { echo "ERROR: node is required (qwen-code needs it too)."; exit 1; }

VERSION="$(cat "$SRC/VERSION" 2>/dev/null || echo '?')"
echo "Installing / updating qwen-dev-toolkit (v$VERSION) into $QHOME"
mkdir -p "$QHOME/skills" "$QHOME/agents" "$QHOME/commands" "$HOOKS_DIR"

# Clean stale files from older releases so updates don't leave orphans behind.
# (Names that were renamed/removed across versions; current files are overwritten below.)
rm -rf "$QHOME/skills/dev"                      # /dev became a command, was a skill
rm -f  "$QHOME/commands/_dev-toggle.sh" \
       "$QHOME/commands/_covermode.block"       # superseded by _mode-toggle.sh / _cover.sh

# 1) Skills, subagents, commands and hooks — plain file copies.
for s in implement plan checkpoint audit brainstorm; do
  mkdir -p "$QHOME/skills/$s"
  cp "$SRC/skills/$s/SKILL.md" "$QHOME/skills/$s/SKILL.md"
done
cp "$SRC/agents/implementer.md" "$SRC/agents/scout.md" "$QHOME/agents/"
cp "$SRC"/commands/* "$QHOME/commands/"
chmod +x "$QHOME"/commands/*.sh
cp "$SRC"/hooks/*.js "$HOOKS_DIR/"
echo "  ✓ skills (implement, plan, checkpoint, audit, brainstorm)"
echo "  ✓ commands (/dev, /cover, /pin, /status, /maxagents, /bro)"
echo "  ✓ subagents (implementer, scout)"
echo "  ✓ hook scripts (restore, compaction-steer, secret-guard, skill-reminder)"

# 2) Merge hooks + memory into settings.json (preserve everything else).
node - "$QHOME" <<'NODE'
const fs = require('fs'), path = require('path');
const qhome = process.argv[2];
const file = path.join(qhome, 'settings.json');
let s = {};
try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
const hooksDir = path.join(qhome, 'hooks');
const entry = (script, name, matcher) => {
  const g = { hooks: [{ type: 'command', command: 'node ' + path.join(hooksDir, script), name }] };
  if (matcher) g.matcher = matcher;
  return g;
};
s.hooks = s.hooks || {};
// Replace only our named entries; keep any other hooks the user already has.
const setHook = (event, script, name, matcher) => {
  const others = (s.hooks[event] || []).filter(g => !(g.hooks || []).some(h => h.name === name));
  s.hooks[event] = [...others, entry(script, name, matcher)];
};
setHook('SessionStart',    'session-start-restore.js', 'restore-progress');
setHook('SessionStart',    'agent-limit.js reset',     'agent-limit-reset');
setHook('PreCompact',      'pre-compact-steer.js',     'steer-compaction');
setHook('PreToolUse',      'secret-guard.js',          'secret-guard', 'write_file|edit|replace|run_shell_command');
setHook('PreToolUse',      'agent-limit.js pre',       'agent-limit-pre', 'agent');
setHook('PostToolUse',     'agent-limit.js post',      'agent-limit-post', 'agent');
setHook('UserPromptSubmit','skill-reminder.js',        'skill-reminder');
s.memory = Object.assign({ enableManagedAutoMemory: true, enableManagedAutoDream: true }, s.memory || {});
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
console.log('  ✓ settings.json merged (hooks + auto-memory); existing keys untouched');
NODE

# 3) Merge workflow guidance into ~/.qwen/QWEN.md between markers (idempotent).
node - "$QHOME" "$SRC/QWEN.md" <<'NODE'
const fs = require('fs'), path = require('path');
const [qhome, guideFile] = process.argv.slice(2);
const file = path.join(qhome, 'QWEN.md');
const START = '<!-- qwen-dev-toolkit:start -->', END = '<!-- qwen-dev-toolkit:end -->';
const guide = fs.readFileSync(guideFile, 'utf8').trim();
const block = `${START}\n${guide}\n${END}`;
let cur = '';
try { cur = fs.readFileSync(file, 'utf8'); } catch (_) {}
const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const had = re.test(cur);
// Drop the existing marker block, then also strip any *bare* verbatim copy of the guide
// that sits outside the markers (left behind by older installs or direct hand-edits),
// so re-running never duplicates the guidance. Then append a single fresh block.
let body = cur.replace(re, '').replace(guide, '').replace(/\n{3,}/g, '\n\n').trim();
const out = (body ? body + '\n\n' : '') + block + '\n';
fs.writeFileSync(file, out);
console.log('  ✓ QWEN.md guidance ' + (had ? 'updated' : 'added'));
NODE

echo
echo "Done. Restart qwen-code (or start a new session) to load everything."
echo "Verify:  /skills   ->  implement, checkpoint, plan, audit"
echo "         /agents manage  ->  implementer, scout"
echo "         /dev status / /cover status / /pin list  ->  commands respond"
echo "Try:     /dev   then   /plan build me a small CLI todo app"
echo "         /cover on   (require ≥90% tested output)"
echo "         /audit      (security review)"
