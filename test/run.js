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
// every toolkit command carries the [toolkit] signature at the start of its description, so it
// reads as a toolkit command in the "/" palette without changing the command name (invocation).
const SIG = '[toolkit] ';
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
// the [toolkit] signature also goes on skills (SKILL.md description, shown in the "/" palette)
// and on the messages hooks surface (guards' deny reasons + the automation hooks' injected text).
const unsignedSkill = skillNames.filter((s) => {
  const m = fs.readFileSync(path.join(ROOT, 'skills', s, 'SKILL.md'), 'utf8').match(/^description: (.*)$/m);
  return !m || !m[1].startsWith(SIG);
});
ok('every skill SKILL.md description carries the toolkit signature', unsignedSkill.length === 0, unsignedSkill.join(', '));
const unsignedHook = hookFiles.filter((h) => !h.startsWith('_') && !fs.readFileSync(path.join(ROOT, 'hooks', h), 'utf8').includes('[toolkit]'));
ok('every hook script carries the [toolkit] signature in the text it surfaces', unsignedHook.length === 0, unsignedHook.join(', '));
// every hook file carries a "managed file" banner so anyone hand-editing it sees it's from the toolkit
const unbannered = hookFiles.filter((h) => !fs.readFileSync(path.join(ROOT, 'hooks', h), 'utf8').includes('qwen-dev-toolkit — MANAGED FILE'));
ok('every hook file carries the managed-file banner', unbannered.length === 0, unbannered.join(', '));
// command backend scripts (_*.js/_*.sh) get the same managed-file banner — they're hand-editable logic too
const cmdBackendFiles = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.startsWith('_') && (f.endsWith('.js') || f.endsWith('.sh')));
const unbanneredCmd = cmdBackendFiles.filter((f) => !fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8').includes('qwen-dev-toolkit — MANAGED FILE'));
ok('every command backend carries the managed-file banner', unbanneredCmd.length === 0, unbanneredCmd.join(', '));
// backends are Node-only: every _*.sh must be a thin exec-node wrapper around its .js twin
// (a parallel bash implementation is drift waiting to happen — Node is a hard prerequisite).
const fatSh = cmdBackendFiles.filter((f) => f.endsWith('.sh') && !fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8').includes('exec node'));
ok('every .sh backend is a thin exec-node wrapper (logic lives in the .js)', fatSh.length === 0, fatSh.join(', '));
const orphanSh = cmdBackendFiles.filter((f) => f.endsWith('.sh') && !cmdBackendFiles.includes(f.replace(/\.sh$/, '.js')));
ok('every .sh wrapper has its .js twin', orphanSh.length === 0, orphanSh.join(', '));
// the extension manifest version must track VERSION (it once sat 7 minors behind)
ok('qwen-extension.json version matches VERSION',
  JSON.parse(fs.readFileSync(path.join(ROOT, 'qwen-extension.json'), 'utf8')).version === fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim());
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
ok('connection-string password denied', sgRun('write_file', { file_path: '/p/db.py', content: 'DSN = "postgres://admin:S3cretPass99@db.example.com:5432/app"' }).includes('"deny"'));
ok('connection-string env indirection allowed', sgRun('write_file', { file_path: '/p/db.py', content: 'DSN = "postgres://admin:${DB_PASS}@db.example.com/app"' }) === '');
ok('connection-string placeholder allowed', sgRun('write_file', { file_path: '/p/db.py', content: 'DSN = "postgres://admin:CHANGE_ME_1234@db/app"' }) === '');
ok('digits-only userinfo (host:port style) allowed', sgRun('write_file', { file_path: '/p/x.js', content: 'const u = "http://user:12345678@host/path"' }) === '');

// ---- devmode-guard ---------------------------------------------------------
console.log('— devmode-guard —');
const dg = path.join(ROOT, 'hooks', 'devmode-guard.js');
const dgDir = tmp();
fs.writeFileSync(path.join(dgDir, 'QWEN.md'), 'proj\n<!-- devmode:start -->\nDEV\n<!-- devmode:end -->\n');
fs.mkdirSync(path.join(dgDir, '.qwen'), { recursive: true });
const dgRun = (tool_name, file_path, env = {}) =>
  runNode(dg, { input: JSON.stringify({ tool_name, tool_input: { file_path }, cwd: dgDir }), cwd: dgDir, env }).stdout;
ok('devmode ON: architect source write denied', dgRun('write_file', 'src/app.py').includes('"deny"'));
ok('devmode ON: architect test write denied', dgRun('edit', 'tests/test_app.py').includes('"deny"'));
ok('devmode ON: subagent write allowed (QWEN_CODE_AGENT_ID set)',
  dgRun('write_file', 'src/app.py', { QWEN_CODE_AGENT_ID: 'implementer-abc123' }) === '');
ok('devmode ON: architect PROGRESS.md write allowed', dgRun('write_file', '.qwen/PROGRESS.md') === '');
ok('devmode ON: architect QWEN.md write allowed', dgRun('write_file', 'QWEN.md') === '');
ok('devmode ON: architect FACTS.md write allowed', dgRun('edit', 'FACTS.md') === '');
ok('non-write tool ignored', dgRun('run_shell_command', 'src/app.py') === '');
// no devmode block → guard is inert even for the architect
const dgDir2 = tmp();
fs.writeFileSync(path.join(dgDir2, 'QWEN.md'), 'no dev mode here\n');
ok('devmode OFF: architect source write allowed',
  runNode(dg, { input: JSON.stringify({ tool_name: 'write_file', tool_input: { file_path: 'src/app.py' }, cwd: dgDir2 }), cwd: dgDir2 }).stdout === '');
// /devedit escape: stage a token, one architect edit passes, then it's spent (single-use)
const de = path.join(ROOT, 'commands', '_devedit.js');
fs.writeFileSync(path.join(dgDir, '.qwen', 'PROGRESS.md'), '# P\n## 🔄 Log\n');
const deOut = runNode(de, { args: ['fixing a one-char typo in a generated file'], cwd: dgDir }).stdout;
ok('devedit refuses without a reason', runNode(de, { args: [], cwd: dgDir }).stdout.includes('reason is required'));
ok('devedit authorises one edit + logs to PROGRESS.md',
  deOut.includes('ONE direct edit authorised') && fs.readFileSync(path.join(dgDir, '.qwen', 'PROGRESS.md'), 'utf8').includes('devmode escape'));
ok('devedit token lets exactly ONE architect source write through', dgRun('write_file', 'src/app.py') === '');
ok('devedit token is single-use (next write denied again)', dgRun('write_file', 'src/app.py').includes('"deny"'));

// ---- terminal-guard --------------------------------------------------------
console.log('— terminal-guard —');
const tg = path.join(ROOT, 'hooks', 'terminal-guard.js');
const tgRun = (command, permission_mode) => runNode(tg, { input: JSON.stringify({ tool_name: 'run_shell_command', tool_input: { command }, permission_mode }) }).stdout;
const OSA = 'osascript -e \'tell application "Terminal" to activate\' -e \'tell application "Terminal" to do script "xz -dc img.xz | sudo dd of=/dev/rdisk2"\'';
const OPENC = 'chmod +x /tmp/x.command && open -a Terminal /tmp/x.command';
ok('handoff (osascript do script) BLOCKED in auto', tgRun(OSA, 'auto').includes('"deny"'));
ok('handoff (open -a Terminal) BLOCKED in yolo', tgRun(OPENC, 'yolo').includes('"deny"'));
ok('handoff (keystroke to Terminal) BLOCKED in auto', tgRun('osascript -e \'tell process "Terminal" to keystroke "dd"\'', 'auto').includes('"deny"'));
ok('handoff ALLOWED in default mode (user confirms there)', tgRun(OSA, 'default') === '');
ok('handoff ALLOWED in auto-edit (shell still prompts)', tgRun(OSA, 'auto-edit') === '');
ok('non-handoff command allowed even in yolo', tgRun('ls -la /tmp', 'yolo') === '');
ok('unrelated osascript (no Terminal) allowed in auto', tgRun('osascript -e \'display notification "hi"\'', 'auto') === '');
ok('missing permission_mode is treated as not-auto/yolo (allow)', tgRun(OSA, undefined) === '');

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
// Russian prompts must trigger the same rules (JS \b is ASCII-only and never fires next
// to Cyrillic — this suite locks in that the Russian alternations avoid \b correctly).
ok('russian tests prompt nudges /cover', srRun('напиши юнит тесты для этого модуля с покрытием').includes('/cover'));
ok('russian remember prompt nudges /pin', srRun('запомни что мы деплоим только по пятницам').includes('/pin'));
ok('russian security prompt nudges /audit', srRun('проверь безопасность этого кода на уязвимости').includes('/audit'));
ok('russian build prompt nudges /implement', srRun('сделай мне с нуля приложение для заметок').includes('/implement'));
ok('russian plan prompt nudges /plan', srRun('составь план как разбить эту задачу на части').includes('/plan'));
ok('russian review prompt nudges /review', srRun('сделай ревью последних изменений в коде').includes('/review'));
ok('english review prompt nudges /review', srRun('review my code changes before I push please').includes('/review'));
ok('russian small talk stays silent', srRun('спасибо большое за помощь с этим проектом') === '');
ok('russian explainer stays silent', srRun('объясни как работает event loop в ноде') === '');
// research (stuck) + terminal (disk/flash) rules, both languages
ok('english stuck prompt nudges /research', srRun('this keeps failing and I have no idea why').includes('/research'));
ok('russian stuck prompt nudges /research', srRun('не работает, не могу починить уже час').includes('/research'));
ok('english flash-image prompt nudges /terminal', srRun('write the ubuntu image to the sd card with dd').includes('/terminal'));
ok('russian format-card prompt nudges /terminal', srRun('отформатируй карту и прошей туда образ распбери').includes('/terminal'));

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
// Honesty (reality) and research-first are now standing directives, ON by default in every
// project — so their text MUST live in the always-on global QWEN.md guidance (a project opts
// out per-project). This is the inverse of the old default-off reality toggle.
ok('honesty directive is ON by default (in the always-on global QWEN.md)', /Honesty over agreement/.test(fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8')));
ok('research-first directive is ON by default (in the always-on global QWEN.md)', /Think & research before flailing/.test(fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8')));
ok('terminal-handoff awareness is in the global QWEN.md', /Can't run it yourself/.test(fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8')) && fs.existsSync(path.join(qh2, 'skills', 'terminal', 'SKILL.md')));
ok('terminal skill requires explicit confirm + notes auto/yolo disabled', (() => { const s = fs.readFileSync(path.join(qh2, 'skills', 'terminal', 'SKILL.md'), 'utf8'); return /Always confirm before you hand off/.test(s) && /Disabled in auto \/ yolo/.test(s); })());
ok('terminal-guard hook installed + wired', fs.existsSync(path.join(qh2, 'hooks', 'terminal-guard.js')) && fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('terminal-guard'));
ok('commit skill requires a body for non-trivial commits', /required for any non-trivial commit/.test(fs.readFileSync(path.join(ROOT, 'skills', 'commit', 'SKILL.md'), 'utf8')));
// Backends are Node-only: every _*.js ships on every OS; the thin _*.sh wrappers ship
// on POSIX only (Windows rewrites the .md commands to call node directly).
ok('reality backend installed (js everywhere, sh wrapper on POSIX only)',
  fs.existsSync(path.join(qh2, 'commands', '_reality.js')) &&
  (process.platform === 'win32'
    ? !fs.existsSync(path.join(qh2, 'commands', '_reality.sh'))
    : fs.existsSync(path.join(qh2, 'commands', '_reality.sh'))));
ok('all Node backends installed on every OS',
  ['_bro.js', '_cover.js', '_main-push.js', '_maxagents.js', '_mode-toggle.js', '_pin.js', '_status.js', '_versioning.js', '_qdt.js', '_stateview.js', '_doctor.js']
    .every((f) => fs.existsSync(path.join(qh2, 'commands', f))));
ok('checkpoint-nudge Stop hook installed + wired',
  fs.existsSync(path.join(qh2, 'hooks', 'checkpoint-nudge.js')) &&
  fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('checkpoint-nudge'));
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
// seed the global QWEN.md with a stale toolkit toggle block + a foreign block + user prose:
// uninstall must clear every toolkit marker but never touch anything else
fs.appendFileSync(path.join(qh2, 'QWEN.md'),
  '\n<!-- devmode:start -->\nstale dev block\n<!-- devmode:end -->\n' +
  '<!-- mycustomtool:start -->\nforeign block\n<!-- mycustomtool:end -->\nuser prose survives\n');
const ru = cp.spawnSync('node', [path.join(ROOT, 'uninstall.js')], { env: { ...process.env, QWEN_HOME: qh2 }, encoding: 'utf8' });
ok('uninstall exits 0', ru.status === 0);
{
  const q = fs.readFileSync(path.join(qh2, 'QWEN.md'), 'utf8');
  ok('uninstall clears stale toolkit toggle blocks from the global QWEN.md', !q.includes('devmode:start'));
  ok('uninstall keeps foreign blocks and user prose', q.includes('mycustomtool:start') && q.includes('user prose survives'));
}
ok('uninstall removes skills', !fs.existsSync(path.join(qh2, 'skills', 'implement')));
ok('uninstall strips hook entries', !fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('git-branch-guard'));
ok('uninstall strips toolkit-reset-guard entry too', !fs.readFileSync(path.join(qh2, 'settings.json'), 'utf8').includes('toolkit-reset-guard'));
ok('uninstall removes the /applied backend files', !fs.existsSync(path.join(qh2, 'commands', '_applied.js')) && !fs.existsSync(path.join(qh2, 'commands', '_applied.sh')));
ok('uninstall removes the /hooks backend + shared catalog + hook util', !fs.existsSync(path.join(qh2, 'commands', '_hooks.js')) && !fs.existsSync(path.join(qh2, 'commands', '_hookcat.js')) && !fs.existsSync(path.join(qh2, 'hooks', '_hookutil.js')));
ok('uninstall removes hook script files (compact-warn/toolkit-reset-guard)', !fs.existsSync(path.join(qh2, 'hooks', 'compact-warn.js')) && !fs.existsSync(path.join(qh2, 'hooks', 'toolkit-reset-guard.js')));
ok('uninstall removes the recorded .toolkit-version', !fs.existsSync(path.join(qh2, '.toolkit-version')));

// ---- /reality — honesty directive, ON by default, per-project OPT-OUT block ------------
console.log('— /reality —');
{
  const rl = path.join(ROOT, 'commands', '_reality.js');
  const proj = tmp(); fs.mkdirSync(proj, { recursive: true });
  const qf = path.join(proj, 'QWEN.md');
  const run = (arg) => cp.spawnSync('node', [rl, ...(arg ? [arg] : [])], { cwd: proj, encoding: 'utf8' });
  // default: ON everywhere, and status writes nothing
  ok('reality status is ON by default', /ON \(default/.test(run('status').stdout) && !fs.existsSync(qf));
  // off: pins the realityoff opt-out block
  const off = run('off');
  ok('reality off reports OFF for this project', /now OFF/.test(off.stdout));
  ok('reality off pins the realityoff opt-out block', fs.readFileSync(qf, 'utf8').includes('<!-- realityoff:start -->'));
  ok('reality status now reads OFF', /OFF/.test(run('status').stdout));
  // idempotent: a second `off` must not duplicate the opt-out
  run('off');
  ok('reality off is idempotent (single opt-out block)', fs.readFileSync(qf, 'utf8').split('realityoff:start').length - 1 === 1);
  // on: removes the opt-out, back to the default ON
  const on = run('on');
  ok('reality on reports back ON', /back ON/.test(on.stdout));
  ok('reality on removes the opt-out block', !fs.readFileSync(qf, 'utf8').includes('realityoff:start'));
  ok('reality on when already on is a clean no-op', /is ON/.test(run('on').stdout));
  // a legacy default-off `realitymode` ON-block (now redundant) is swept on use
  fs.writeFileSync(qf, '<!-- realitymode:start -->\nold\n<!-- realitymode:end -->\n');
  run('status');
  ok('legacy realitymode ON-block is swept on use', !fs.readFileSync(qf, 'utf8').includes('realitymode:start'));
}

// ---- /research — research-first directive, ON by default, per-project OPT-OUT block ----
console.log('— /research —');
{
  const rl = path.join(ROOT, 'commands', '_research.js');
  const proj = tmp(); fs.mkdirSync(proj, { recursive: true });
  const qf = path.join(proj, 'QWEN.md');
  const run = (arg) => cp.spawnSync('node', [rl, ...(arg ? [arg] : [])], { cwd: proj, encoding: 'utf8' });
  ok('research status is ON by default', /ON \(default/.test(run('status').stdout) && !fs.existsSync(qf));
  const off = run('off');
  ok('research off reports OFF for this project', /now OFF/.test(off.stdout));
  ok('research off pins the researchoff opt-out block', fs.readFileSync(qf, 'utf8').includes('<!-- researchoff:start -->'));
  ok('research status now reads OFF', /OFF/.test(run('status').stdout));
  run('off');
  ok('research off is idempotent (single opt-out block)', fs.readFileSync(qf, 'utf8').split('researchoff:start').length - 1 === 1);
  const on = run('on');
  ok('research on reports back ON', /back ON/.test(on.stdout));
  ok('research on removes the opt-out block', !fs.readFileSync(qf, 'utf8').includes('researchoff:start'));
  ok('research on when already on is a clean no-op', /is ON/.test(run('on').stdout));
  // the research skill ships and is signed
  ok('research skill is present + signed', /^description: \[toolkit\] /m.test(fs.readFileSync(path.join(ROOT, 'skills', 'research', 'SKILL.md'), 'utf8')));
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
  // reflects a per-project mode toggle (a per-project OPT-OUT of the default-on honesty mode)
  cp.spawnSync('node', [path.join(ROOT, 'commands', '_reality.js'), 'off'], { cwd: proj, encoding: 'utf8' });
  cp.spawnSync('node', [path.join(ROOT, 'commands', '_maxagents.js'), '2'], { cwd: proj, encoding: 'utf8' });
  const p2 = run('');
  ok('applied reflects a per-project opt-out (honesty OFF here)', /Honesty \(reality\)\.* OFF/.test(p2));
  ok('applied reflects maxagents limit', /at most 2 at a time/.test(p2));
  // read-only: running /applied must not mutate the project QWEN.md
  const before = fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8');
  run(''); run('global');
  ok('applied is read-only (QWEN.md unchanged)', fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8') === before);
  // global scope reads ~/.qwen/QWEN.md, not the project's
  ok('applied global switches scope', /scope: GLOBAL/.test(run('global')));
  ok('applied global shows honesty ON by default (no project opt-out)', /Honesty \(reality\)\.* ON/.test(run('global')));
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
const MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning', 'realitymode', 'realityoff', 'researchoff'];
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

// ---- /toolkit-reset undo — reverts the last confirm, one level ----------------
console.log('— /toolkit-reset undo —');
{
  // project scope: confirm removes blocks; undo restores the exact prior QWEN.md
  const qh = tmp(); fs.mkdirSync(qh, { recursive: true });
  const proj = tmp();
  const pf = path.join(proj, 'QWEN.md');
  fs.writeFileSync(pf, '# notes\nmanual prose\n\n<!-- devmode:start -->\nDEV\n<!-- devmode:end -->\n<!-- realitymode:start -->\nR\n<!-- realitymode:end -->\n');
  const before = fs.readFileSync(pf, 'utf8');
  tkRun([], qh, proj); tkRun(['confirm'], qh, proj);
  ok('undo: confirm removed the project blocks', !fs.readFileSync(pf, 'utf8').includes('devmode:start'));
  ok('undo: a backup snapshot was written', fs.existsSync(path.join(qh, '.toolkit-reset-backup')));
  const u = tkRun(['undo'], qh, proj);
  ok('undo restores the project QWEN.md byte-for-byte', fs.readFileSync(pf, 'utf8') === before);
  ok('undo reports what it restored', /undo done \(project scope\)/.test(u.stdout));
  ok('undo consumes the backup (one level)', !fs.existsSync(path.join(qh, '.toolkit-reset-backup')));
  ok('a second undo says nothing to undo', /nothing to undo/.test(tkRun(['undo'], qh, proj).stdout));
}
{
  // global scope: undo restores .hooks-disabled and autoCompactThreshold too
  const qh = tmp();
  fs.writeFileSync(path.join(qh, 'QWEN.md'), '<!-- versioning:start -->\nv\n<!-- versioning:end -->\n');
  fs.writeFileSync(path.join(qh, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 0.7 } }, null, 2));
  fs.writeFileSync(path.join(qh, '.hooks-disabled'), 'secret-guard\n');
  tkRun(['global'], qh); tkRun(['confirm'], qh);
  ok('undo(global): confirm cleared .hooks-disabled', !fs.existsSync(path.join(qh, '.hooks-disabled')));
  ok('undo(global): confirm reset autoCompactThreshold to 1', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).context.autoCompactThreshold === 1);
  tkRun(['undo'], qh);
  ok('undo(global) restores .hooks-disabled', fs.existsSync(path.join(qh, '.hooks-disabled')) && fs.readFileSync(path.join(qh, '.hooks-disabled'), 'utf8').includes('secret-guard'));
  ok('undo(global) restores autoCompactThreshold to 0.7', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).context.autoCompactThreshold === 0.7);
  ok('undo(global) restores the versioning block', fs.readFileSync(path.join(qh, 'QWEN.md'), 'utf8').includes('versioning:start'));
}

// ---- checkpoint-nudge — Stop hook that keeps .qwen/PROGRESS.md fresh -----------
console.log('— checkpoint-nudge —');
{
  const cn = path.join(ROOT, 'hooks', 'checkpoint-nudge.js');
  const run = (cwd, extra) => runNode(cn, { input: JSON.stringify(Object.assign({ cwd }, extra || {})) }).stdout;
  const mkProj = () => { const d = tmp(); fs.mkdirSync(path.join(d, '.qwen'), { recursive: true }); return d; };
  const setProgress = (d, body) => { const p = path.join(d, '.qwen', 'PROGRESS.md'); fs.writeFileSync(p, body); return p; };
  const backdate = (p) => { const old = new Date('2020-01-01'); fs.utimesSync(p, old, old); };

  ok('no PROGRESS.md → silent', run(mkProj()) === '');
  {
    const d = mkProj(); setProgress(d, '## Goal\nX\n- [x] a\n- [ ] b\n');
    ok('PROGRESS fresh, no code edited after it → silent', run(d) === '');
  }
  {
    const d = mkProj(); const p = setProgress(d, '## Goal\nX\n- [x] a\n- [ ] b\n');
    fs.writeFileSync(path.join(d, 'app.js'), 'console.log(1)\n'); backdate(p);
    ok('code newer than checkpoint + unchecked tasks → block', run(d).includes('"block"'));
    ok('nudge is loop-safe under stop_hook_active', run(d, { stop_hook_active: true }) === '');
  }
  {
    const d = mkProj(); const p = setProgress(d, '## Goal\nX\n- [x] a\n- [x] b\n');
    fs.writeFileSync(path.join(d, 'app.js'), 'x\n'); backdate(p);
    ok('all tasks done → silent even with code drift', run(d) === '');
  }
  {
    const d = mkProj(); const p = setProgress(d, '## Goal\nX\n- [ ] b\n');
    fs.writeFileSync(path.join(d, 'notes.txt'), 'hi\n'); backdate(p);
    ok('only non-code files changed → silent', run(d) === '');
  }
  {
    const qh = tmp(); fs.writeFileSync(path.join(qh, '.hooks-disabled'), 'checkpoint-nudge\n');
    const d = mkProj(); const p = setProgress(d, '## Goal\nX\n- [ ] b\n');
    fs.writeFileSync(path.join(d, 'app.js'), 'x\n'); backdate(p);
    ok('disabled via /hooks → silent', runNode(cn, { input: JSON.stringify({ cwd: d }), env: { QWEN_HOME: qh } }).stdout === '');
  }
  // context-fill guard (qwen-code 0.20.x sends context_usage on Stop)
  {
    const d = mkProj(); // no PROGRESS.md, no code drift — fill guard fires on usage alone
    ok('context ~92% full → block to checkpoint', run(d, { context_usage: 0.92 }).includes('"block"') && run(d, { context_usage: 0.92 }).includes('% full'));
    ok('context 50% full → silent', run(d, { context_usage: 0.5 }) === '');
    ok('no context_usage field (old qwen) → silent (graceful)', run(d, {}) === '');
    ok('fill guard loop-safe under stop_hook_active', run(d, { context_usage: 0.95, stop_hook_active: true }) === '');
  }
}

// ---- /sudo-on + /sudo-off — DANGEROUS opt-in full-root toggle (confirm-gated) -------
console.log('— sudo-on / sudo-off —');
{
  const sc = path.join(ROOT, 'commands', '_sudoctl.js');
  const qh = tmp(); fs.mkdirSync(qh, { recursive: true });
  const run = (...args) => cp.spawnSync('node', [sc, ...args], { env: { ...process.env, QWEN_HOME: qh, NO_COLOR: '1' }, encoding: 'utf8' }).stdout;
  const has = (f) => fs.existsSync(path.join(qh, f));

  ok('status is OFF by default', /sudo is OFF/.test(run('on', 'status')));
  // arm: warns, stages a pending password, activates nothing
  const armed = run('on', 's3cret-pw');
  ok('sudo-on <pw> shows the danger warning', /EXTREME DANGER/.test(armed) && /IRREVERSIBLY/.test(armed));
  ok('sudo-on <pw> stages a pending file, nothing active yet', has('.sudo-pending') && !has('.sudo-askpass') && !has('.sudo-pass'));
  ok('sudo-on <pw> does NOT echo the password back', !armed.includes('s3cret-pw'));
  ok('status reflects PENDING', /PENDING/.test(run('on', 'status')));
  // confirm: activate
  const active = run('on', 'confirm');
  ok('confirm reports sudo ACTIVE', /sudo ACTIVE/.test(active) && /FULL PASSWORDLESS ROOT/.test(active));
  ok('confirm writes askpass (0700) + pass (0600)', has('.sudo-askpass') && has('.sudo-pass') &&
    (fs.statSync(path.join(qh, '.sudo-askpass')).mode & 0o777) === 0o700 &&
    (fs.statSync(path.join(qh, '.sudo-pass')).mode & 0o777) === 0o600);
  ok('confirm consumes the pending file', !has('.sudo-pending'));
  ok('confirm pins a sudomode block into the global QWEN.md', /<!-- sudomode:start -->/.test(fs.readFileSync(path.join(qh, 'QWEN.md'), 'utf8')));
  ok('askpass helper returns the stored password', cp.spawnSync('sh', [path.join(qh, '.sudo-askpass')], { encoding: 'utf8' }).stdout === 's3cret-pw');
  ok('status now reads ACTIVE', /ACTIVE/.test(run('on', 'status')));
  // off: wipe everything
  run('off');
  ok('sudo-off wipes password + askpass', !has('.sudo-pass') && !has('.sudo-askpass'));
  ok('sudo-off removes the sudomode block', !/sudomode:start/.test(fs.readFileSync(path.join(qh, 'QWEN.md'), 'utf8')));
  ok('confirm with no pending is refused', /nothing to confirm/.test(run('on', 'confirm')));
  // an expired pending (>5 min) can't be confirmed
  fs.writeFileSync(path.join(qh, '.sudo-pending'), 'x');
  const old = new Date(Date.now() - 6 * 60 * 1000);
  fs.utimesSync(path.join(qh, '.sudo-pending'), old, old);
  ok('expired pending is refused at confirm', /nothing to confirm/.test(run('on', 'confirm')) && !has('.sudo-askpass'));
}

// ---- compact-warn — warns AND latches auto-compaction off when it's ineffective -----
console.log('— compact-warn —');
{
  const cw = path.join(ROOT, 'hooks', 'compact-warn.js');
  const mkTranscript = (orig, next) => { const f = path.join(tmp(), 't.jsonl'); fs.writeFileSync(f, JSON.stringify({ type: 'chat_compression', systemPayload: { info: { originalTokenCount: orig, newTokenCount: next } } }) + '\n'); return f; };
  const run = (qh, transcript) => runNode(cw, { input: JSON.stringify({ source: 'compact', transcript_path: transcript }), env: { QWEN_HOME: qh } }).stdout;
  // ineffective (5% reduction) with auto-compaction ON → warn + disable + preserve other keys
  {
    const qh = tmp(); fs.writeFileSync(path.join(qh, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 0.7 }, keepme: 1 }));
    const out = run(qh, mkTranscript(1000, 950));
    ok('compact-warn warns on <15% reduction', out.includes('compaction warning'));
    ok('compact-warn latches auto-compaction OFF (threshold → 1)', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).context.autoCompactThreshold === 1);
    ok('compact-warn says it turned auto-compaction off', out.includes('turned OFF'));
    ok('compact-warn preserves other settings keys', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).keepme === 1);
  }
  // healthy (50% reduction) → silent, threshold untouched
  {
    const qh = tmp(); fs.writeFileSync(path.join(qh, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 0.7 } }));
    ok('compact-warn silent on a healthy compaction', run(qh, mkTranscript(1000, 500)) === '');
    ok('compact-warn leaves threshold alone when compaction was healthy', JSON.parse(fs.readFileSync(path.join(qh, 'settings.json'), 'utf8')).context.autoCompactThreshold === 0.7);
  }
  // already off (threshold 1) → still warns, message notes it is already off
  {
    const qh = tmp(); fs.writeFileSync(path.join(qh, 'settings.json'), JSON.stringify({ context: { autoCompactThreshold: 1 } }));
    const out = run(qh, mkTranscript(1000, 950));
    ok('compact-warn still warns when auto-compaction already off', out.includes('compaction warning') && out.includes('already off'));
  }
}

