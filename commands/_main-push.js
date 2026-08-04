#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Node port of _main-push.sh — user-only authorization for pushing to main/master.
// Three modes, all recorded in the ~/.qwen/.main-approval token that git-branch-guard checks:
//   /main-push            → SINGLE-USE: authorizes exactly ONE successful push (covers the
//                           merge before it), then main-push-consume deletes it. 15-min unused TTL.
//   /main-push on         → PERSISTENT: every push to main allowed until you run /main-push off.
//                           No TTL, never consumed — for a run of back-to-back releases.
//   /main-push off        → revoke (default state): pushes/merges to main blocked again.
// The token MODE is the file's content: 'persistent' or 'once' (empty is treated as 'once'
// for backward compatibility with tokens dropped by older versions).
const { fs, path, norm, qHome, rawArg } = require('./_qdt.js');

const QHOME = qHome();
const T = path.join(QHOME, '.main-approval');
const n = norm(rawArg(2));
const TTL_S = 900; // single-use unused-token expiry

const readMode = () => { try { const c = fs.readFileSync(T, 'utf8').trim(); return c === 'persistent' ? 'persistent' : 'once'; } catch (_) { return null; } };
const age = () => { try { return Math.floor(Date.now() / 1000) - Math.floor(fs.statSync(T).mtimeMs / 1000); } catch (_) { return -1; } };

if (n === 'off' || n === 'revoke' || n === 'cancel' || n === 'disable') {
  try { fs.unlinkSync(T); } catch (_) {}
  console.log('MAIN_PUSH_RESULT: main authorization revoked. Pushes/merges to main are blocked again (default).');
} else if (n === 'status') {
  const mode = readMode();
  if (mode === 'persistent') {
    console.log('MAIN_PUSH_RESULT: main is AUTHORIZED (persistent) — every push to main is allowed until you run /main-push off. No expiry, not single-use.');
  } else if (mode === 'once') {
    const a = age();
    if (a <= TTL_S) console.log(`MAIN_PUSH_RESULT: main is AUTHORIZED — single-use: ONE push pending (not yet used), covers the merge before it. Expires in ~${Math.floor((TTL_S - a) / 60)}m if unused.`);
    else { try { fs.unlinkSync(T); } catch (_) {} console.log('MAIN_PUSH_RESULT: main is NOT authorized (previous single-use token expired unused).'); }
  } else console.log('MAIN_PUSH_RESULT: main is NOT authorized (default). Pushes/merges to main are blocked.');
} else if (n === 'on' || n === 'enable' || n === 'always') {
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(T, 'persistent');
  console.log('MAIN_PUSH_RESULT: main AUTHORIZED (persistent) — EVERY push/merge to main is now allowed until you run /main-push off. This does NOT expire and is NOT consumed by a push. Remember to /main-push off when the release run is done.');
} else {
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(T, 'once');
  console.log('MAIN_PUSH_RESULT: main AUTHORIZED for ONE push (single-use — it covers the merge and the one push, then is consumed once the push SUCCEEDS; a blocked/failed attempt does not waste it, a second successful push needs /main-push again). Expires if unused in 15 min. Proceed with the release now. For a run of back-to-back releases use /main-push on instead; revoke with /main-push off.');
}
