#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /sudo-on + /sudo-off backend — DANGEROUS opt-in: hand the local model FULL passwordless
// root on this machine. This exists only because the operator explicitly wants it for their
// own boxes (e.g. firewall/sysadmin automation) and accepts the blast radius.
//
// Design:
//   /sudo-on <password>   -> stores the password in a pending file (chmod 600) and prints a
//                            LOUD danger warning + a mandatory confirm step. Nothing is armed yet.
//   /sudo-on confirm      -> promotes pending to ACTIVE: writes a root askpass helper (chmod 700)
//                            and pins a `sudomode` block into the global ~/.qwen/QWEN.md telling
//                            the model to run privileged commands via `sudo -A` (the password is
//                            fed by the askpass helper, so it never lands in the command line or
//                            the transcript). Deletes the pending file.
//   /sudo-on status       -> report ACTIVE / pending / off.
//   /sudo-off             -> wipe pending + password + askpass, remove the guidance block. The
//                            model can no longer sudo, and forgets the password.
const fs = require('fs');
const path = require('path');
const os = require('os');

const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
const GLOBAL_QWEN = path.join(QHOME, 'QWEN.md');
const PENDING = path.join(QHOME, '.sudo-pending');
const PASS = path.join(QHOME, '.sudo-pass');
const ASKPASS = path.join(QHOME, '.sudo-askpass');
const MARKER = 'sudomode';
const PENDING_TTL = 5 * 60 * 1000; // a pending /sudo-on must be confirmed within 5 minutes

const out = (m) => { console.log('SUDO_RESULT: ' + m); process.exit(0); };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };
const exists = (p) => { try { fs.statSync(p); return true; } catch (_) { return false; } };
const wipe = (p) => { try { fs.unlinkSync(p); } catch (_) {} };

function removeBlock() {
  const body = read(GLOBAL_QWEN);
  if (!body.includes(MARKER + ':start')) return;
  const re = new RegExp('\\n?<!-- ' + MARKER + ':start -->[\\s\\S]*?<!-- ' + MARKER + ':end -->\\n?', 'g');
  fs.writeFileSync(GLOBAL_QWEN, body.replace(re, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, ''));
}
function pinBlock() {
  removeBlock(); // keep it single
  const block = [
    '',
    '<!-- ' + MARKER + ':start -->',
    '## ⚠️⚠️ sudo UNLOCKED — the model has FULL ROOT on this machine (via /sudo-on)',
    'Privileged commands run WITHOUT a password prompt. To run one, prefix it with the askpass helper so the',
    'password is supplied automatically and NEVER appears in the command or the transcript:',
    '`SUDO_ASKPASS="' + ASKPASS + '" sudo -A <command>`',
    'Example: `SUDO_ASKPASS="' + ASKPASS + '" sudo -A nft list ruleset`',
    'This is FULL ROOT: a wrong command can destroy the machine. Run ONLY the exact privileged action the user',
    'asked for, nothing more; never print, echo, cat, or copy the password or the askpass file. Turn this off',
    'the moment it is no longer needed with /sudo-off.',
    '<!-- ' + MARKER + ':end -->',
    '',
  ].join('\n');
  let body = read(GLOBAL_QWEN);
  fs.writeFileSync(GLOBAL_QWEN, (body ? body.replace(/\n+$/, '') + '\n' : '') + block);
}
function isActive() { return exists(ASKPASS) && exists(PASS); }

// Stylish red banner (ANSI). Honors NO_COLOR / non-TTY by dropping the codes so piped or
// color-disabled output stays clean.
const color = !process.env.NO_COLOR;
const BR = color ? '\x1b[1;91m' : '', DR = color ? '\x1b[91m' : '', RST = color ? '\x1b[0m' : '';
const RULE = BR + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + RST;
const WARN =
  '\n' + RULE + '\n' +
  BR + '   ☢  EXTREME DANGER — FULL PASSWORDLESS ROOT FOR THE MODEL  ☢' + RST + '\n' +
  RULE + '\n' +
  DR + 'If you confirm, the model can run ANY `sudo` command on this machine with no password. ' +
  'A looping or mistaken model can IRREVERSIBLY destroy the system — wiped files, dropped firewall ' +
  'rules, bricked services. Only on a machine you own and can afford to lose; turn it OFF (/sudo-off) ' +
  'the instant you are done.' + RST;

const a = process.argv.slice(2);
const mode = (a[0] || '').toLowerCase();
const arg = a[1] || '';

if (mode === 'off') {
  wipe(PENDING); wipe(PASS); wipe(ASKPASS); removeBlock();
  out('sudo LOCKED — pending request, stored password, and askpass helper all wiped, and the guidance block removed from the global QWEN.md. The model can no longer run sudo and no longer holds the password.');
}

// mode === 'on'
if (arg.toLowerCase() === 'status') {
  if (isActive()) out('sudo is ACTIVE — the model currently has full passwordless root (askpass helper present). Turn it off with /sudo-off.');
  if (exists(PENDING)) out('a /sudo-on is PENDING confirmation (run /sudo-on confirm within 5 min, or /sudo-off to cancel). Not active yet.');
  out('sudo is OFF (default) — the model cannot run sudo. Enable with /sudo-on <password> then /sudo-on confirm (DANGEROUS).');
}

if (arg.toLowerCase() === 'confirm') {
  if (!exists(PENDING) || Date.now() - fs.statSync(PENDING).mtimeMs > PENDING_TTL) {
    wipe(PENDING);
    out('nothing to confirm — no fresh /sudo-on is pending (the 5-minute window may have expired). Run /sudo-on <password> again first.');
  }
  const pw = read(PENDING);
  fs.writeFileSync(PASS, pw, { mode: 0o600 });
  try { fs.chmodSync(PASS, 0o600); } catch (_) {}
  fs.writeFileSync(ASKPASS, '#!/bin/sh\ncat ' + JSON.stringify(PASS) + '\n', { mode: 0o700 });
  try { fs.chmodSync(ASKPASS, 0o700); } catch (_) {}
  pinBlock();
  wipe(PENDING);
  out('\n' + RULE + '\n' + BR + '   ☢  sudo ACTIVE — THE MODEL NOW HAS FULL ROOT  ☢' + RST + '\n' + RULE + '\n' +
    DR + 'The model has FULL PASSWORDLESS ROOT on this machine.' + RST + ' It runs privileged commands via ' +
    '`SUDO_ASKPASS="' + ASKPASS + '" sudo -A <command>` (password auto-supplied, never shown). ' +
    'This stays on until you run /sudo-off — do that the moment you are done. Tell the user, loudly, that root is now open.');
}

// bare `/sudo-on` or `/sudo-on <password>` → arm pending + warn
if (!arg) {
  out(WARN + '\n\nUsage: /sudo-on <sudo-password>  (then, after the warning, /sudo-on confirm). To cancel or disable: /sudo-off.');
}
// treat the whole remaining args as the password (in case it contains spaces)
const password = a.slice(1).join(' ');
fs.writeFileSync(PENDING, password, { mode: 0o600 });
try { fs.chmodSync(PENDING, 0o600); } catch (_) {}
out(WARN + '\n\nThe password is staged (not active yet). To ACTUALLY enable full root for the model, confirm within 5 minutes: ' +
  'run  /sudo-on confirm . To back out, run /sudo-off. You MUST warn the user in plain words how dangerous this is and ' +
  'ask them to confirm they really want it BEFORE they run /sudo-on confirm — do not confirm it for them.');
