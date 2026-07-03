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
fs.writeFileSync(path.join(gh, '.main-approval'), '');
ok('token window authorizes main push', gbRun('git push origin main', devRepo) === '');
fs.unlinkSync(path.join(gh, '.main-approval'));

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
const ru = cp.spawnSync('node', [path.join(ROOT, 'uninstall.js')], { env: { ...process.env, QWEN_HOME: qh2 }, encoding: 'utf8' });
ok('uninstall exits 0', ru.status === 0);
ok('uninstall removes skills', !fs.existsSync(path.join(qh2, 'skills', 'implement')));
ok('uninstall strips hook entries', !fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('git-branch-guard'));

// ---- summary ------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
