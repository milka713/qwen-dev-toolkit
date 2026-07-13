// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Canonical catalog of the toolkit's hooks + the on/off state file, shared by the /hooks
// command backend and /applied. The name is what the user sees and toggles; `kind` splits
// blocking guards from non-blocking automation. State: ~/.qwen/.hooks-disabled (one name
// per line). Hooks self-disable by reading that file via hooks/_hookutil.js.
const fs = require('fs');
const os = require('os');
const path = require('path');

const qHome = () => process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const disabledFile = () => path.join(qHome(), '.hooks-disabled');

const HOOKS = [
  { name: 'secret-guard',        kind: 'guard', event: 'PreToolUse',       desc: 'blocks writing or committing hardcoded secrets' },
  { name: 'git-branch-guard',    kind: 'guard', event: 'PreToolUse',       desc: 'blocks changes to main/master without /main-push approval' },
  { name: 'release-guard',       kind: 'guard', event: 'PreToolUse',       desc: 'flags a release/tag/publish that skips the /release flow' },
  { name: 'toolkit-reset-guard', kind: 'guard', event: 'PreToolUse',       desc: 'blocks "/toolkit-reset confirm" with no active approval window' },
  { name: 'agent-limit-pre',     kind: 'guard', event: 'PreToolUse',       desc: 'blocks launching more subagents than /maxagents allows' },
  { name: 'restore-progress',    kind: 'auto',  event: 'SessionStart',     desc: 're-injects .qwen/PROGRESS.md after compaction / on a new session' },
  { name: 'agent-limit-reset',   kind: 'auto',  event: 'SessionStart',     desc: 'resets the subagent counter at session start' },
  { name: 'compact-warn',        kind: 'auto',  event: 'SessionStart',     desc: 'warns when a compaction saved <15% (compacting further is ineffective)' },
  { name: 'steer-compaction',    kind: 'auto',  event: 'PreCompact',       desc: 'steers what compaction keeps (goal/plan over churn)' },
  { name: 'skill-reminder',      kind: 'auto',  event: 'UserPromptSubmit', desc: 'nudges the matching skill when a prompt clearly fits one' },
  { name: 'agent-limit-post',    kind: 'auto',  event: 'PostToolUse',      desc: 'decrements the subagent counter after a subagent finishes' },
];
const NAMES = HOOKS.map((h) => h.name);
const GUARDS = HOOKS.filter((h) => h.kind === 'guard').map((h) => h.name);

function readDisabled() {
  try {
    return new Set(fs.readFileSync(disabledFile(), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean).filter((n) => NAMES.includes(n)));
  } catch (_) { return new Set(); }
}
function writeDisabled(set) {
  const list = NAMES.filter((n) => set.has(n)); // canonical order, known names only
  const f = disabledFile();
  if (!list.length) { try { fs.unlinkSync(f); } catch (_) {} return; }
  fs.writeFileSync(f, list.join('\n') + '\n');
}

module.exports = { HOOKS, NAMES, GUARDS, readDisabled, writeDisabled, qHome, disabledFile };
