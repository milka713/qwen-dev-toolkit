#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// PreToolUse hook for qwen-code — development-mode delegation guard.
// When a project is in development mode (the `devmode` block is pinned in its QWEN.md), the
// ARCHITECT (main session) must not write source directly — every implementation goes to an
// `implementer`/`debugger` subagent. That rule used to live only as prose in QWEN.md, which a
// model can rationalise past ("it's just 5 lines"). This makes it deterministic: the main
// session's write_file/edit on a non-whitelisted path is BLOCKED. Subagents are exempt (they
// are the sanctioned writers) — detected via QWEN_CODE_AGENT_ID, which qwen-code sets to the
// agent id inside a subagent and leaves empty for the top-level architect. A single direct
// edit can be authorised out-of-band with /devedit (writes a one-shot token, consumed here).
// Output: deny via hookSpecificOutput.permissionDecision; otherwise exit 0 (allow).
'use strict';
try { if (require('./_hookutil.js').disabled('devmode-guard')) process.exit(0); } catch (_) {}
const fs = require('fs');
const path = require('path');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

const tool = input.tool_name || '';
if (!/^(write_file|edit|replace)$/.test(tool)) process.exit(0); // only guards direct file writes

// 1) Subagents are the sanctioned writers — never block them. qwen-code populates
//    QWEN_CODE_AGENT_ID with the subagent's id inside a subagent (e.g. "implementer-…") and
//    leaves it empty for the top-level architect. (Verified live: architect="" / subagent set.)
if ((process.env.QWEN_CODE_AGENT_ID || '').trim() !== '') process.exit(0);

const cwd = input.cwd || process.cwd();

// 2) Only enforce when THIS project is actually in development mode (block pinned in QWEN.md).
let qwen = '';
try { qwen = fs.readFileSync(path.join(cwd, 'QWEN.md'), 'utf8'); } catch (_) {}
if (!qwen.includes('devmode:start')) process.exit(0);

// 3) The architect's own writes are reserved for durable state / context files — allow those.
const ti = input.tool_input || {};
const fp = String(ti.file_path || ti.path || ti.absolute_path || '');
const base = fp.split(/[\\/]/).pop() || '';
const WHITELIST = new Set(['PROGRESS.md', 'QWEN.md', 'QWEN.local.md', 'FACTS.md', 'AGENTS.md']);
if (WHITELIST.has(base)) process.exit(0);

// 4) One-shot escape: /devedit stages ~/<project>/.qwen/.devmode-edit-once. If it's present
//    and fresh, consume it and allow exactly this one edit (the reason is already logged to
//    PROGRESS.md by /devedit). A stale token (>15 min) is swept, not honoured.
const token = path.join(cwd, '.qwen', '.devmode-edit-once');
try {
  const st = fs.statSync(token);
  const ageMs = Date.now() - st.mtimeMs;
  fs.unlinkSync(token); // single-use: consume whether fresh or stale
  if (ageMs <= 15 * 60 * 1000) process.exit(0);
} catch (_) { /* no token → fall through to block */ }

// 5) Block. The architect must delegate.
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      '[toolkit] devmode-guard blocked this: development mode is ON, so you (the architect) must NOT write source/tests/config directly — that is the whole point of /dev (it keeps your context small so big builds finish). Delegate this change to a fresh `implementer` subagent via the `agent` tool (or `debugger` for a bug), giving it the one scoped task; it does the edit and reports back. Your own write_file/edit is reserved for .qwen/PROGRESS.md, QWEN.md and FACTS.md. If delegating this ONE edit is genuinely pointless, first run:  bash "$HOME/.qwen/commands/_devedit.sh" "<why delegating is pointless>"  — that logs the reason to PROGRESS.md and authorises exactly one direct edit — then retry. (Or turn development mode off with /dev off.)',
  },
}));
