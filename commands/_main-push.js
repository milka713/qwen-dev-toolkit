#!/usr/bin/env node
'use strict';
// Node port of _main-push.sh — user-only authorization for a main/master release window.
// Drops a token the git-branch-guard hook checks; 15-minute window, revoke with /main-push off.
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
    if (a <= 900) console.log(`MAIN_PUSH_RESULT: main is AUTHORIZED (window open ~${Math.floor((900 - a) / 60)}m more; covers merge+push).`);
    else { try { fs.unlinkSync(T); } catch (_) {} console.log('MAIN_PUSH_RESULT: main is NOT authorized (previous token expired).'); }
  } else console.log('MAIN_PUSH_RESULT: main is NOT authorized (default). Pushes/merges to main are blocked.');
} else {
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(T, '');
  console.log('MAIN_PUSH_RESULT: main AUTHORIZED for a 15-minute release window (covers the merge and the push). Proceed with the main release now. Revoke early with /main-push off.');
}
