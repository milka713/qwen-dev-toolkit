#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /settings-sync — sync ~/.qwen/settings.json across machines via a PRIVATE GitHub repo.
//
// Your qwen-code settings.json holds secrets (provider API keys, MCP tokens). So connecting a
// repo REQUIRES a privacy check (gh api .private === true) and every push RE-checks it before
// uploading — secrets never go to a repo we can't confirm is private. Direction is ALWAYS
// explicit: `push` (local → repo) or `pull` (repo → local). There is deliberately no bare
// "sync" that guesses a direction, and `pull` backs up the local file before overwriting it.
const { fs, os, path, readF, writeF, exists, qHome, rawArg } = require('./_qdt.js');
const cp = require('child_process');

const SETTINGS = () => path.join(qHome(), 'settings.json');
const STATE = () => path.join(qHome(), '.settings-repo');       // { slug, ssh, branch, connectedAt }
const CLONE = () => path.join(qHome(), '.settings-sync-repo');  // persistent working clone
const SYNCED = ['settings.json'];                                // the file(s) we sync
const AUTHOR = ['-c', 'user.name=milka713', '-c', 'user.email=milka713@users.noreply.github.com'];

const out = (s) => console.log('SETTINGS_SYNC_RESULT: ' + s);
function E(msg) { const e = new Error(msg); e.qdt = true; return e; }
const sh = (cmd, args, opts = {}) => cp.spawnSync(cmd, args, { encoding: 'utf8', ...opts });

// ---- repo URL parsing -------------------------------------------------------
// Accepts: https://github.com/o/r(.git), git@github.com:o/r(.git), github.com/o/r, o/r.
function parseRepo(input) {
  if (!input) return null;
  let s = String(input).trim().replace(/\s+/g, '');
  let m = s.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
       || s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#].*)?$/i)
       || s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!m) return null;
  const owner = m[1], name = m[2];
  return { owner, name, slug: owner + '/' + name, ssh: 'git@github.com:' + owner + '/' + name + '.git' };
}

// ---- privacy check (mandatory) ----------------------------------------------
// Returns 'private' | 'public' | 'notfound' | 'nogh'. QDT_SETTINGS_GH_PRIVATE overrides the
// gh call for hermetic tests ('true'|'false'|'notfound'|'nogh').
function checkPrivate(repo) {
  const ov = process.env.QDT_SETTINGS_GH_PRIVATE;
  if (ov) return ov === 'true' ? 'private' : ov === 'false' ? 'public' : ov === 'notfound' ? 'notfound' : 'nogh';
  const probe = sh('gh', ['--version']);
  if (probe.status !== 0) return 'nogh';
  const r = sh('gh', ['api', 'repos/' + repo.slug, '--jq', '.private']);
  if (r.status !== 0) return 'notfound';
  return (r.stdout || '').trim() === 'true' ? 'private' : 'public';
}
function requirePrivate(repo, verb) {
  const v = checkPrivate(repo);
  if (v === 'private') return;
  if (v === 'nogh') throw E('the GitHub CLI `gh` is required for the mandatory privacy check (settings hold secrets). Install it and run `gh auth login`, then retry. Nothing was ' + verb + '.');
  if (v === 'notfound') throw E('cannot access ' + repo.slug + ' via `gh` — check the name and that you have access. Nothing was ' + verb + '.');
  throw E('repo ' + repo.slug + ' is PUBLIC. Your settings.json contains secrets (API keys, MCP tokens) — refusing to ' + verb + '. Make the repo private on GitHub first, then retry.');
}

// This machine's OWN git access to the repo (SSH key authorised, repo reachable). Distinct from
// the gh privacy check above — gh uses its own token; push/pull go over git/SSH. ls-remote returns
// 0 for a reachable repo (even an empty one). QDT_SETTINGS_ACCESS overrides for tests ('ok'|'denied').
function checkAccess(ssh) {
  const ov = process.env.QDT_SETTINGS_ACCESS;
  if (ov) return ov === 'ok';
  if (!haveGit()) return false;
  return git(null, ['ls-remote', ssh]).status === 0;
}
function requireAccess(repo, verb) {
  if (checkAccess(repo.ssh)) return;
  throw E('this machine can\'t reach ' + repo.slug + ' over git — its SSH key may not be authorised for the repo (or git/network is down). Add this machine\'s key on GitHub, then retry. Nothing was ' + verb + '.');
}

