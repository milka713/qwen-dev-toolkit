#!/usr/bin/env node
// PreToolUse hook for qwen-code — deterministic secrets guard.
// Blocks write_file / edit / run_shell_command when the content being written (or the
// shell command) contains a hardcoded credential, or when a command tries to commit an
// obvious secret file. This enforces "no keys in code, no secrets in the repo" at the
// engine level instead of relying on the model to remember.
// Output: deny via hookSpecificOutput.permissionDecision; otherwise exit 0 (allow).
'use strict';
const fs = require('fs');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { process.exit(0); }

const tool = input.tool_name || '';
// Only guard tools that can write code or run commands.
if (!/^(write_file|edit|replace|run_shell_command)$/.test(tool)) process.exit(0);

// Writing a secret into a local gitignored .env file is exactly the pattern this guard
// tells the model to use — don't block the sanctioned destination itself. (.env.example
// and friends stay guarded: those files get committed.)
if (/^(write_file|edit|replace)$/.test(tool)) {
  const ti0 = input.tool_input || {};
  const fp = String(ti0.file_path || ti0.path || ti0.absolute_path || '');
  const base = fp.split(/[\\/]/).pop() || '';
  if (/^\.env(\..+)?$/.test(base) && !/example|sample|template|dist/i.test(base)) process.exit(0);
}

// Collect the raw string values from tool_input (robust to exact field names across
// write_file/edit/run_shell_command) and scan them — scanning raw strings, not a
// JSON.stringify, keeps real quotes intact so quote-based patterns still match.
const strings = [];
(function collect(v) {
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
})(input.tool_input || {});
const text = strings.join('\n');
if (!text) process.exit(0);

// High-confidence credential patterns (low false-positive).
const SECRETS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----/, 'a private key'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'an Anthropic API key'],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/, 'an OpenAI API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{50,}/, 'a GitHub fine-grained token'],
  [/\bglpat-[A-Za-z0-9_-]{20,}/, 'a GitLab token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bsk_live_[A-Za-z0-9]{20,}/, 'a Stripe live key'],
  [/\bhf_[A-Za-z0-9]{30,}/, 'a Hugging Face token'],
];

let hit = null;
for (const [re, label] of SECRETS) { if (re.test(text)) { hit = label; break; } }

// Generic high-entropy assignment to a secret-ish name, excluding obvious placeholders
// and env-var indirection (which is the *correct* pattern we want to encourage).
if (!hit) {
  const re = /(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?key|auth[_-]?token)["'\s]*[:=]\s*["']([^"']{20,})["']/i;
  const m = text.match(re);
  if (m) {
    const v = m[1];
    const placeholder = /your|example|placeholder|change[_-]?me|xxxx|\*\*\*|dummy|sample|redacted|insert|todo|fixme|replace|fake|<|>|\$\{|process\.env|os\.environ|getenv|import\.meta\.env/i.test(v);
    const looksReal = /[A-Za-z]/.test(v) && /[0-9]/.test(v);
    if (!placeholder && looksReal) hit = 'a hardcoded secret value';
  }
}

// Committing obvious secret files.
if (!hit && tool === 'run_shell_command') {
  if (/\bgit\s+(?:add|commit)\b[^\n]*(?:\.env(?:\.[\w.]+)?|id_rsa|id_ed25519|[\w.-]+\.(?:pem|key|p12|pfx|keystore)|credentials(?:\.json)?|secrets?\.(?:ya?ml|json|txt))\b/.test(text)) {
    hit = 'a secret file being staged/committed';
  }
}

if (!hit) process.exit(0); // allow

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'qwen-dev-toolkit secret-guard blocked this: it looks like ' + hit + '. Never hardcode secrets or commit them — read the value from an environment variable (e.g. process.env / os.environ) or a secrets manager, keep it in a gitignored .env, and pin only its *location* with /pin. If this is a false positive (a placeholder or test fixture), make that obvious (e.g. use YOUR_KEY_HERE) and retry.',
  },
}));
