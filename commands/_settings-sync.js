#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /settings-sync — sync ~/.qwen/settings.json across machines via a PRIVATE GitHub repo.
//
// SSH-ONLY: everything here uses git over SSH (git@github.com:o/r.git). No `gh`, no HTTPS API —
// so it works on a machine set up with just an SSH key. Two consequences:
//   • Access is verified with `git ls-remote` over SSH (BatchMode, so a missing key fails fast
//     instead of prompting). That confirms the repo is reachable and this machine's key is
//     authorised.
//   • Repo PRIVACY cannot be determined over SSH — the git protocol exposes no public/private
//     flag (a private repo you can access and a public one both answer the same). settings.json
//     holds secrets, so instead of a check we can't do, `connect` REQUIRES an explicit one-time
//     confirmation token (`connect <url> private`): you assert the repo is private. It's stored,
//     and `push` refuses unless that confirmation is on record. Deterministic, no silent upload.
// Direction is ALWAYS explicit: `push` (local → repo) or `pull` (repo → local). No bare "sync"
// that guesses; `pull` backs up the local file before overwriting it.
const { fs, os, path, readF, writeF, exists, qHome, rawArg } = require('./_qdt.js');
const cp = require('child_process');

const SETTINGS = () => path.join(qHome(), 'settings.json');
const STATE = () => path.join(qHome(), '.settings-repo');       // { slug, ssh, privateAck, connectedAt }
const CLONE = () => path.join(qHome(), '.settings-sync-repo');  // persistent working clone
const AUTHOR = ['-c', 'user.name=milka713', '-c', 'user.email=milka713@users.noreply.github.com'];