// ---- state ------------------------------------------------------------------
function loadState() { try { return JSON.parse(readF(STATE())); } catch (_) { return null; } }
function saveState(o) { writeF(STATE(), JSON.stringify(o, null, 2) + '\n'); }

// ---- git --------------------------------------------------------------------
function haveGit() { return sh('git', ['--version']).status === 0; }
function git(dir, args) { return sh('git', dir ? ['-C', dir, ...args] : args); }

// Guarantee a fresh clone at CLONE() synced to origin. Re-clones on any inconsistency.
function ensureClone(st) {
  const dir = CLONE();
  const isRepo = exists(path.join(dir, '.git'));
  const originOk = isRepo && (git(dir, ['remote', 'get-url', 'origin']).stdout || '').trim() === st.ssh;
  if (!originOk) {
    fs.rmSync(dir, { recursive: true, force: true });
    const c = git(null, ['clone', '--quiet', st.ssh, dir]);
    if (c.status !== 0) throw E('git clone failed for ' + st.ssh + ':\n' + (c.stderr || '').trim());
    return dir;
  }
  const f = git(dir, ['fetch', '--quiet', 'origin']);
  if (f.status !== 0) { // fetch broke — nuke and re-clone
    fs.rmSync(dir, { recursive: true, force: true });
    const c = git(null, ['clone', '--quiet', st.ssh, dir]);
    if (c.status !== 0) throw E('git clone failed for ' + st.ssh + ':\n' + (c.stderr || '').trim());
    return dir;
  }
  // hard-reset to the remote default branch if it exists (empty repo → unborn branch, skip)
  const head = git(dir, ['rev-parse', '--abbrev-ref', 'origin/HEAD']);
  if (head.status === 0) git(dir, ['reset', '--hard', '--quiet', (head.stdout || '').trim()]);
  return dir;
}

