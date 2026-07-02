#!/usr/bin/env node
'use strict';
/*
 * qwen-dev-toolkit ONE-FILE bootstrap installer / updater (macOS · Linux · Windows).
 *
 * Download just this file and run it — it fetches the toolkit from GitHub and installs it:
 *     node install-bootstrap.js
 *
 * INSTALL and UPDATE are the same command: run it again and it pulls the latest and
 * re-installs in place. Requires `node` and `git` (and qwen-code, which the toolkit extends).
 * It clones into ~/.qwen/.src/qwen-dev-toolkit and runs that checkout's install.js, which
 * copies only the toolkit's own files and never deletes your other skills/settings.
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'https://github.com/milka713/qwen-dev-toolkit';
const CACHE = path.join(process.env.QWEN_HOME || path.join(os.homedir(), '.qwen'), '.src', 'qwen-dev-toolkit');
const run = (cmd, args, opts) => cp.spawnSync(cmd, args, Object.assign({ stdio: 'inherit', shell: process.platform === 'win32' }, opts));
const ok = (cmd, args) => { const r = cp.spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' }); return r.status === 0; };

if (!ok('node', ['--version'])) { console.error('ERROR: Node.js is required.'); process.exit(1); }
if (!ok('git', ['--version'])) {
  console.error('ERROR: git is required to fetch the toolkit.\n  macOS: brew install git   Linux: sudo apt install git   Windows: winget install Git.Git');
  process.exit(1);
}

const exists = (p) => { try { fs.statSync(p); return true; } catch (_) { return false; } };
if (exists(path.join(CACHE, '.git'))) {
  console.log(`Updating existing checkout in ${CACHE} …`);
  let r = run('git', ['-C', CACHE, 'pull', '--ff-only']);
  if (r.status !== 0) { // local mess — re-clone fresh
    console.log('pull failed; re-cloning fresh …');
    fs.rmSync(CACHE, { recursive: true, force: true });
  }
}
if (!exists(path.join(CACHE, '.git'))) {
  console.log(`Cloning ${REPO} → ${CACHE} …`);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const r = run('git', ['clone', '--depth', '1', REPO, CACHE]);
  if (r.status !== 0) { console.error('ERROR: git clone failed.'); process.exit(1); }
}

console.log('Running installer …\n');
const r = run('node', [path.join(CACHE, 'install.js')]);
process.exit(r.status == null ? 1 : r.status); // null status = spawn failure, not success
