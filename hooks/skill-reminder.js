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

// Skills the model can invoke itself (via the skill tool) → "use it".
// Commands the model CANNOT invoke (user-only slash commands) → "suggest the user run it".
const rules = [
  [/\b(secur(e|ity)|vulnerab|exploit|injection|sql\s*inject|\bauthz?\b|authentication|owasp|cve|sanitiz|hardcoded|leak)/, 'invoke the `/audit` skill (security review of architecture + code)'],
  [/\b(from scratch|build me|implement|scaffold|create|write)\b[\s\S]{0,48}\b(app|application|service|api|cli|tool|module|feature|system|project|backend|server|library|package|pipeline|bot)\b/, 'suggest the user run `/dev` (development mode: plan in main context, delegate to implementer subagents) for this build'],
  [/\b(unit ?tests?|test coverage|coverage|tdd|test[- ]first|write tests|add tests|pytest|jest|vitest)\b/, 'suggest the user run `/cover` (test-first, measured ≥90% coverage)'],
  [/\b(brainstorm|clarify requirements|what should|how should i (design|structure|approach)|figure out the design|requirements)\b/, 'invoke the `/brainstorm` skill to nail the requirements first'],
  [/\b(plan|design|architect(ure)?|break (this|it) (down|into)|decompose)\b/, 'invoke the `/plan` skill (dependency-ordered task list)'],
  [/\b(please remember|remember:|remember (that|this|for|to|the|my|our|about|:)|note (that|this|down|:)|keep in mind|don'?t forget|save (this|that|the)|jot down|make a note)/, 'suggest the user run `/pin <fact>` to keep it compaction-proof in context (you can also save it to memory)'],
  [/\b(context (is )?(full|getting (full|long|big))|losing track|you forgot|compact(ion)?|running low on context)\b/, 'invoke the `/checkpoint` skill (save durable state before it overflows)'],
];

const hits = [];
for (const [re, hint] of rules) { if (re.test(p) && !hits.includes(hint)) hits.push(hint); if (hits.length === 2) break; }
if (!hits.length) process.exit(0);

const msg =
  'Toolkit hint — this request may fit: ' + hits.join('; ') +
  '. Do so only if it genuinely applies; for a quick question or one-line edit, just answer directly.';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
}));