function repoBranch(dir, st) {
  const head = git(dir, ['rev-parse', '--abbrev-ref', 'origin/HEAD']);
  if (head.status === 0) return (head.stdout || '').trim().replace(/^origin\//, '');
  return st.branch || 'main';
}

// ---- commands ---------------------------------------------------------------
function cmdConnect(url) {
  const repo = parseRepo(url);
  if (!repo) return out('ERROR — could not parse "' + url + '" as a GitHub repo. Use https://github.com/<owner>/<repo> or <owner>/<repo>. Nothing changed.');
  requirePrivate(repo, 'connected');            // mandatory: repo is private
  requireAccess(repo, 'connected');             // mandatory: THIS machine can reach it over git
  saveState({ slug: repo.slug, ssh: repo.ssh, connectedAt: new Date().toISOString() });
  out('CONNECTED — ' + repo.slug + ' (verified PRIVATE + reachable by this machine). Now: `/settings-sync push` to upload this machine\'s settings.json, or `/settings-sync pull` to overwrite local with the repo\'s.');
}

function cmdPush() {
  const st = loadState();
  if (!st) throw E('no repo connected. Run `/settings-sync connect <github-url>` first. Nothing was pushed.');
  if (!exists(SETTINGS())) throw E('local ' + SETTINGS() + ' does not exist — nothing to push.');
  try { JSON.parse(readF(SETTINGS())); } catch (_) { throw E('local settings.json is not valid JSON — refusing to push a broken file. Fix it first.'); }
  if (!haveGit()) throw E('git not found on PATH — required to push.');
  requirePrivate(parseRepo(st.slug), 'pushed'); // RE-check privacy before uploading secrets
  requireAccess(parseRepo(st.slug), 'pushed');  // and that THIS machine can still reach it
  const dir = ensureClone(st);
  for (const f of SYNCED) fs.copyFileSync(path.join(qHome(), f), path.join(dir, f));
  git(dir, ['add', ...SYNCED]);
  const status = (git(dir, ['status', '--porcelain']).stdout || '').trim();
  if (!status) return out('NOOP — the repo already matches this machine\'s settings; nothing to push. (' + st.slug + ')');
  const branch = repoBranch(dir, st);
  const host = os.hostname();
  const cm = git(dir, [...AUTHOR, 'commit', '--quiet', '-m', 'settings: sync from ' + host + ' (' + new Date().toISOString() + ')']);
  if (cm.status !== 0) throw E('git commit failed:\n' + (cm.stderr || '').trim());
  const pu = git(dir, ['push', '--quiet', '-u', 'origin', 'HEAD:' + branch]);
  if (pu.status !== 0) throw E('git push failed:\n' + (pu.stderr || '').trim());
  out('PUSHED — settings.json → ' + st.slug + ' (' + branch + '). Other machines get it with `/settings-sync pull`. (Repo is private; it now holds your keys/tokens.)');
}

function cmdPull() {
  const st = loadState();
  if (!st) throw E('no repo connected. Run `/settings-sync connect <github-url>` first. Nothing was pulled.');
  if (!haveGit()) throw E('git not found on PATH — required to pull.');
  const repo = parseRepo(st.slug);
  const v = checkPrivate(repo);
  if (v === 'notfound') throw E('cannot access ' + st.slug + ' via `gh` — check access. Nothing was pulled.');
  requireAccess(repo, 'pulled');                // THIS machine must be able to reach it over git
  const dir = ensureClone(st);
  const incoming = path.join(dir, 'settings.json');
  if (!exists(incoming)) throw E('the repo has no settings.json yet — push from a configured machine first. Nothing was pulled.');
  let parsed; try { parsed = JSON.parse(readF(incoming)); } catch (_) { throw E('the repo\'s settings.json is not valid JSON — refusing to overwrite your local file.'); }
  const local = SETTINGS();
  let backup = null;
  if (exists(local)) {
    if (readF(local) === readF(incoming)) return out('NOOP — local settings.json already matches ' + st.slug + '; nothing to pull.');
    backup = local + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(local, backup);
  }
  for (const f of SYNCED) fs.copyFileSync(path.join(dir, f), path.join(qHome(), f));
  const nProv = (((parsed.modelProviders || {}).openai || []).length) || 0;
  out('PULLED — settings.json ← ' + st.slug + (backup ? ' (local backed up to ' + path.basename(backup) + ')' : '') + '. ' + nProv + ' provider(s). ⚠ Restart / re-open qwen-code to load it.');
}

function cmdStatus() {
  const st = loadState();
  if (!st) return out('STATUS — not connected. Run `/settings-sync connect <github-url>` (must be a PRIVATE repo — settings hold secrets).');
  const repo = parseRepo(st.slug);
  const v = checkPrivate(repo);
  const priv = v === 'private' ? 'PRIVATE ✓' : v === 'public' ? 'PUBLIC ⚠ (push blocked)' : v === 'nogh' ? 'unknown (gh missing)' : 'unreachable';
  const access = checkAccess(repo.ssh) ? 'this machine has git access ✓' : 'NO git access from this machine ⚠';
  let diff = 'unknown';
  try {
    const dir = ensureClone(st);
    const incoming = path.join(dir, 'settings.json');
    if (!exists(incoming)) diff = 'repo has no settings.json yet (push to seed it)';
    else if (!exists(SETTINGS())) diff = 'no local settings.json (pull to fetch)';
    else diff = readF(SETTINGS()) === readF(incoming) ? 'in sync' : 'DIFFER — push to upload local, or pull to overwrite local';
  } catch (_) { diff = 'could not reach the repo'; }
  out('STATUS — ' + st.slug + ' [' + priv + '; ' + access + '], connected ' + (st.connectedAt || '?') + '. Local vs repo: ' + diff + '. Direction is explicit: `push` (local→repo) / `pull` (repo→local).');
}

function cmdDisconnect() {
  const st = loadState();
  if (!st) return out('NOOP — no repo was connected.');
  try { fs.unlinkSync(STATE()); } catch (_) {}
  fs.rmSync(CLONE(), { recursive: true, force: true });
  out('DISCONNECTED — forgot ' + st.slug + ' and removed the local clone. Your settings.json is untouched.');
}

function main() {
  const parts = rawArg(2).trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] || 'status').toLowerCase();
  try {
    if (sub === 'status') return cmdStatus();
    if (sub === 'connect') return cmdConnect(parts[1]);
    if (sub === 'push') return cmdPush();
    if (sub === 'pull') return cmdPull();
    if (sub === 'disconnect') return cmdDisconnect();
    out('ERROR — unknown subcommand "' + sub + '". Usage: /settings-sync connect <url> | push | pull | status | disconnect. Nothing changed.');
  } catch (e) {
    out('ERROR — ' + (e && e.qdt ? e.message : 'unexpected: ' + (e && e.message || e)));
  }
}

module.exports = { parseRepo, checkPrivate };
if (require.main === module) main();
