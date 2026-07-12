#!/usr/bin/env node
'use strict';
/*
 * qwen-dev-toolkit test harness — no dependencies, no network. Run:  node test/run.js
 * Covers: syntax of every JS file, hook behavior (secret-guard, skill-reminder,
 * agent-limit, git-branch-guard), /pin backend parity (sh+js), installer round-trip.
 * Everything runs against temp dirs; nothing touches the real ~/.qwen.
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qdt-test-'));
const runNode = (script, { input = '', env = {}, cwd, args = [] } = {}) =>
  cp.spawnSync('node', [script, ...args], { input, encoding: 'utf8', cwd, env: { ...process.env, ...env } });

// ---- syntax ----------------------------------------------------------------
console.log('— syntax —');
const jsFiles = [];
for (const d of ['hooks', 'commands']) {
  for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.js')) jsFiles.push(path.join(ROOT, d, f));
}
for (const f of ['install.js', 'uninstall.js', 'install-bootstrap.js']) jsFiles.push(path.join(ROOT, f));
for (const f of jsFiles) {
  const r = cp.spawnSync('node', ['--check', f], { encoding: 'utf8' });
  ok('node --check ' + path.relative(ROOT, f), r.status === 0, (r.stderr || '').split('\n')[0]);
}

// ---- manifest consistency ----------------------------------------------------
// Every agent file and skill dir must be listed in both install.js and uninstall.js,
// and frontmatter names must match the file/dir names — else installs silently drift.
console.log('— manifest consistency —');
const agentNames = fs.readdirSync(path.join(ROOT, 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
const skillNames = fs.readdirSync(path.join(ROOT, 'skills')).filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md')));
const installSrc = fs.readFileSync(path.join(ROOT, 'install.js'), 'utf8');
const uninstallSrc = fs.readFileSync(path.join(ROOT, 'uninstall.js'), 'utf8');
const unlisted = [];
for (const a of agentNames) { if (!installSrc.includes(`'${a}'`)) unlisted.push('install.js:' + a); if (!uninstallSrc.includes(`'${a}'`)) unlisted.push('uninstall.js:' + a); }
ok('every agents/*.md is in install+uninstall manifests', unlisted.length === 0, unlisted.join(', '));
const unlistedS = [];
for (const s of skillNames) { if (!installSrc.includes(`'${s}'`)) unlistedS.push('install.js:' + s); if (!uninstallSrc.includes(`'${s}'`)) unlistedS.push('uninstall.js:' + s); }
ok('every skills/ dir is in install+uninstall manifests', unlistedS.length === 0, unlistedS.join(', '));
// Every hook name install.js wires via setHook(...) must also be in uninstall.js's strip
// set, or `uninstall`/a fresh reinstall leaves a dangling settings.json entry behind
// silently (this exact gap shipped once — compact-warn was wired in install.js but never
// added to uninstall.js's names Set).
const hookNames = [...installSrc.matchAll(/setHook\([^,]+,\s*'[^']*'\s*,\s*'([^']+)'/g)].map((m) => m[1]);
const missingHooks = hookNames.filter((h) => !uninstallSrc.includes(`'${h}'`));
ok('every install.js setHook() name is in uninstall.js\'s strip set', missingHooks.length === 0, missingHooks.join(', '));
// install.js installs commands by scanning commands/ (no explicit list), so uninstall.js is
// the only manifest: every command .md and every _*.{sh,js} backend must be in its removal
// lists, or `uninstall`/reinstall orphans files (this gap shipped once — /autocompact and
// /toolkit-reset were never in CMD_MD/CMD_BACKENDS).
const cmdFiles = fs.readdirSync(path.join(ROOT, 'commands'));
const cmdMd = cmdFiles.filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => f.replace(/\.md$/, ''));
const cmdBackends = [...new Set(cmdFiles.filter((f) => f.startsWith('_') && (f.endsWith('.sh') || f.endsWith('.js'))).map((f) => f.replace(/\.(sh|js)$/, '')))];
const missingCmd = cmdMd.filter((c) => !new RegExp(`'${c}'`).test(uninstallSrc));
const missingBk = cmdBackends.filter((c) => !new RegExp(`'${c}'`).test(uninstallSrc));
ok('every command .md is in uninstall.js CMD_MD', missingCmd.length === 0, missingCmd.join(', '));
ok('every command backend is in uninstall.js CMD_BACKENDS', missingBk.length === 0, missingBk.join(', '));
// every toolkit command carries the 🧰 signature at the start of its description, so it reads
// as a toolkit command in the "/" palette without changing the command name (invocation).
const SIG = '🧰 '; // 🧰
const unsigned = cmdMd.filter((c) => {
  const m = fs.readFileSync(path.join(ROOT, 'commands', c + '.md'), 'utf8').match(/^description: (.*)$/m);
  return !m || !m[1].startsWith(SIG);
});
ok('every command .md description carries the toolkit signature', unsigned.length === 0, unsigned.join(', '));
// same class of gap for hook SCRIPT files: uninstall.js strips the settings.json entries by
// name, but the .js files under ~/.qwen/hooks are removed by an explicit list — every
// hooks/*.js must be in it or uninstall orphans the script (compact-warn/toolkit-reset-guard
// were once missing here).
const hookFiles = fs.readdirSync(path.join(ROOT, 'hooks')).filter((f) => f.endsWith('.js'));
const missingHookFiles = hookFiles.filter((h) => !uninstallSrc.includes(`'${h}'`));
ok('every hooks/*.js file is in uninstall.js\'s hook-file removal list', missingHookFiles.length === 0, missingHookFiles.join(', '));
// the 🧰 toolkit signature also goes on skills (SKILL.md description, shown in the "/" palette)
// and on the messages hooks surface (guards' deny reasons + the automation hooks' injected text).
const unsignedSkill = skillNames.filter((s) => {
  const m = fs.readFileSync(path.join(ROOT, 'skills', s, 'SKILL.md'), 'utf8').match(/^description: (.*)$/m);
  return !m || !m[1].startsWith(SIG);
});
ok('every skill SKILL.md description carries the toolkit signature', unsignedSkill.length === 0, unsignedSkill.join(', '));
const unsignedHook = hookFiles.filter((h) => !h.startsWith('_') && !fs.readFileSync(path.join(ROOT, 'hooks', h), 'utf8').includes('🧰'));
ok('every hook script carries the 🧰 signature in the text it surfaces', unsignedHook.length === 0, unsignedHook.join(', '));
const badFm = [];
for (const a of agentNames) { const b = fs.readFileSync(path.join(ROOT, 'agents', a + '.md'), 'utf8'); if (!b.startsWith('---') || !b.includes('name: ' + a + '\n') || !b.includes('tools:')) badFm.push(a); }
for (const s of skillNames) { const b = fs.readFileSync(path.join(ROOT, 'skills', s, 'SKILL.md'), 'utf8'); if (!b.startsWith('---') || !b.includes('name: ' + s + '\n')) badFm.push(s); }
ok('agent/skill frontmatter names match files', badFm.length === 0, badFm.join(', '));

// ---- secret-guard ----------------------------------------------------------
console.log('— secret-guard —');
const sg = path.join(ROOT, 'hooks', 'secret-guard.js');
const sgRun = (tool_name, tool_input) => runNode(sg, { input: JSON.stringify({ tool_name, tool_input }) }).stdout;
const SECRET = 'API_KEY="real1234secret5678abcd"';
ok('.env write allowed (sanctioned destination)', sgRun('write_file', { file_path: '/p/.env', content: SECRET }) === '');
ok('.env.local write allowed', sgRun('write_file', { file_path: '/p/.env.local', content: SECRET }) === '');
ok('.env.example write denied (gets committed)', sgRun('write_file', { file_path: '/p/.env.example', content: SECRET }).includes('"deny"'));
ok('source-file write denied', sgRun('write_file', { file_path: '/p/app.py', content: SECRET }).includes('"deny"'));
ok('placeholder value allowed', sgRun('write_file', { file_path: '/p/app.py', content: 'API_KEY="YOUR_KEY_HERE_1234567890"' }) === '');
ok('env-var indirection allowed', sgRun('write_file', { file_path: '/p/app.js', content: 'const key = process.env.API_KEY;' }) === '');
ok('AWS key in shell denied', sgRun('run_shell_command', { command: 'echo AKIAABCDEFGHIJKLMNOP' }).includes('"deny"'));
ok('ENCRYPTED private key denied', sgRun('write_file', { file_path: '/p/k.pem', content: '-----BEGIN ENCRYPTED PRIVATE KEY-----' }).includes('"deny"'));
ok('staging a .env file denied', sgRun('run_shell_command', { command: 'git add .env && git commit -m x' }).includes('"deny"'));
ok('read-only tool ignored', sgRun('read_file', { file_path: '/p/.env' }) === '');

// ---- skill-reminder ----------------------------------------------------------
console.log('— skill-reminder —');
const sr = path.join(ROOT, 'hooks', 'skill-reminder.js');
const srRun = (prompt) => runNode(sr, { input: JSON.stringify({ prompt }) }).stdout;
ok('security prompt nudges /audit', srRun('please check this code for sql injection vulnerabilities').includes('/audit'));
ok('build prompt nudges /implement', srRun('build me a small cli tool for tracking expenses').includes('/implement'));
ok('library question nudges researcher', srRun('how do I use pandas groupby with multiple keys here').includes('researcher'));
ok('doc-update prompt nudges /docs, not researcher', (() => { const o = srRun('update the readme for the new cli flags please'); return o.includes('/docs') && !o.includes('researcher'); })());
ok('release prompt nudges /release', srRun('can you cut a release and tag the new version on github').includes('/release'));
ok('requirements.txt prompt stays silent', srRun('pip install -r requirements.txt fails on my machine somehow') === '');
ok('short prompt stays silent', srRun('fix typo') === '');
ok('slash command stays silent', srRun('/implement build me an app with tests') === '');

// ---- agent-limit -------------------------------------------------------------
console.log('— agent-limit —');
const al = path.join(ROOT, 'hooks', 'agent-limit.js');
const alDir = tmp();
fs.writeFileSync(path.join(alDir, 'QWEN.md'), 'Subagent limit — at most 1 at a time\n');
const alRun = (mode) => runNode(al, { args: [mode], cwd: alDir, input: '{}' });
alRun('reset');
ok('first launch allowed', alRun('pre').stdout === '');
ok('second launch denied at cap', alRun('pre').stdout.includes('"deny"'));
alRun('post');
ok('slot freed after post', alRun('pre').stdout === '');
const lock = path.join(alDir, '.qwen', '.agentcount.lock');
fs.mkdirSync(lock, { recursive: true });
const old = new Date(Date.now() - 60000);
fs.utimesSync(lock, old, old);
const t0 = Date.now();
const alr = alRun('pre');
ok('stale lock stolen fast, still denies at cap', Date.now() - t0 < 900 && alr.stdout.includes('"deny"'), (Date.now() - t0) + 'ms');

// ---- git-branch-guard ----------------------------------------------------------
console.log('— git-branch-guard —');
const gb = path.join(ROOT, 'hooks', 'git-branch-guard.js');
const gitEnv = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const mkRepo = (branch) => {
  const d = tmp();
  cp.spawnSync('git', ['init', '-q', '-b', branch], { cwd: d, env: { ...process.env, ...gitEnv } });
  cp.spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: d, env: { ...process.env, ...gitEnv } });
  return d;
};
const devRepo = mkRepo('dev'), mainRepo = mkRepo('main');
const gh = tmp(); // isolated QWEN_HOME: no auth token
const gbRun = (command, dir, extraEnv = {}) =>
  runNode(gb, { input: JSON.stringify({ tool_name: 'run_shell_command', tool_input: { command, directory: dir } }), env: { QWEN_HOME: gh, ...extraEnv } }).stdout;
ok('push to origin main denied', gbRun('git push origin main', devRepo).includes('"deny"'));
ok('push to origin dev allowed', gbRun('git push origin dev', mainRepo) === '');
ok('bare push while ON main denied', gbRun('git push', mainRepo).includes('"deny"'));
ok('bare push while ON dev allowed', gbRun('git push', devRepo) === '');
ok('merge while ON main denied', gbRun('git merge dev', mainRepo).includes('"deny"'));
ok('merge while ON dev allowed', gbRun('git merge feature-x', devRepo) === '');
ok('switch-to-main + push one-liner denied', gbRun('git switch main && git push', devRepo).includes('"deny"'));
// single-use token: a push to main is authorized AND consumes the token, so the very next
// push is blocked again; a bare merge onto main does NOT consume it (so merge+push works).
const tok = path.join(gh, '.main-approval');
fs.writeFileSync(tok, '');
ok('token authorizes a main push', gbRun('git push origin main', devRepo) === '');
ok('the push consumed the token (single-use)', !fs.existsSync(tok));
ok('a second push without a fresh token is denied', gbRun('git push origin main', devRepo).includes('"deny"'));
// merge onto main with a token present is allowed but does NOT consume it...
fs.writeFileSync(tok, '');
ok('merge onto main is authorized by the token', gbRun('git merge dev', mainRepo) === '');
ok('a bare merge does not consume the token', fs.existsSync(tok));
// ...so the push that follows the merge is still covered by the same authorization, and consumes it
ok('the following push is still covered by the same token', gbRun('git push origin main', devRepo) === '');
ok('that push consumed the token', !fs.existsSync(tok));

// ---- release-guard -------------------------------------------------------------
console.log('— release-guard —');
const rg = path.join(ROOT, 'hooks', 'release-guard.js');
const rgRun = (command, dir) =>
  runNode(rg, { input: JSON.stringify({ tool_name: 'run_shell_command', tool_input: { command, directory: dir } }) }).stdout;
const gitC = (d, ...a) => cp.spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: d, env: { ...process.env, ...gitEnv } });
const relRepo = () => {
  const d = tmp();
  cp.spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: d, env: { ...process.env, ...gitEnv } });
  fs.writeFileSync(path.join(d, 'VERSION'), '1.0.0\n');
  gitC(d, 'add', '-A'); gitC(d, 'commit', '-q', '-m', 'v1');
  return d;
};
const rr = relRepo();
const rgOut = rgRun('git push origin main', rr);
ok('untagged VERSION on main push reminds', rgOut.includes('release-guard') && rgOut.includes('/release'));
gitC(rr, 'tag', 'v1.0.0');
ok('tagged & in-sync stays silent', rgRun('git push origin main', rr) === '');
gitC(rr, 'commit', '-q', '--allow-empty', '-m', 'more');
ok('code past released tag reminds to bump', rgRun('git push origin main', rr).includes('/changelog'));
ok('push to dev stays silent', rgRun('git push origin dev', relRepo()) === '');

// ---- /pin backends -------------------------------------------------------------
console.log('— /pin backends —');
for (const impl of (isWin ? ['js'] : ['sh', 'js'])) {
  const d = tmp();
  const pinRun = (...a) => (impl === 'sh'
    ? cp.spawnSync('bash', [path.join(ROOT, 'commands', '_pin.sh'), ...a], { cwd: d, encoding: 'utf8' })
    : cp.spawnSync('node', [path.join(ROOT, 'commands', '_pin.js'), ...a], { cwd: d, encoding: 'utf8' })).stdout;
  pinRun('deploy', 'server', '10.0.0.5');
  pinRun('ssh', 'user', 'mark');
  ok(impl + ': pin + list works', pinRun('list').includes('10.0.0.5'));
  ok(impl + ': bare remove shows usage', pinRun('remove').includes('usage'));
  pinRun('remove', 'memory'); // matches only the header text — must be a no-op
  const facts = fs.readFileSync(path.join(d, 'FACTS.md'), 'utf8');
  ok(impl + ': header survives a matching remove', facts.startsWith('# Project memory'));
  pinRun('remove', 'mark');
  const f2 = fs.readFileSync(path.join(d, 'FACTS.md'), 'utf8');
  ok(impl + ': removes the right fact only', !f2.includes('mark') && f2.includes('10.0.0.5'));
  ok(impl + ': gitignore wired', fs.readFileSync(path.join(d, '.gitignore'), 'utf8').includes('FACTS.md'));
}

// ---- installer round-trip ---------------------------------------------------------
console.log('— installer round-trip —');
const qh2 = tmp();
const ri = cp.spawnSync('node', [path.join(ROOT, 'install.js')], { env: { ...process.env, QWEN_HOME: qh2 }, encoding: 'utf8' });
ok('install exits 0', ri.status === 0, (ri.stderr || '').slice(0, 160));
ok('skills installed', fs.existsSync(path.join(qh2, 'skills', 'implement', 'SKILL.md')));
ok('agents installed', fs.existsSync(path.join(qh2, 'agents', 'debugger.md')) && fs.existsSync(path.join(qh2, 'agents', 'tester.md')));
ok('hooks wired into settings.json', fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('git-branch-guard'));
ok('QWEN.md guidance added', fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8').includes('qwen-dev-toolkit:start'));
// /reality (integrity mode) is a toggle, OFF by default — the honesty directive must NOT
// sit in the always-on QWEN.md block; it only appears once the user runs /reality.
ok('reality-mode is OFF by default (not in the always-on block)', !fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8').includes('Reality mode — ACTIVE'));
// _reality.sh and _reality.js are parallel independent backends (like /cover), so the
// installer ships only the OS-appropriate one: .sh on POSIX, .js on Windows.
ok('reality backend installed for this OS',
  fs.existsSync(path.join(qh2, 'commands', process.platform === 'win32' ? '_reality.js' : '_reality.sh')));
// /applied: Node logic ships on every OS (like /autocompact — it parses settings.json),
// and the install records its version so /applied can report it.
ok('applied Node logic installed alongside the wrapper',
  fs.existsSync(path.join(qh2, 'commands', '_applied.js')) &&
  (process.platform === 'win32' || fs.existsSync(path.join(qh2, 'commands', '_applied.sh'))));
ok('install records .toolkit-version', fs.readFileSync(path.join(qh2, '.toolkit-version'), 'utf8').trim() === fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim());
// /hooks: Node backend + shared catalog on every OS, and the hooks/_hookutil.js self-disable helper
ok('hooks backend + shared catalog + hook util installed',
  fs.existsSync(path.join(qh2, 'commands', '_hooks.js')) && fs.existsSync(path.join(qh2, 'commands', '_hookcat.js')) && fs.existsSync(path.join(qh2, 'hooks', '_hookutil.js')));
// /autocompact: the .sh is a thin wrapper over the Node logic, so BOTH files must land
// on POSIX; and a fresh install must default auto-compaction to OFF (threshold 1).
ok('autocompact Node logic installed alongside the wrapper',
  fs.existsSync(path.join(qh2, 'commands', '_autocompact.js')) &&
  (process.platform === 'win32' || fs.existsSync(path.join(qh2, 'commands', '_autocompact.sh'))));
ok('auto-compaction OFF by default on fresh install',
  JSON.parse(fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8')).context.autoCompactThreshold === 1);
{
  const st = cp.spawnSync('node', [path.join(ROOT, 'commands', '_autocompact.js'), 'status'], { env: { ...process.env, QWEN_HOME: qh2 }, encoding: 'utf8' });
  ok('autocompact status reads the installed default', (st.stdout || '').includes('auto-compaction OFF'));
}
// /toolkit-reset: same dual-backend shape as /autocompact, plus its own guard hook.
ok('toolkit-reset Node logic installed alongside the wrapper',
  fs.existsSync(path.join(qh2, 'commands', '_toolkit-reset.js')) &&
  (process.platform === 'win32' || fs.existsSync(path.join(qh2, 'commands', '_toolkit-reset.sh'))));
ok('toolkit-reset-guard hook wired into settings.json', fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('toolkit-reset-guard'));
const ru = cp.spawnSync('node', [path.join(ROOT, 'uninstall.js')], { env: { ...process.env, QWEN_HOME: qh2 }, encoding: 'utf8' });
ok('uninstall exits 0', ru.status === 0);
ok('uninstall removes skills', !fs.existsSync(path.join(qh2, 'skills', 'implement')));
ok('uninstall strips hook entries', !fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('git-branch-guard'));
ok('uninstall strips toolkit-reset-guard entry too', !fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('toolkit-reset-guard'));
ok('uninstall removes the /applied backend files', !fs.existsSync(path.join(qh2, 'commands', '_applied.js')) && !fs.existsSync(path.join(qh2, 'commands', '_applied.sh')));
ok('uninstall removes the /hooks backend + shared catalog + hook util', !fs.existsSync(path.join(qh2, 'commands', '_hooks.js')) && !fs.existsSync(path.join(qh2, 'commands', '_hookcat.js')) && !fs.existsSync(path.join(qh2, 'hooks', '_hookutil.js')));
ok('uninstall removes hook script files (compact-warn/toolkit-reset-guard)', !fs.existsSync(path.join(qh2, 'hooks', 'compact-warn.js')) && !fs.existsSync(path.join(qh2, 'hooks', 'toolkit-reset-guard.js')));
ok('uninstall removes the recorded .toolkit-version', !fs.existsSync(path.join(qh2, '.toolkit-version')));

// ---- /reality — integrity-over-agreement toggle, OFF by default, per-project block ------
console.log('— /reality —');
{
  const rl = path.join(ROOT, 'commands', '_reality.js');
  const proj = tmp(); fs.mkdirSync(proj, { recursive: true });
  const qf = path.join(proj, 'QWEN.md');
  const run = (arg) => cp.spawnSync('node', [rl, ...(arg ? [arg] : [])], { cwd: proj, encoding: 'utf8' });
  // status before anything: OFF, and nothing written
  ok('reality status is OFF by default', /OFF/.test(run('status').stdout) && !fs.existsSync(qf));
  // on: pins the realitymode block with the honesty directive
  const on = run('on');
  ok('reality on reports ON', /now ON/.test(on.stdout));
  ok('reality on pins the realitymode block', fs.readFileSync(qf, 'utf8').includes('<!-- realitymode:start -->') && fs.readFileSync(qf, 'utf8').includes('integrity over agreement'));
  ok('reality status now reads ON', /ON/.test(run('status').stdout));
  // idempotent: a second `on` must not duplicate the block
  run('on');
  ok('reality on is idempotent (single block)', fs.readFileSync(qf, 'utf8').split('realitymode:start').length - 1 === 1);
  // off: removes the block, back to OFF
  const off = run('off');
  ok('reality off reports OFF', /now OFF/.test(off.stdout));
  ok('reality off removes the block', !fs.readFileSync(qf, 'utf8').includes('realitymode:start'));
  ok('reality off when already off is a clean no-op', /already OFF/.test(run('off').stdout));
}

// ---- /applied — read-only introspection of what the toolkit currently applies ---------
console.log('— /applied —');
{
  const qhA = tmp();
  cp.spawnSync('node', [path.join(ROOT, 'install.js')], { env: { ...process.env, QWEN_HOME: qhA }, encoding: 'utf8' });
  const ap = path.join(ROOT, 'commands', '_applied.js');
  const proj = tmp(); fs.mkdirSync(proj, { recursive: true });
  const run = (arg) => cp.spawnSync('node', [ap, ...(arg ? [arg] : [])], { cwd: proj, env: { ...process.env, QWEN_HOME: qhA }, encoding: 'utf8' }).stdout;
  // default scope = project; global settings-driven guards/hooks show in both scopes
  const p = run('');
  ok('applied defaults to PROJECT scope', /scope: PROJECT/.test(p));
  ok('applied lists guards/prohibitions', /Guards \/ prohibitions/.test(p) && /secret-guard/.test(p) && /git-branch-guard/.test(p) && /toolkit-reset-guard/.test(p));
  ok('applied lists automation hooks', /Automation hooks/.test(p) && /restore-progress/.test(p));
  ok('applied reports the recorded toolkit version', new RegExp('Toolkit version: ' + fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim().replace(/\./g, '\\.')).test(p));
  // reflects a per-project mode toggle
  cp.spawnSync('node', [path.join(ROOT, 'commands', '_reality.js'), 'on'], { cwd: proj, encoding: 'utf8' });
  cp.spawnSync('node', [path.join(ROOT, 'commands', '_maxagents.js'), '2'], { cwd: proj, encoding: 'utf8' });
  const p2 = run('');
  ok('applied reflects an enabled mode (reality ON)', /Reality mode\.* ON/.test(p2));
  ok('applied reflects maxagents limit', /at most 2 at a time/.test(p2));
  // read-only: running /applied must not mutate the project QWEN.md
  const before = fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8');
  run(''); run('global');
  ok('applied is read-only (QWEN.md unchanged)', fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8') === before);
  // global scope reads ~/.qwen/QWEN.md, not the project's
  ok('applied global switches scope', /scope: GLOBAL/.test(run('global')));
  ok('applied global does not show the project-only reality block as ON', /Reality mode\.* OFF/.test(run('global')));
}

// ---- /hooks — turn guards/automation off & on; hooks self-disable via .hooks-disabled ---
console.log('— /hooks —');
{
  const qhH = tmp();
  cp.spawnSync('node', [path.join(ROOT, 'install.js')], { env: { ...process.env, QWEN_HOME: qhH }, encoding: 'utf8' });
  const hk = path.join(ROOT, 'commands', '_hooks.js');
  const run = (args) => cp.spawnSync('node', [hk, ...args], { env: { ...process.env, QWEN_HOME: qhH }, encoding: 'utf8' }).stdout;
  const disabledFile = path.join(qhH, '.hooks-disabled');
  // status lists guards + automation, all ON on a fresh install
  const st = run(['status']);
  ok('hooks status lists guards and automation', /Guards \/ prohibitions/.test(st) && /Automation/.test(st) && /secret-guard/.test(st) && /restore-progress/.test(st));
  ok('hooks all ON by default (no state file)', /All hooks are ON/.test(st) && !fs.existsSync(disabledFile));
  // disable one -> written to the state file, shown OFF. Use toolkit-reset-guard: its deny
  // condition (confirm with no approval token) is deterministic, so the self-disable is
  // provable both ways (baseline denies, disabled allows, re-enabled denies again).
  const grd = path.join(ROOT, 'hooks', 'toolkit-reset-guard.js');
  const denyCmd = { tool_name: 'run_shell_command', tool_input: { command: 'node ~/.qwen/commands/_toolkit-reset.js confirm' } };
  const seg = () => cp.spawnSync('node', [grd], { input: JSON.stringify(denyCmd), env: { ...process.env, QWEN_HOME: qhH }, encoding: 'utf8' }).stdout;
  ok('baseline: guard blocks before any toggle', /deny/.test(seg()));
  run(['off', 'toolkit-reset-guard']);
  ok('off <name> writes the disabled state file', fs.existsSync(disabledFile) && /toolkit-reset-guard/.test(fs.readFileSync(disabledFile, 'utf8')));
  ok('status shows the guard as OFF', /\[OFF\] toolkit-reset-guard/.test(run(['status'])));
  ok('disabled guard no longer blocks (self-disabled, allows)', seg() === '');
  // re-enable and confirm it blocks again (proves the toggle is real, not a broken guard)
  run(['on', 'toolkit-reset-guard']);
  ok('on <name> removes it from the state file', !fs.existsSync(disabledFile) || !/toolkit-reset-guard/.test(fs.readFileSync(disabledFile, 'utf8')));
  ok('re-enabled guard blocks again', /deny/.test(seg()));
  // off guards disables every guard at once
  run(['off', 'guards']);
  const body = fs.readFileSync(disabledFile, 'utf8');
  ok('off guards disables all five guards', ['secret-guard', 'git-branch-guard', 'release-guard', 'toolkit-reset-guard', 'agent-limit-pre'].every((g) => body.includes(g)));
  // /applied surfaces the disabled guards loudly
  const proj = tmp(); fs.mkdirSync(proj, { recursive: true });
  const ap = cp.spawnSync('node', [path.join(ROOT, 'commands', '_applied.js')], { cwd: proj, env: { ...process.env, QWEN_HOME: qhH }, encoding: 'utf8' }).stdout;
  ok('applied flags disabled guards', /DISABLED via \/hooks/.test(ap) && /guard\(s\) currently DISABLED/.test(ap));
  // on (no arg) restores everything and clears the file
  run(['on']);
  ok('on clears all disabled state', !fs.existsSync(disabledFile));
  // guardrails: unknown name and a bare "off" are refused without mutating
  ok('unknown hook name is rejected', /unknown hook/.test(run(['off', 'bogus'])) && !fs.existsSync(disabledFile));
  ok('bare "off" is refused (no accidental nuke)', /specify what to turn off/.test(run(['off'])) && !fs.existsSync(disabledFile));
}

// ---- /toolkit-reset — reset the toolkit to the current version's defaults, per scope -----
// Scopes: project (default; this project's ./QWEN.md toggle blocks) and global (~/.qwen
// QWEN.md drift + toolkit-managed settings: re-enable hooks, autoCompactThreshold default).
// Mandatory preview -> confirm; the token remembers the previewed scope.
console.log('— /toolkit-reset —');
const tkReset = path.join(ROOT, 'commands', '_toolkit-reset.js');
const MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning', 'realitymode'];
const seedStale = (file) => {
  const blocks = MARKERS.map((m) => `<!-- ${m}:start -->\nstale ${m} content\n<!-- ${m}:end -->\n`).join('\n');
  fs.writeFileSync(file, `# my own notes\nkeep this line.\n\n${blocks}\nand this trailing note.\n`);
};
const tkRun = (args, qh, cwd) => cp.spawnSync('node', [tkReset, ...args], { env: { ...process.env, QWEN_HOME: qh }, cwd: cwd || process.cwd(), encoding: 'utf8' });
const tokenOf = (qh) => path.join(qh, '.toolkit-reset-approval');

// === GLOBAL scope ===
// (a) confirm with NO prior preview must refuse; the global QWEN.md stays untouched.
{
  const qh = tmp(); seedStale(path.join(qh, 'QWEN.md'));
  const r = tkRun(['confirm'], qh);
  ok('confirm with no prior preview is refused', /no pending approval/.test(r.stdout));
  ok('refused confirm leaves the global QWEN.md untouched', MARKERS.every((m) => fs.readFileSync(path.join(qh, 'QWEN.md'), 'utf8').includes(`${m}:start`)));
}
// (b) global preview: WARNS it is destructive + asks; lists blocks AND settings resets;
//     mutates nothing; arms a token that records scope=global.
const gq = tmp();
seedStale(path.join(gq, 'QWEN.md'));
fs.writeFileSync(path.join(gq, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 0.7 } }, null, 2));
fs.writeFileSync(path.join(gq, '.hooks-disabled'), 'secret-guard\ngit-branch-guard\n');
{
  const r = tkRun(['global'], gq);
  ok('global preview warns it is destructive and asks to confirm', /⚠|WARNING/.test(r.stdout) && /confirm/i.test(r.stdout));
  ok('global preview lists the stale blocks', MARKERS.every((m) => r.stdout.includes(m)));
  ok('global preview lists the settings resets', /autoCompactThreshold/.test(r.stdout) && /re-enable 2 disabled hook/.test(r.stdout));
  ok('global preview mutates nothing', MARKERS.every((m) => fs.readFileSync(path.join(gq, 'QWEN.md'), 'utf8').includes(`${m}:start`)) && fs.existsSync(path.join(gq, '.hooks-disabled')));
  ok('global preview arms token with scope=global', fs.readFileSync(tokenOf(gq), 'utf8').trim() === 'global');
}
// (c) global confirm: removes blocks, keeps prose, resets settings, consumes the token.
{
  const r = tkRun(['confirm'], gq);
  ok('global confirm reports done', /reset done \(global scope\)/.test(r.stdout));
  const body = fs.readFileSync(path.join(gq, 'QWEN.md'), 'utf8');
  ok('global confirm removes all stale blocks', MARKERS.every((m) => !body.includes(`${m}:start`)));
  ok('global confirm keeps the user prose', body.includes('keep this line.') && body.includes('and this trailing note.'));
  ok('global confirm re-enables hooks (clears .hooks-disabled)', !fs.existsSync(path.join(gq, '.hooks-disabled')));
  ok('global confirm resets autoCompactThreshold to default 1', JSON.parse(fs.readFileSync(path.join(gq, 'settings.json'), 'utf8')).context.autoCompactThreshold === 1);
  ok('global confirm consumes the token', !fs.existsSync(tokenOf(gq)));
  ok('a second confirm right after is refused', /no pending approval/.test(tkRun(['confirm'], gq).stdout));
}
// (d) an expired token (>15 min) is treated as no approval.
{
  const qh = tmp(); seedStale(path.join(qh, 'QWEN.md'));
  tkRun(['global'], qh);
  const old = new Date(Date.now() - 16 * 60 * 1000); fs.utimesSync(tokenOf(qh), old, old);
  ok('confirm refuses an expired (>15min) token', /no pending approval/.test(tkRun(['confirm'], qh).stdout));
}
// (e) nothing to reset (clean QWEN.md, default settings) -> clean report, no token armed.
{
  const qh = tmp(); fs.writeFileSync(path.join(qh, 'QWEN.md'), '# nothing stale\n');
  const r = tkRun(['global'], qh);
  ok('global with nothing to reset reports clean', /nothing to reset/.test(r.stdout));
  ok('no token armed when nothing to reset', !fs.existsSync(tokenOf(qh)));
}

// === PROJECT scope ===
// project preview/confirm operate on the CWD's ./QWEN.md and must NOT touch global settings.
{
  const qh = tmp();
  fs.writeFileSync(path.join(qh, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 0.7 } }, null, 2));
  fs.writeFileSync(path.join(qh, '.hooks-disabled'), 'secret-guard\n');
  fs.writeFileSync(path.join(qh, 'QWEN.md'), '<!-- bromode:start -->\nstale GLOBAL block\n<!-- bromode:end -->\n');
  const proj = tmp(); seedStale(path.join(proj, 'QWEN.md'));
  const p = tkRun([], qh, proj); // no arg -> project scope
  ok('project preview warns and asks to confirm', /⚠|WARNING/.test(p.stdout) && /confirm/i.test(p.stdout));
  ok('project preview arms token with scope=project', fs.readFileSync(tokenOf(qh), 'utf8').trim() === 'project');
  const c = tkRun(['confirm'], qh, proj);
  ok('project confirm reports done (project scope)', /reset done \(project scope\)/.test(c.stdout));
  ok('project confirm removes blocks from the project QWEN.md', MARKERS.every((m) => !fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8').includes(`${m}:start`)));
  ok('project confirm keeps the project prose', fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8').includes('keep this line.'));
  ok('project scope does NOT touch global settings', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).context.autoCompactThreshold === 0.7 && fs.existsSync(path.join(qh, '.hooks-disabled')));
  ok('project scope does NOT touch the global QWEN.md', fs.readFileSync(path.join(qh, 'QWEN.md'), 'utf8').includes('bromode:start'));
}
// global scope must NOT touch the project's ./QWEN.md (isolation the other way).
{
  const qh = tmp(); seedStale(path.join(qh, 'QWEN.md'));
  const proj = tmp();
  const projFile = path.join(proj, 'QWEN.md');
  fs.writeFileSync(projFile, '<!-- realitymode:start -->\nlive project toggle, must survive\n<!-- realitymode:end -->\n');
  const before = fs.readFileSync(projFile, 'utf8');
  tkRun(['global'], qh, proj); tkRun(['confirm'], qh, proj);
  ok('global reset never touches the project QWEN.md', fs.readFileSync(projFile, 'utf8') === before);
}

// ---- toolkit-reset-guard hook — engine-level backstop, model can't skip the window ----
console.log('— toolkit-reset-guard —');
const trg = path.join(ROOT, 'hooks', 'toolkit-reset-guard.js');
{
  const qh = tmp(); fs.mkdirSync(qh, { recursive: true });
  const run = (command) => runNode(trg, { input: JSON.stringify({ tool_name: 'run_shell_command', tool_input: { command } }), env: { QWEN_HOME: qh } }).stdout;
  ok('confirm attempt with no token is denied', run('node ~/.qwen/commands/_toolkit-reset.js confirm').includes('"deny"'));
  ok('preview-only invocation (no confirm) is always allowed', run('node ~/.qwen/commands/_toolkit-reset.js') === '');
  ok('unrelated command is a no-op', run('ls -la') === '');
  ok('unrelated tool is a no-op', runNode(trg, { input: JSON.stringify({ tool_name: 'write_file', tool_input: { command: '_toolkit-reset.js confirm' } }), env: { QWEN_HOME: qh } }).stdout === '');
  fs.writeFileSync(path.join(qh, '.toolkit-reset-approval'), '');
  ok('confirm attempt allowed within a valid approval window', run('bash ~/.qwen/commands/_toolkit-reset.sh confirm') === '');
  const old = new Date(Date.now() - 16 * 60 * 1000);
  fs.utimesSync(path.join(qh, '.toolkit-reset-approval'), old, old);
  ok('confirm attempt denied once the approval window expires', run('node _toolkit-reset.js confirm').includes('"deny"'));
}

// ---- summary ------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
