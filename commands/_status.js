#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// /status — the single "everything at a glance" snapshot for THIS project: mode toggles,
// the active plan / development progress (goal, done/remaining, next task — the /dev or any
// other plan currently executing), the global guards + automation hooks, pinned facts, and
// the toolkit version. Read-only. Shares its renderer with /applied via _stateview.js so the
// two can never drift. /status is project-scoped; use /status global for the global state.
const { norm, rawArg } = require('./_qdt.js');
const { render } = require('./_stateview.js');

const GLOBAL = ['global', 'g', '-g', '--global', 'глобал', 'глобально'].includes(norm(rawArg(2)));
console.log(render(GLOBAL ? 'GLOBAL' : 'PROJECT'));