// ---- /status — merged snapshot incl. active plan/dev progress ------------------
console.log('— /status —');
{
  const qh = tmp(); fs.mkdirSync(qh, { recursive: true });
  cp.spawnSync('node', [path.join(ROOT, 'install.js')], { env: { ...process.env, QWEN_HOME: qh }, encoding: 'utf8' });
  const st = path.join(ROOT, 'commands', '_status.js');
  const proj = tmp();
  const run = (arg) => cp.spawnSync('node', [st, ...(arg ? [arg] : [])], { cwd: proj, env: { ...process.env, QWEN_HOME: qh }, encoding: 'utf8' }).stdout;
  // dev mode on + an active plan with mixed progress
  cp.spawnSync('node', [path.join(ROOT, 'commands', '_mode-toggle.js'), 'devmode', path.join(ROOT, 'commands', '_devmode.block'), 'Development mode', 'on'], { cwd: proj, encoding: 'utf8' });
  fs.mkdirSync(path.join(proj, '.qwen'), { recursive: true });
  fs.writeFileSync(path.join(proj, '.qwen', 'PROGRESS.md'), '## Goal\nBuild the API\n\n- [x] scaffold\n- [x] db\n- [ ] endpoints\n- [ ] auth\n');
  const p = run('');
  ok('status shows PROJECT scope header', /scope: PROJECT/.test(p));
  ok('status shows development mode ON', /Development mode\.* ON/.test(p));
  ok('status shows honesty + research ON by default', /Honesty \(reality\)\.* ON/.test(p) && /Research-first\.* ON/.test(p));
  ok('status shows the active plan goal', /Active plan \/ development/.test(p) && /Build the API/.test(p));
  ok('status shows plan progress counts + percent', /2 done, 2 remaining \(50% complete\)/.test(p));
  ok('status shows the next unchecked task', /Next\.* endpoints/.test(p));
  ok('status shows global guards', /Guards \/ prohibitions/.test(p) && /secret-guard/.test(p));
  ok('status reports the toolkit version', new RegExp('Toolkit version: ' + fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim().replace(/\./g, '\\.')).test(p));
  // read-only
  const before = fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8');
  run(''); run('global');
  ok('status is read-only (QWEN.md unchanged)', fs.readFileSync(path.join(proj, 'QWEN.md'), 'utf8') === before);
  ok('status global switches scope and hides the project plan', /scope: GLOBAL/.test(run('global')) && !/Active plan/.test(run('global')));
  // /applied still works but is a deprecated alias of the same report
  const ap = cp.spawnSync('node', [path.join(ROOT, 'commands', '_applied.js')], { cwd: proj, env: { ...process.env, QWEN_HOME: qh }, encoding: 'utf8' }).stdout;
  ok('/applied still works as a deprecated alias', /deprecated/.test(ap) && /scope: PROJECT/.test(ap) && /Guards \/ prohibitions/.test(ap));
}

