// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /devedit backend — the one-shot escape for development mode's write-guard (devmode-guard).
// It stages a single-use token that lets the ARCHITECT make exactly one direct write_file/edit
// even while /dev is on, and records the justification in .qwen/PROGRESS.md so the exception is
// loud and auditable instead of a silent rationalisation. The token is consumed by the very
// next guarded write and auto-expires after 15 min. Escape is deliberately high-friction, not
// a real barrier: the point is to turn "quietly broke discipline" into "explicitly logged one edit".
const { fs, path, readF, exists } = require('./_qdt.js');

const reason = process.argv.slice(2).join(' ').trim();
const qdir = '.qwen';
const token = path.join(qdir, '.devmode-edit-once');
const P = path.join(qdir, 'PROGRESS.md');

if (!reason) {
  console.log('DEVEDIT_RESULT: refused — a reason is required. Usage: /devedit <why delegating this one edit is pointless>. Nothing was authorised.');
  process.exit(0);
}

// Only meaningful when development mode is actually on for this project.
const devOn = exists('QWEN.md') && readF('QWEN.md').includes('devmode:start');

try { fs.mkdirSync(qdir, { recursive: true }); } catch (_) {}
const now = new Date();
const stamp = now.toISOString().replace('T', ' ').slice(0, 16);
try { fs.writeFileSync(token, stamp + '\n' + reason + '\n', { mode: 0o600 }); }
catch (e) { console.log('DEVEDIT_RESULT: could not write the escape token (' + e.message + '). Nothing authorised.'); process.exit(0); }

// Log the exception into PROGRESS.md (under a Log section if present, else appended).
let logged = false;
if (exists(P)) {
  try {
    const body = readF(P);
    const line = '- ⚠️ devmode escape — one direct architect edit authorised: ' + reason + ' (' + stamp + ')';
    const lines = body.split('\n');
    const li = lines.findIndex((l) => /^##\s.*Log/i.test(l));
    if (li >= 0) {
      let ins = li + 1;
      while (ins < lines.length && !/^##\s/.test(lines[ins])) ins++;
      lines.splice(ins, 0, line);
      fs.writeFileSync(P, lines.join('\n'));
    } else {
      fs.appendFileSync(P, (body.endsWith('\n') ? '' : '\n') + line + '\n');
    }
    logged = true;
  } catch (_) {}
}

console.log('DEVEDIT_RESULT: ONE direct edit authorised' + (devOn ? '' : ' (note: development mode is not currently ON here)') +
  '. The next single write_file/edit by the architect will be allowed, then the authorisation is spent (also auto-expires in 15 min).' +
  (logged ? ' Reason logged to .qwen/PROGRESS.md.' : ' (No .qwen/PROGRESS.md to log into — the token is still staged.)') +
  ' Reason: ' + reason);
