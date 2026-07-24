#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /applied — DEPRECATED alias of /status. Its introspection was folded into /status (which
// now also shows the active plan / development progress), so this just prints a one-line
// deprecation note and the same shared report. Kept working for one release so existing
// habits/scripts don't break. Scope arg still honoured: /applied global.
const { norm, rawArg } = require('./_qdt.js');
const { render } = require('./_stateview.js');

const GLOBAL = ['global', 'g', '-g', '--global', 'glob', 'глобал', 'глобально'].includes(norm(rawArg(2)));
console.log('NOTE: /applied is deprecated — it is now folded into /status (which also shows plan/dev progress). Showing the same report:\n');
console.log(render(GLOBAL ? 'GLOBAL' : 'PROJECT'));