// ---- /doctor — self-diagnostic health check -----------------------------------
console.log('— /doctor —');
{
  const qh = tmp(); fs.mkdirSync(qh, { recursive: true });
  cp.spawnSync('node', [path.join(ROOT, 'install.js')], { env: { ...process.env, QWEN_HOME: qh }, encoding: 'utf8' });
  const doc = path.join(ROOT, 'commands', '_doctor.js');
  const run = () => cp.spawnSync('node', [doc], { env: { ...process.env, QWEN_HOME: qh }, cwd: tmp(), encoding: 'utf8' }).stdout;
  const healthy = run();
  ok('doctor emits a DOCTOR_REPORT', /DOCTOR_REPORT/.test(healthy));
  ok('doctor confirms hooks wired on a fresh install', /all \d+ toolkit hooks wired/.test(healthy));
  ok('doctor confirms install integrity', /hook scripts: all \d+ present/.test(healthy) && /command backends: all \d+ present/.test(healthy));
  ok('doctor reports the installed version', /installed version: /.test(healthy));
  // break the install: a wired hook whose file is missing → doctor FAILs
  fs.unlinkSync(path.join(qh, 'hooks', 'secret-guard.js'));
  const broken = run();
  ok('doctor FAILs when a hook file is missing', /✗/.test(broken) && /problem\(s\)/.test(broken));
  // disabled guard → warning
  fs.writeFileSync(path.join(qh, '.hooks-disabled'), 'git-branch-guard\n');
  ok('doctor WARNs about a disabled guard', /DISABLED via \/hooks: git-branch-guard/.test(run()));
}

// ---- summary ------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
