#!/usr/bin/env node
// UserPromptSubmit hook — nudges the model to invoke the right toolkit skill/command.
// Small local/Qwen models under-trigger model-invoked skills, especially mid-plan; a
// short reminder injected at the moment of the prompt (max proximity to execution) fixes
// this far better than a paragraph the model may never load. Stays silent unless the
// prompt clearly matches, and stays short to preserve the tiny context budget.
// Output: hookSpecificOutput.additionalContext, or exit 0 (no injection).
'use strict';
const fs = require('fs');

let prompt = '';
try { prompt = (JSON.parse(fs.readFileSync(0, 'utf8') || '{}').prompt) || ''; } catch (_) { process.exit(0); }
const p = prompt.toLowerCase().trim();
if (!p || p.startsWith('/')) process.exit(0);            // already a command/skill, or empty
if (p.length < 12) process.exit(0);                      // trivial one-liners — don't nag

const rules = [
  [/\b(secur(e|ity)|vulnerab|exploit|injection|sql\s*inject|\bauthz?\b|authentication|owasp|cve|sanitiz|hardcoded|leak)/, '`/audit` (architecture+code security review)'],
  [/\b(from scratch|build me|implement|scaffold|create|write)\b[\s\S]{0,48}\b(app|application|service|api|cli|tool|module|feature|system|project|backend|server|library|package|pipeline|bot)\b/, '`/dev` (development mode — plan in main context, delegate to implementer subagents)'],
  [/\b(unit ?tests?|test coverage|coverage|tdd|test[- ]first|write tests|add tests|pytest|jest|vitest)\b/, '`/cover` (test-first, measured ≥90% coverage)'],
  [/\b(brainstorm|clarify requirements|what should|how should i (design|structure|approach)|figure out the design|requirements)\b/, '`/brainstorm` to nail the requirements, then `/plan`'],
  [/\b(plan|design|architect(ure)?|break (this|it) (down|into)|decompose)\b/, '`/plan` (dependency-ordered task list)'],
  [/\b(remember (this|that)|note this|save this (info|fact)|don'?t forget|keep this in mind|jot down)\b/, '`/pin` (remember it compaction-proof)'],
  [/\b(context (is )?(full|getting (full|long|big))|losing track|you forgot|compact(ion)?|running low on context)\b/, '`/checkpoint` (save durable state before it overflows)'],
];

const hits = [];
for (const [re, hint] of rules) { if (re.test(p) && !hits.includes(hint)) hits.push(hint); if (hits.length === 2) break; }
if (!hits.length) process.exit(0);

const msg =
  'Toolkit hint — this request may fit: ' + hits.join('; ') +
  '. Use it if it genuinely applies; for a quick question or a one-line edit, just answer directly (don\'t over-tool).';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
}));
