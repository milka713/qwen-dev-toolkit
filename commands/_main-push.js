#!/usr/bin/env node
'use strict';
// Node port of _main-push.sh — user-only authorization for ONE main/master push.
// Drops a single-use token the git-branch-guard hook checks: it authorizes exactly one push
// to main (which also covers the merge before it), then is consumed. A TTL only expires an
// unused token. Revoke early with /main-push off.
const { fs, path, norm, qHome, rawArg } = require('./_qdt.js');

const QHOME = qHome();
const T = path.join(QHOME, '.main-approval');
const n = norm(rawArg(2));

function age() { try { return Math.floor(Date.now() / 1000) - Math.floor(fs.statSync(T).mtimeMs / 1000); } catch (_) { return -1; } }

if (n === 'off' || n === 'revoke' || n === 'cancel') {
  try { fs.unlinkSync(T); } catch (_) {}
  console.log('MAIN_PUSH_RESULT: main authorization revoked. Pushes/merges to main are blocked again.');
} else if (n === 'status') {
  const a = age();
  if (a >= 0) {
    if (a <= 900) console.log(`MAIN_PUSH_RESULT: main is AUTHORIZED — single-use: ONE push pending (not yet used), covers the merge before it. Expires in ~${Math.floor((900 - a) / 60)}m if unused.`);
    else { try { fs.unlinkSync(T); } catch (_) {} console.log('MAIN_PUSH_RESULT: main is NOT authorized (previous token expired unused).'); }
  } else console.log('MAIN_PUSH_RESULT: main is NOT authorized (default). Pushes/merges to main are blocked.');
} else {
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(T, '');
  console.log('MAIN_PUSH_RESULT: main AUTHORIZED for ONE push (single-use — it covers the merge and the one push, then is consumed; a second push needs /main-push again). Expires if unused in 15 min. Proceed with the release now. Revoke early with /main-push off.');
}