// Keys that are MACHINE-SPECIFIC and must NOT travel between machines — sync moves only the
// PORTABLE core (modelProviders/keys, fastModel, model, security, mcpServers, env, memory,
// context, ui) and each machine sets these up itself:
//   • `hooks` — the toolkit installer writes it with ABSOLUTE paths for THIS machine (e.g.
//     node "/Users/milka/.qwen/hooks/checkpoint-nudge.js") + a version-specific hook set. Pulled
//     onto another home (/home/... on Linux) or toolkit version, qwen runs hook paths that don't
//     exist → "Cannot find module" on every hook. Owned by that machine's `node install.js`.
//   • `permissions` — allow/deny carry absolute local paths (Read(//Users/milka/…)) that mean
//     nothing on another box, and each machine's own paths/policy shouldn't be clobbered.
// On push these are stripped from the repo copy; on pull the local ones are kept untouched.
const PORTABLE_EXCLUDE = ['hooks', 'permissions'];
const readJson = (p) => { try { return JSON.parse(readF(p)); } catch (_) { return null; } };
const pretty = (o) => JSON.stringify(o, null, 2) + '\n';
const stripExcluded = (o) => { const c = Object.assign({}, o); for (const k of PORTABLE_EXCLUDE) delete c[k]; return c; };
// SSH hardening for every network git call: never prompt (fail fast), short connect timeout.
const NETENV = { env: { ...process.env, GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10' } };

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

// ---- privacy (explicit confirmation — NOT verifiable over SSH) ---------------
// SSH exposes no public/private flag, so we can't check it. The user confirms once at connect
// time with the literal token `private`; we record it and gate push on it. `ack` is the raw
// third arg to `connect`.
const isPrivateAck = (ack) => String(ack || '').toLowerCase() === 'private';

// ---- access check (pure SSH) ------------------------------------------------
// `git ls-remote` over SSH returns 0 for a reachable repo this machine's key can read (even an
// empty one), and non-zero (BatchMode → no prompt) when the key isn't authorised / repo is gone.
// This is the strongest thing SSH can tell us. QDT_SETTINGS_ACCESS overrides for tests ('ok'|'denied').
function checkAccess(ssh) {
  const ov = process.env.QDT_SETTINGS_ACCESS;
  if (ov) return ov === 'ok';
  if (!haveGit()) return false;
  return git(null, ['ls-remote', ssh], NETENV).status === 0;
}
function requireAccess(repo, verb) {
  if (checkAccess(repo.ssh)) return;
  throw E('this machine can\'t reach ' + repo.slug + ' over SSH — its key may not be authorised for the repo (or git/network is down). Add this machine\'s SSH key on GitHub, then retry. Nothing was ' + verb + '.');
}

// ---- state ------------------------------------------------------------------
function loadState() { try { return JSON.parse(readF(STATE())); } catch (_) { return null; } }
function saveState(o) { writeF(STATE(), JSON.stringify(o, null, 2) + '\n'); }

// ---- git --------------------------------------------------------------------
function haveGit() { return sh('git', ['--version']).status === 0; }
function git(dir, args, opts) { return sh('git', dir ? ['-C', dir, ...args] : args, opts); }

// Guarantee a fresh clone at CLONE() synced to origin. Re-clones on any inconsistency. Network
// ops (clone/fetch) go through NETENV so a missing/unauthorised SSH key fails fast, never prompts.
function ensureClone(st) {
  const dir = CLONE();
  const isRepo = exists(path.join(dir, '.git'));
  const originOk = isRepo && (git(dir, ['remote', 'get-url', 'origin']).stdout || '').trim() === st.ssh;
  if (!originOk) {
    fs.rmSync(dir, { recursive: true, force: true });
    const c = git(null, ['clone', '--quiet', st.ssh, dir], NETENV);
    if (c.status !== 0) throw E('git clone failed for ' + st.ssh + ':\n' + (c.stderr || '').trim());
    return dir;
  }
  const f = git(dir, ['fetch', '--quiet', 'origin'], NETENV);
  if (f.status !== 0) { // fetch broke — nuke and re-clone
    fs.rmSync(dir, { recursive: true, force: true });
    const c = git(null, ['clone', '--quiet', st.ssh, dir], NETENV);
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
function cmdConnect(url, ack) {
  const repo = parseRepo(url);
  if (!repo) return out('ERROR — could not parse "' + url + '" as a GitHub repo. Use https://github.com/<owner>/<repo> or <owner>/<repo>. Nothing changed.');
  if (!haveGit()) throw E('git not found on PATH — required.');
  requireAccess(repo, 'connected');             // mandatory: THIS machine can reach it over SSH
  if (!isPrivateAck(ack)) {                      // privacy can't be verified over SSH — confirm explicitly
    return out('ERROR — privacy can\'t be verified over SSH (git exposes no public/private flag), and settings.json holds secrets (API keys, MCP tokens). If ' + repo.slug + ' is PRIVATE, confirm it explicitly:  /settings-sync connect ' + url + ' private  — nothing was connected.');
  }
  saveState({ slug: repo.slug, ssh: repo.ssh, privateAck: true, connectedAt: new Date().toISOString() });
  out('CONNECTED — ' + repo.slug + ' (SSH-reachable ✓; confirmed private by you). Now: `/settings-sync push` to upload this machine\'s settings.json, or `/settings-sync pull` to overwrite local with the repo\'s.');
}

function cmdPush() {
  const st = loadState();
  if (!st) throw E('no repo connected. Run `/settings-sync connect <github-url>` first. Nothing was pushed.');
  if (!exists(SETTINGS())) throw E('local ' + SETTINGS() + ' does not exist — nothing to push.');
  try { JSON.parse(readF(SETTINGS())); } catch (_) { throw E('local settings.json is not valid JSON — refusing to push a broken file. Fix it first.'); }
  if (!haveGit()) throw E('git not found on PATH — required to push.');
  if (!st.privateAck) throw E('this repo was connected without confirming it is private (settings hold secrets). Reconnect explicitly:  /settings-sync connect ' + st.slug + ' private  — nothing was pushed.');
  requireAccess(parseRepo(st.slug), 'pushed');  // THIS machine can still reach it over SSH
  const localObj = readJson(SETTINGS());
  if (!localObj) throw E('local settings.json is not valid JSON — refusing to push a broken file.');
  const dir = ensureClone(st);
  writeF(path.join(dir, 'settings.json'), pretty(stripExcluded(localObj))); // strip machine-specific `hooks`
  git(dir, ['add', 'settings.json']);
  const status = (git(dir, ['status', '--porcelain']).stdout || '').trim();
  if (!status) return out('NOOP — the repo already matches this machine\'s portable settings; nothing to push. (' + st.slug + ')');
  const branch = repoBranch(dir, st);
  const host = os.hostname();
  const cm = git(dir, [...AUTHOR, 'commit', '--quiet', '-m', 'settings: sync from ' + host + ' (' + new Date().toISOString() + ')']);
  if (cm.status !== 0) throw E('git commit failed:\n' + (cm.stderr || '').trim());
  const pu = git(dir, ['push', '--quiet', '-u', 'origin', 'HEAD:' + branch]);
  if (pu.status !== 0) throw E('git push failed:\n' + (pu.stderr || '').trim());
  out('PUSHED — settings.json → ' + st.slug + ' (' + branch + '), excluding machine-specific `hooks` + `permissions`. Other machines get it with `/settings-sync pull`. (Private per your confirmation; it holds your keys/tokens.)');
}

function cmdPull() {
  const st = loadState();
  if (!st) throw E('no repo connected. Run `/settings-sync connect <github-url>` first. Nothing was pulled.');
  if (!haveGit()) throw E('git not found on PATH — required to pull.');
  const repo = parseRepo(st.slug);
  requireAccess(repo, 'pulled');                // THIS machine must be able to reach it over SSH
  const dir = ensureClone(st);
  const incoming = path.join(dir, 'settings.json');
  if (!exists(incoming)) throw E('the repo has no settings.json yet — push from a configured machine first. Nothing was pulled.');
  const repoObj = readJson(incoming);
  if (!repoObj) throw E('the repo\'s settings.json is not valid JSON — refusing to overwrite your local file.');
  const local = SETTINGS();
  const localObj = exists(local) ? readJson(local) : null;
  // Take the repo's portable settings, but KEEP this machine's own `hooks` (absolute paths /
  // version-specific) so we never point qwen at hook files that don't exist here.
  const merged = Object.assign({}, repoObj);
  for (const k of PORTABLE_EXCLUDE) { if (localObj && localObj[k] !== undefined) merged[k] = localObj[k]; }
  const mergedStr = pretty(merged);
  let backup = null;
  if (localObj) {
    if (pretty(localObj) === mergedStr) return out('NOOP — local settings.json already matches ' + st.slug + ' (portable settings); nothing to pull.');
    backup = local + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(local, backup);
  }
  writeF(local, mergedStr);
  const nProv = (((repoObj.modelProviders || {}).openai || []).length) || 0;
  out('PULLED — settings.json ← ' + st.slug + (backup ? ' (local backed up to ' + path.basename(backup) + ')' : '') + '. ' + nProv + ' provider(s); kept THIS machine\'s own `hooks` + `permissions`. ⚠ Restart / re-open qwen-code to load it.');
}

function cmdStatus() {
  const st = loadState();
  if (!st) return out('STATUS — not connected. Run `/settings-sync connect <github-url> private` (settings hold secrets; you confirm the repo is private — it can\'t be verified over SSH).');
  const repo = parseRepo(st.slug);
  const priv = st.privateAck ? 'confirmed private by you ✓ (SSH can\'t verify)' : 'NOT confirmed private ⚠ (push blocked — reconnect with `private`)';
  const access = checkAccess(repo.ssh) ? 'SSH-reachable by this machine ✓' : 'NOT reachable over SSH from this machine ⚠';
  let diff = 'unknown';
  try {
    const dir = ensureClone(st);
    const incoming = path.join(dir, 'settings.json');
    if (!exists(incoming)) diff = 'repo has no settings.json yet (push to seed it)';
    else if (!exists(SETTINGS())) diff = 'no local settings.json (pull to fetch)';
    else diff = pretty(stripExcluded(readJson(SETTINGS()) || {})) === readF(incoming)
      ? 'in sync (portable settings; `hooks`/`permissions` stay per-machine)'
      : 'DIFFER — push to upload local, or pull to overwrite local (`hooks`/`permissions` stay per-machine)';
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
    if (sub === 'connect') return cmdConnect(parts[1], parts[2]);
    if (sub === 'push') return cmdPush();
    if (sub === 'pull') return cmdPull();
    if (sub === 'disconnect') return cmdDisconnect();
    out('ERROR — unknown subcommand "' + sub + '". Usage: /settings-sync connect <url> | push | pull | status | disconnect. Nothing changed.');
  } catch (e) {
    out('ERROR — ' + (e && e.qdt ? e.message : 'unexpected: ' + (e && e.message || e)));
  }
}

module.exports = { parseRepo, isPrivateAck };
if (require.main === module) main();
