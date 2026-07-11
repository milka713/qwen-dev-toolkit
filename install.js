#!/usr/bin/env node
'use strict';
/*
 * qwen-dev-toolkit cross-platform installer / updater (macOS · Linux · Windows).
 * Run:  node install.js         (or the install.sh / install.cmd wrappers)
 *
 * INSTALL and UPDATE are the same command — re-running it updates in place. It copies ONLY
 * this toolkit's own skills/subagents/commands/hooks into ~/.qwen and idempotently merges
 * its hook + memory settings and its QWEN.md block. It NEVER deletes skills/commands/agents
 * that aren't part of this toolkit, and never touches your API keys, env vars, other
 * settings, memories, or .qwen/PROGRESS.md files. Safe to re-run.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const SRC = __dirname;
const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const isWin = process.platform === 'win32';
const VERSION = read(path.join(SRC, 'VERSION')).trim() || '?';
// --reset (also bare "reset"): in addition to the normal install/update below, sweep any
// toolkit-managed marker block out of the GLOBAL QWEN.md that current versions only ever
// pin PROJECT-locally. This exists because a flag's scope has moved before (/bro: global
// in versions <1.8.0, project-local from 1.8.0 on) and left orphaned blocks behind that no
// command manages anymore — e.g. a stale "/bro свобода" that keeps applying everywhere
// even though /bro now only affects the current project. Safe to re-run; a no-op when
// there is nothing stale.
const DO_RESET = process.argv.slice(2).some((a) => /^(--)?reset$/i.test(a));

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
function exists(p) { try { fs.statSync(p); return true; } catch (_) { return false; } }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copy(src, dst) { fs.copyFileSync(src, dst); }
function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }
function has(cmd, args) { try { const r = cp.spawnSync(cmd, args, { encoding: 'utf8', shell: isWin }); return r.status === 0 ? (r.stdout || r.stderr || '').trim().split('\n')[0] : null; } catch (_) { return null; } }

// ---- 0) dependency check -------------------------------------------------
console.log(`\nqwen-dev-toolkit installer/updater v${VERSION}  →  ${QHOME}\n(platform: ${process.platform})\n`);
const nodeV = process.version;
const gitV = has('git', ['--version']);
const qwenV = has('qwen', ['--version']);
console.log('Dependencies:');
console.log(`  ✓ node ${nodeV}`);
console.log(gitV ? `  ✓ ${gitV}` : '  ✗ git NOT found — needed for /gitflow, /commit, /toolkit-update');
console.log(qwenV ? `  ✓ qwen-code ${qwenV}` : '  ✗ qwen-code (qwen) NOT found — this toolkit extends it');
if (!gitV || !qwenV) {
  console.log('\n  Missing dependencies — install them, then re-run:');
  if (!qwenV) console.log('    • qwen-code:  npm install -g @qwen-code/qwen-code   (or: brew install qwen-code)');
  if (!gitV) console.log(isWin ? '    • git:  winget install Git.Git   (or https://git-scm.com/download/win)'
                                : '    • git:  brew install git   /   sudo apt install git');
  console.log('  (Continuing the install anyway — the files will be in place once the deps are added.)');
}

// ---- 1) directories ------------------------------------------------------
for (const d of ['skills', 'agents', 'commands', 'hooks']) mkdirp(path.join(QHOME, d));

// ---- 2) clean only OUR renamed/removed files from older releases ---------
// (targeted — we never wipe a whole dir, so any OTHER skills/commands you have are kept)
rm(path.join(QHOME, 'skills', 'dev'));                       // /dev became a command
for (const f of ['_dev-toggle.sh', '_covermode.block', 'mainok.md', '_mainok.sh', '_mainok.js']) {
  rm(path.join(QHOME, 'commands', f));                       // renamed/superseded
}

// ---- 3) skills, subagents, hooks -----------------------------------------
// Skills are copied as-is on POSIX. On Windows, backend invocations inside skill bodies
// (e.g. /implement's `bash "$HOME/.qwen/commands/_mode-toggle.sh" ...`) are rewritten to
// the Node backends with a real absolute path — same idea as the command rewiring below,
// but targeted so prose that merely mentions $HOME is left alone.
const qhomeFwdEarly = QHOME.replace(/\\/g, '/');
const winSkillBody = (body) =>
  body.replace(/bash "\$HOME\/\.qwen\/commands\/([^"]+)\.sh"/g, 'node "' + qhomeFwdEarly + '/commands/$1.js"')
      .replace(/"\$HOME\/\.qwen\//g, '"' + qhomeFwdEarly + '/'); // remaining quoted args (e.g. a block file)
const SKILLS = ['implement', 'plan', 'checkpoint', 'audit', 'brainstorm', 'gitflow', 'commit', 'review', 'docs', 'changelog', 'release', 'toolkit-update'];
for (const s of SKILLS) {
  const srcF = path.join(SRC, 'skills', s, 'SKILL.md');
  if (!exists(srcF)) continue;
  mkdirp(path.join(QHOME, 'skills', s));
  const dst = path.join(QHOME, 'skills', s, 'SKILL.md');
  if (isWin) fs.writeFileSync(dst, winSkillBody(read(srcF))); else copy(srcF, dst);
}
const AGENTS = ['implementer', 'scout', 'debugger', 'tester', 'researcher', 'verifier'];
for (const a of AGENTS) { const f = path.join(SRC, 'agents', a + '.md'); if (exists(f)) copy(f, path.join(QHOME, 'agents', a + '.md')); }
for (const h of fs.readdirSync(path.join(SRC, 'hooks')).filter((f) => f.endsWith('.js'))) copy(path.join(SRC, 'hooks', h), path.join(QHOME, 'hooks', h));

// ---- 4) commands — per-OS wiring -----------------------------------------
// The .md command files call a backend via qwen's `!{...}` shell step. On macOS/Linux that
// backend is a bash `_*.sh` (unchanged). On Windows (no bash), we ship Node `_*.js` backends
// and rewrite the .md to invoke `node` with an absolute path (no $HOME to expand).
const cmdDir = path.join(SRC, 'commands');
const qhomeFwd = QHOME.replace(/\\/g, '/');           // absolute install dir, forward slashes
for (const md of fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md'))) {
  let body = read(path.join(cmdDir, md));
  if (isWin) {
    // bash -> node, .sh -> .js, and resolve "$HOME/.qwen" to the real install dir (so it
    // works with no $HOME expansion in cmd/PowerShell, and with a custom QWEN_HOME).
    body = body.replace(/!\{bash /g, '!{node ')
               .replace(/\.sh"/g, '.js"')
               .replace(/\$HOME\/\.qwen/g, qhomeFwd)
               .replace(/\$HOME/g, os.homedir().replace(/\\/g, '/'));
  }
  fs.writeFileSync(path.join(QHOME, 'commands', md), body);
}
// backends: bash set on posix, node set on windows; _devmode.block on both.
const backendExt = isWin ? '.js' : '.sh';
// Node files needed on EVERY OS: _qdt.js (shared helper) and any _*.js that is the real
// logic behind a thin .sh wrapper (e.g. _autocompact.sh just execs _autocompact.js —
// JSON editing needs a real parser, and Node is a hard toolkit prerequisite anyway).
const ALWAYS_COPY = new Set(['_qdt.js', '_autocompact.js']);
for (const f of fs.readdirSync(cmdDir)) {
  if (f.endsWith('.md')) continue;
  const isBackend = f.startsWith('_') && (f.endsWith('.sh') || f.endsWith('.js'));
  if (isBackend && !f.endsWith(backendExt) && !ALWAYS_COPY.has(f)) continue; // skip the other OS's backends
  copy(path.join(cmdDir, f), path.join(QHOME, 'commands', f)); // _*.<ext>, ALWAYS_COPY, _devmode.block
}
if (!isWin) { for (const f of fs.readdirSync(path.join(QHOME, 'commands')).filter((x) => x.endsWith('.sh'))) { try { fs.chmodSync(path.join(QHOME, 'commands', f), 0o755); } catch (_) {} } }

console.log('\nInstalled:');
console.log(`  ✓ skills   (${SKILLS.join(', ')})`);
console.log(`  ✓ agents   (${AGENTS.join(', ')})`);
console.log('  ✓ commands (/dev, /cover, /pin, /status, /maxagents, /bro, /main-push, /versioning, /autocompact)  [' + (isWin ? 'Node backends' : 'bash backends') + ']');
console.log('  ✓ hooks    (restore, compaction-steer, compact-warn, secret-guard, git-branch-guard, release-guard, skill-reminder, agent-limit)');

// ---- 5) merge hooks + memory into settings.json --------------------------
(function mergeSettings() {
  const file = path.join(QHOME, 'settings.json');
  let s = {};
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  const hooksDir = path.join(QHOME, 'hooks');
  const entry = (script, name, matcher) => {
    const [f, ...rest] = script.split(' ');
    const full = path.join(hooksDir, f).replace(/\\/g, '/'); // forward slashes work on all OSes
    const command = 'node "' + full + '"' + (rest.length ? ' ' + rest.join(' ') : '');
    const g = { hooks: [{ type: 'command', command, name }] };
    if (matcher) g.matcher = matcher;
    return g;
  };
  s.hooks = s.hooks || {};
  const setHook = (event, script, name, matcher) => {
    const others = (s.hooks[event] || []).filter((g) => !(g.hooks || []).some((h) => h.name === name));
    s.hooks[event] = [...others, entry(script, name, matcher)];
  };
  setHook('SessionStart', 'session-start-restore.js', 'restore-progress');
  setHook('SessionStart', 'agent-limit.js reset', 'agent-limit-reset');
  setHook('SessionStart', 'compact-warn.js', 'compact-warn', 'compact');
  setHook('PreCompact', 'pre-compact-steer.js', 'steer-compaction');
  setHook('PreToolUse', 'secret-guard.js', 'secret-guard', 'write_file|edit|replace|run_shell_command');
  setHook('PreToolUse', 'git-branch-guard.js', 'git-branch-guard', 'run_shell_command');
  setHook('PreToolUse', 'release-guard.js', 'release-guard', 'run_shell_command');
  setHook('PreToolUse', 'agent-limit.js pre', 'agent-limit-pre', 'agent');
  setHook('PostToolUse', 'agent-limit.js post', 'agent-limit-post', 'agent');
  setHook('UserPromptSubmit', 'skill-reminder.js', 'skill-reminder');
  s.memory = Object.assign({ enableManagedAutoMemory: true, enableManagedAutoDream: true }, s.memory || {});
  // Toolkit stance: auto-compaction OFF by default (threshold 1.0 = only at a full
  // window). Compaction is lossy; durable state lives in PROGRESS.md and /checkpoint
  // compacts deliberately. Set ONLY when the user has no explicit value — an existing
  // choice (incl. one made via /autocompact) is never overridden by a re-install.
  s.context = s.context || {};
  if (s.context.autoCompactThreshold === undefined) s.context.autoCompactThreshold = 1;
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  console.log('  ✓ settings.json merged (hooks + auto-memory); your other keys untouched');
  console.log('  ✓ auto-compaction: ' + (s.context.autoCompactThreshold >= 1
    ? 'OFF by default (toolkit stance; /autocompact on re-enables)'
    : 'kept at your setting (' + s.context.autoCompactThreshold + ')'));
})();

// ---- 6) merge QWEN.md guidance between markers ---------------------------
(function mergeGuide() {
  const file = path.join(QHOME, 'QWEN.md');
  const START = '<!-- qwen-dev-toolkit:start -->', END = '<!-- qwen-dev-toolkit:end -->';
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const guide = read(path.join(SRC, 'QWEN.md')).replace(new RegExp(esc(START) + '|' + esc(END), 'g'), '').trim();
  const block = `${START}\n${guide}\n${END}`;
  let cur = read(file);
  const reAll = new RegExp(esc(START) + '[\\s\\S]*?' + esc(END), 'g');
  const had = reAll.test(cur);
  let bodyOut = cur.replace(reAll, '')
                   .replace(new RegExp(esc(START) + '|' + esc(END), 'g'), '')
                   .replace(guide, '')
                   .replace(/\n{3,}/g, '\n\n').trim();
  fs.writeFileSync(file, (bodyOut ? bodyOut + '\n\n' : '') + block + '\n');
  console.log('  ✓ QWEN.md guidance ' + (had ? 'updated' : 'added'));
})();

// ---- 6.5) --reset: sweep project-scope marker blocks out of the GLOBAL QWEN.md ----
// Known toggles that pin a "<!-- NAME:start -->...<!-- NAME:end -->" block into
// PROJECT QWEN.md today. If one of these is instead found in the GLOBAL file, it is a
// leftover from before that flag's scope moved (or was hand-pasted into the wrong file)
// — no current command reads/manages it there, so it silently applies everywhere forever
// until removed. Only acts on the GLOBAL file; project QWEN.md files are never touched by
// this step (their blocks are legitimate and owned by /dev, /bro, /cover, /maxagents,
// /versioning as normal).
if (DO_RESET) {
  const PROJECT_SCOPE_MARKERS = ['bromode', 'covermode', 'devmode', 'maxagents', 'versioning'];
  const file = path.join(QHOME, 'QWEN.md');
  let cur = read(file);
  const removed = [];
  for (const m of PROJECT_SCOPE_MARKERS) {
    const re = new RegExp('\\n?<!-- ' + m + ':start -->[\\s\\S]*?<!-- ' + m + ':end -->\\n?', 'g');
    if (re.test(cur)) { removed.push(m); cur = cur.replace(re, '\n'); }
  }
  if (removed.length) {
    cur = cur.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
    fs.writeFileSync(file, cur);
    console.log('  ✓ reset: removed stale global block(s) — ' + removed.join(', ') +
      ' (these are project-local now; re-set them per project with /bro, /cover, /dev, /maxagents, /versioning)');
  } else {
    console.log('  ✓ reset: no stale project-scope blocks found in the global QWEN.md');
  }
}

// ---- 7) done -------------------------------------------------------------
console.log('\nDone. Restart qwen-code (or start a new session) to load everything.');
console.log('Verify:  /skills  →  implement, plan, checkpoint, audit, brainstorm, gitflow, commit, review, docs, changelog, release, toolkit-update');
console.log('         /agents manage  →  implementer, scout, debugger, tester, researcher, verifier');
console.log('         /status  and  /main-push status  →  respond');
