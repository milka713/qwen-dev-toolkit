#!/usr/bin/env node
// qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. Source & docs: https://github.com/milka713/qwen-dev-toolkit
'use strict';
// Backend for /search — declare whether web search is available this session.
// State: presence of ~/.qwen/.search-off means web search is OFF. When OFF, the skill-reminder
// hook stops nudging the model toward a `*_web_search` tool (and instead tells it to use local
// sources), so a missing/unreachable search MCP doesn't make the model flail on a dead tool.
// Default (no file) = search ON. Toggle: /search off | /search on | /search status.
const { fs, path, norm, qHome, rawArg } = require('./_qdt.js');

const QHOME = qHome();
const OFF = path.join(QHOME, '.search-off');
const n = norm(rawArg(2));
const off = () => { try { fs.statSync(OFF); return true; } catch (_) { return false; } };

if (n === 'off' || n === 'disable' || n === 'no' || n === 'unavailable') {
  fs.mkdirSync(QHOME, { recursive: true });
  fs.writeFileSync(OFF, '');
  console.log('SEARCH_RESULT: web search DISABLED. The toolkit will stop nudging you to search the web; work from local files, the repo, and memory, and mark unverified claims as such. Re-enable with /search on.');
} else if (n === 'on' || n === 'enable' || n === 'yes' || n === 'available' || n === 'reset') {
  try { fs.unlinkSync(OFF); } catch (_) {}
  console.log('SEARCH_RESULT: web search ENABLED (default). Use the query search tool (prefixed MCP, e.g. `mcp__searxng__searxng_web_search`) for anything outside this repo and memory — errors, APIs, versions, prior art.');
} else if (n === 'status' || n === '') {
  console.log(off()
    ? 'SEARCH_RESULT: web search is currently OFF (/search off). The model is told not to attempt web searches this session.'
    : 'SEARCH_RESULT: web search is currently ON (default). The model may use a `*_web_search` tool (e.g. `mcp__searxng__searxng_web_search`).');
} else {
  console.log('SEARCH_RESULT: usage — /search on | /search off | /search status. (off = tell the model web search is unavailable this session, so it stops trying.)');
}
