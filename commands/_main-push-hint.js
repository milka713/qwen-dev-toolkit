#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Backend for /main-push-hint — teaches qwen-code's Auto-Mode command classifier to stop
// blocking authorized main/master pushes and defer them to the deterministic git-branch-guard
// hook + single-use /main-push token.
//
// Why a command (not part of install): the fix lives in ~/.qwen/settings.json under
// permissions.autoMode.hints.allow, which is per-machine user config and requires a qwen
// restart to take effect — so it is applied deliberately, per machine, on explicit invocation
// rather than silently rewritten on every toolkit install. In Auto Mode the classifier runs
// BEFORE our PreToolUse hook and independently blocks main pushes (inventing its own
// "single-use token already consumed" bookkeeping from the transcript); a natural-language
// `hints.allow` entry is the officially-documented lever to make it defer to the hook.
//
// The hint carries a hidden marker `(qdt:mph)` so on/off/status find it deterministically
// regardless of wording changes across versions. Idempotent; backs up settings.json once
// per modifying call before writing.
const { fs, path, readF, writeF, exists, qHome, norm, rawArg } = require('./_qdt.js');

const MARKER = '(qdt:mph)';
// One <=200-char natural-language entry (the classifier truncates longer ones from the end,
// which is why the marker is kept short and the text stays well under the cap).
const HINT =
  'Pushing/merging to main/master for a release (first push, -u/--set-upstream, dev:main, ' +
  'switch+merge+push) is gated by git-branch-guard + /main-push token; approve it. ' + MARKER;

const isMph = (e) => typeof e === 'string' && e.includes(MARKER);

function main() {
  const SETTINGS = path.join(qHome(), 'settings.json');
  const n = norm(rawArg(2));
  const out = (s) => console.log('MAIN_PUSH_HINT_RESULT: ' + s);
  const pretty = (o) => JSON.stringify(o, null, 2) + '\n';

  // Load settings (empty object if absent; hard-fail on invalid JSON so we never clobber a
  // config we can't safely round-trip).
  let obj;
  if (!exists(SETTINGS)) {
    obj = {};
  } else {
    try { obj = JSON.parse(readF(SETTINGS) || '{}'); }
    catch (e) { out('ERROR: ~/.qwen/settings.json is not valid JSON (' + (e.message || e) + '). Fix it by hand first; nothing was changed.'); return; }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out('ERROR: ~/.qwen/settings.json is not a JSON object; nothing was changed.'); return;
  }

  const allowList = () => (((obj.permissions || {}).autoMode || {}).hints || {}).allow;
  const present = () => Array.isArray(allowList()) && allowList().some(isMph);
  const backupOnce = () => { if (exists(SETTINGS)) { try { writeF(SETTINGS + '.bak-main-push-hint', readF(SETTINGS)); } catch (_) {} } };
  const save = () => { try { writeF(SETTINGS, pretty(obj)); return true; } catch (e) { out('ERROR: could not write ~/.qwen/settings.json (' + (e.message || e) + ').'); return false; } };

  if (n === 'status') {
    if (present()) out('ON — the Auto-Mode classifier is told to defer main pushes to the git-branch-guard hook. (Active only in a qwen session started AFTER it was set.)');
    else out('OFF — no main-push classifier hint is set. In Auto Mode the classifier may block authorized main pushes; run `/main-push-hint on` to fix (then restart qwen).');
    return;
  }

  if (n === 'off' || n === 'remove' || n === 'disable') {
    if (!present()) { out('already OFF — no main-push hint was set; nothing changed.'); return; }
    backupOnce();
    obj.permissions.autoMode.hints.allow = allowList().filter((e) => !isMph(e));
    if (save()) out('removed the main-push classifier hint. Restart qwen for it to take effect. Note: with the hint off, Auto Mode may again block authorized main pushes.');
    return;
  }

  // default / on / enable — add (or refresh) the hint idempotently.
  obj.permissions = obj.permissions || {};
  obj.permissions.autoMode = obj.permissions.autoMode || {};
  obj.permissions.autoMode.hints = obj.permissions.autoMode.hints || {};
  const cur = Array.isArray(obj.permissions.autoMode.hints.allow) ? obj.permissions.autoMode.hints.allow : [];
  const already = cur.some((e) => e === HINT);
  const kept = cur.filter((e) => !isMph(e)); // drop any older-worded qdt:mph entry
  kept.push(HINT);
  if (already && kept.length === cur.length) {
    out('already ON — the main-push classifier hint is already set (unchanged). If Auto Mode still blocks main pushes, restart qwen so it re-reads settings.');
    return;
  }
  backupOnce();
  obj.permissions.autoMode.hints.allow = kept;
  if (save()) out('added the main-push classifier hint to permissions.autoMode.hints.allow. RESTART qwen so Auto Mode re-reads settings — then an authorized `/main-push` release will no longer be blocked by "auto mode policy". The deterministic git-branch-guard hook still gates unauthorized pushes.');
}

module.exports = { HINT, MARKER, isMph };
if (require.main === module) main();
