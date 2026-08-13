#!/usr/bin/env node
// ⚠ qwen-dev-toolkit — MANAGED FILE. Do NOT hand-edit: /toolkit-update overwrites it, and
// /toolkit-reset / reinstall can replace it. To switch this hook off use `/hooks off <name>`
// (do not delete it). Source & docs: https://github.com/milka713/qwen-dev-toolkit
// UserPromptSubmit hook — nudges the model to invoke the right toolkit skill/command.
// Small local/Qwen models under-trigger model-invoked skills, especially mid-plan; a
// short reminder injected at the moment of the prompt (max proximity to execution) fixes
// this far better than a paragraph the model may never load. Stays silent unless the
// prompt clearly matches, and stays short to preserve the tiny context budget.
// Output: hookSpecificOutput.additionalContext, or exit 0 (no injection).
'use strict';
try { if (require('./_hookutil.js').disabled('skill-reminder')) process.exit(0); } catch (_) {}
const fs = require('fs');
const os = require('os');
const path = require('path');

let prompt = '';
try { prompt = (JSON.parse(fs.readFileSync(0, 'utf8') || '{}').prompt) || ''; } catch (_) { process.exit(0); }
const p = prompt.toLowerCase().trim();
if (!p || p.startsWith('/')) process.exit(0);            // already a command/skill, or empty
if (p.length < 12) process.exit(0);                      // trivial one-liners — don't nag

// /search off: web search is unavailable this session. Instead of nudging the model toward a
// dead `*_web_search` tool (which just makes it flail), we collapse every web-search hint into
// a single "don't try, use local sources" note. Non-search hints still fire normally.
const QHOME = process.env.QWEN_HOME || path.join(os.homedir(), '.qwen');
let searchOff = false;
try { fs.statSync(path.join(QHOME, '.search-off')); searchOff = true; } catch (_) {}
const isWebHint = (h) => /_web_search|search the web|RESEARCH FIRST/.test(h);
const SEARCH_OFF_NOTE = 'web search is OFF for this session (`/search off`) — do NOT attempt a web / `*_web_search` call; answer from local files, the repo, `--version`/`--help`, and memory, and mark anything you could not verify as unverified rather than looping on a missing tool';

// Skills the model can invoke itself (via the skill tool) → "use it".
// Commands the model CANNOT invoke (user-only slash commands) → "suggest the user run it".
// Every rule matches BOTH English and Russian (the toolkit's users prompt in either).
// NOTE: JS \b is ASCII-only — it never fires next to Cyrillic letters, so the Russian
// alternatives deliberately use plain substrings/groups, never \b.
const rules = [
  // "I already told you this" — the user should never have to repeat a pinned fact. Highest
  // priority because it is unambiguous and the remedy is one cheap read. The context copy of
  // FACTS.md is a session-start snapshot, so re-reading from disk is the point.
  [/\b(i (already )?(gave|told|sent|shared) you|you (already )?have (it|that|this)|i pinned|i already (said|mentioned)|as i (said|mentioned) (before|earlier))\b/, 'the value is probably already pinned — read `FACTS.md` from disk (the copy in context is only a session-start snapshot), and check `.qwen/PROGRESS.md` / `grep` the repo, before asking the user again'],
  [/я (тебе |вам )?(уже )?(давал|говорил|скидывал|присылал|отправлял|сообщал)|я (это )?(за)?пинил|уже (же )?(говорил|давал|скидывал)|ты (же )?(это )?знаешь|я же (говорил|давал)|тебе (это )?(уже )?давали/, 'the value is probably already pinned — read `FACTS.md` from disk (the copy in context is only a session-start snapshot), and check `.qwen/PROGRESS.md` / `grep` the repo, before asking the user again'],
  // Explicit "go look it up" — if the user has to say this, a trigger was missed; make the
  // tool name discoverable, since MCP search is exposed prefixed and models miss it.
  [/\b(google (it|that)|search (the web|online)|look (it|that) up( online)?|find out online|check online)\b/, 'search the web now — an MCP search tool is exposed prefixed, e.g. `mcp__searxng__searxng_web_search` (match any `*_web_search`), then `web_fetch`/`mcp__searxng__web_url_read` the best hit'],
  [/погугли|загугли|поищи (в интернете|в сети|инфу|информаци)|найди (в интернете|в сети)|поиск в интернете|посмотри в интернете|поищи онлайн/, 'search the web now — an MCP search tool is exposed prefixed, e.g. `mcp__searxng__searxng_web_search` (match any `*_web_search`), then `web_fetch`/`mcp__searxng__web_url_read` the best hit'],
  // A concrete error identifier in the prompt (TS5109, ERR_PNPM_OUTDATED_LOCKFILE, E0308,
  // SomethingError:) is the strongest possible search signal: the string is distinctive, the
  // answer is one search away, and guessing at a cause is precisely the thrashing loop the
  // research skill exists to stop. Matched case-INsensitively on the lowercased prompt, so
  // the character classes below are deliberately lowercase.
  [/\b(err_[a-z0-9_]{4,}|ts\d{4}|e\d{4}\b|[a-z]{2,6}\d{3,5}\b(?=[:\s]))|\b[a-z]+(error|exception):/, 'search the web for that exact error identifier before theorising about the cause — paste the distinctive part verbatim into the `*_web_search` tool (MCP search is prefixed, e.g. `mcp__searxng__searxng_web_search`), then read the authoritative hit'],
  [/(ошибк\w*|падает с|вылетает с|ругается)[\s\S]{0,40}(err_[a-z0-9_]{4,}|ts\d{4}|[a-z]{2,6}\d{3,5})/, 'search the web for that exact error identifier before theorising about the cause — paste the distinctive part verbatim into the `*_web_search` tool (MCP search is prefixed, e.g. `mcp__searxng__searxng_web_search`), then read the authoritative hit'],
  // "Is X still the right way" / "what's the recommended way" — a best-practice claim that
  // silently expires. Note the optional article/adjective: "still THE RECOMMENDED way".
  [/\bis\s+\S+\s+still\s+(the\s+)?\w*\s*(supported|maintained|recommended|standard|preferred|idiomatic|best)\b|\b(recommended|idiomatic|standard|best)\s+way\s+to\b|\bbest practice\b/, 'search the web before answering — "recommended/standard/best practice" claims expire silently, so verify against current official docs with the `*_web_search` tool (MCP search is prefixed, e.g. `mcp__searxng__searxng_web_search`) instead of answering from memory'],
  [/(всё ещё|все ещё|еще|по-прежнему)[\s\S]{0,24}(рекоменд|актуал|поддерж|принят)|как (сейчас )?(правильно|принято|рекомендуется)|лучш(ая|ие) практик/, 'search the web before answering — "recommended/standard/best practice" claims expire silently, so verify against current official docs with the `*_web_search` tool (MCP search is prefixed, e.g. `mcp__searxng__searxng_web_search`) instead of answering from memory'],
  // Version / recency questions: answering these from memory is a guess with a confident voice.
  [/\b((latest|newest|current)\s+(stable\s+|lts\s+)?(version|release)|what'?s new in|release notes|changelog for|is\s+\S+\s+still\s+(supported|maintained|recommended)|as of (today|now|20\d\d))\b/, 'search the web before answering — a version/date/recency answer from memory is a guess (your knowledge has a cutoff); MCP search is exposed prefixed, e.g. `mcp__searxng__searxng_web_search` (match any `*_web_search`), then read the authoritative page'],
  [/послед(няя|нюю|ней|нюю)\s+верси|актуальн(ая|ую|ой)\s+верси|какая (сейчас |нынче )?верси|что нового в|релиз.?ноутс|список изменений|(ещё|еще) (поддерживается|актуал)|на сегодняшний день|сейчас актуальн/, 'search the web before answering — a version/date/recency answer from memory is a guess (your knowledge has a cutoff); MCP search is exposed prefixed, e.g. `mcp__searxng__searxng_web_search` (match any `*_web_search`), then read the authoritative page'],
  [/\b(secur(e|ity)|vulnerab|exploit|injection|sql\s*inject|\bauthz?\b|authentication|owasp|cve|sanitiz|hardcoded|leak)/, 'invoke the `/audit` skill (security review of architecture + code)'],
  [/безопасн|уязвим|инъекц|захардкож|хардкод|утечк|взлом/, 'invoke the `/audit` skill (security review of architecture + code)'],
  [/\b(from scratch|build me|implement|scaffold|create|write)\b[\s\S]{0,48}\b(app|application|service|api|cli|tool|module|feature|system|project|backend|server|library|package|pipeline|bot)\b/, 'invoke the `/implement` skill (architect + delegated implementer subagents; the user can also pin the mode with `/dev`)'],
  [/(сделай|создай|напиши|собери|реализуй|запили|разработай)[\s\S]{0,60}(приложени|сервис|апи|бота|бот[\s.,!?]|проект|систем|модул|инструмент|утилит|библиотек|сайт|бэкенд|сервер|фич)|с нуля/, 'invoke the `/implement` skill (architect + delegated implementer subagents; the user can also pin the mode with `/dev`)'],
  [/\b(unit ?tests?|test coverage|coverage|tdd|test[- ]first|write tests|add tests|pytest|jest|vitest)\b/, 'suggest the user run `/cover` (test-first mode with a measured coverage target, default 80%)'],
  [/(напиши|добавь|создай|сделай|нужны)[\s\S]{0,30}тест|покрыти|юнит.тест/, 'suggest the user run `/cover` (test-first mode with a measured coverage target, default 80%)'],
  [/\b(brainstorm|clarify requirements|what should|how should i (design|structure|approach)|figure out the design)\b/, 'invoke the `/brainstorm` skill to nail the requirements first'],
  [/брейншторм|мозгов(ой|ого) штурм|уточни(м|ть)? требован|как лучше (сделать|устроить|спроектировать|подойти)/, 'invoke the `/brainstorm` skill to nail the requirements first'],
  [/\b(plan|design|architect(ure)?|break (this|it) (down|into)|decompose)\b/, 'invoke the `/plan` skill (dependency-ordered task list)'],
  [/(составь|сделай|напиши|продумай|нужен)[\s\S]{0,20}план|разбей [\s\S]{0,20}(на|по) (част|задач|шаг)|декомпоз|спроектируй|архитектур/, 'invoke the `/plan` skill (dependency-ordered task list)'],
  [/\b(please remember|remember:|remember (that|this|for|to|the|my|our|about|:)|note (that|this|down|:)|keep in mind|don'?t forget|save (this|that|the)|jot down|make a note)/, 'suggest the user run `/pin <fact>` to keep it compaction-proof in context (you can also save it to memory)'],
  [/запомни|запиши (что|это|себе)|не забудь|не забывай|имей в виду|возьми на заметку/, 'suggest the user run `/pin <fact>` to keep it compaction-proof in context (you can also save it to memory)'],
  [/\b(context (is )?(full|getting (full|long|big))|losing track|you forgot|compact(ion)?|running low on context)\b/, 'invoke the `/checkpoint` skill (save durable state before it overflows)'],
  [/контекст (полон|заканчивается|переполн|забива)|ты (всё |все )?забыл|теряешь нить|компакт/, 'invoke the `/checkpoint` skill (save durable state before it overflows)'],
  [/\b(update (the )?(docs|readme|documentation))\b|обнови (доки|док|документаци|readme)/, 'invoke the `/docs` skill (sync the documentation with the code)'],
  [/\b(cut (a|the) release|publish (a|the )?release|make (a|the) release|tag (a|the) (new )?(version|release)|github release)\b|выпусти релиз|нарежь релиз|нарезать релиз|опубликуй релиз|создай релиз|сделай релиз|выкати релиз/, 'invoke the `/release` skill (cut the tag + GitHub Release from CHANGELOG so the published release matches the code; `/release check` just audits drift)'],
  [/\b(look up|check the docs|read the docs|which version of|how (do|to) (i |you )?use)\b/, 'delegate a `researcher` subagent for a version-pinned API digest instead of answering from memory'],
  [/посмотри (в )?док|глянь (в )?док|какая версия (у|в|библиотек)|как (пользоваться|использовать|юзать)/, 'delegate a `researcher` subagent for a version-pinned API digest instead of answering from memory'],
  [/\b(review (this|the|my) (code|diff|change|changes|pr)|code review)\b|сделай ревью|проведи ревью|отревьюй|проверь код на (баги|ошибки)/, 'invoke the `/review` skill (correctness & quality pass over the recent diff; security angles go to `/audit`)'],
  [/\b(not working|does ?n'?t work|is ?n'?t working|still (failing|broken|not working)|keeps? (failing|breaking|crashing)|ca ?n'?t (get it to|figure out|fix)|stuck on|no idea why|why (is|does|wo ?n'?t|does ?n'?t) (it|this))\b/, 'follow the `/research` skill — investigate first (real state → docs → web) instead of retrying blind fixes'],
  [/не работает|не пашет|не заводится|не могу (починить|разобраться|исправить|понять почему)|почему не (работает|запуска|заводит|пашет)|(всё|все) равно (падает|ошибка|не работает)|застрял|не получается (починить|заставить|исправить)/, 'follow the `/research` skill — investigate first (real state → docs → web) instead of retrying blind fixes'],
  // Adopting something new — installing a package/tool, migrating, upgrading, deploying — is a
  // big, hard-to-reverse step, and install steps + "current recommended version" are exactly the
  // facts that expire silently after a knowledge cutoff. The point is PREVENTIVE: search while
  // still planning, not after the install has already gone sideways. Deliberately worded as a
  // conditional so the frequent innocent senses of "поставь"/"add" (put a semicolon, add a field)
  // cost the model only a glance.
  [/^(?![\s\S]*(fail|broken|crash|error|does ?n'?t work|not working))[\s\S]*?(^|\b(let'?s|lets|please|can you|could you|we should|i want to|need to|time to)\s+)(install|set ?up|add|adopt)\s+[\w@.\/-]{2,}|\b(migrate (to|from)|switch (to|over to) (a |the )?\w+|upgrade to \S+|bump \S{0,20}to (v?\d|latest))\b/, 'if this means adding or replacing a dependency/tool, RESEARCH FIRST — before touching anything, search the web (prefixed MCP search, any `*_web_search`, e.g. `mcp__searxng__searxng_web_search`) for the current recommended version and the official install steps, and check the repo\'s own manifest/lockfile; do not reconstruct install commands from memory'],
  [/^(?![\s\S]*(ошибк|падает|не работает|сломал|не заводится|вылетает))[\s\S]*?((поставь|установи|заинсталл|доустанови|накати)\s+[\w@.\/-]{2,}|добавь\s+(библиотек|пакет|зависимост|модуль|фреймворк)|подключи\s+(библиотек|пакет|модуль|фреймворк)|перейд[её]м?\s+на\s+\S|переведи\s+(проект\s+)?на\s+\S|мигриру|обнови\s+до\s+\S|разверни\s+(на|сервер|сервис)|внедри\s+\S)/, 'if this means adding or replacing a dependency/tool, RESEARCH FIRST — before touching anything, search the web (prefixed MCP search, any `*_web_search`, e.g. `mcp__searxng__searxng_web_search`) for the current recommended version and the official install steps, and check the repo\'s own manifest/lockfile; do not reconstruct install commands from memory'],
  [/\b(format (the |an? )?(sd|usb|micro ?sd|disk|card)|flash (an? )?(image|os|sd|card)|burn (an? )?(image|iso)|write .{0,24}(image|\.img|iso) to|\bdd (if=|of=|bs=)|diskutil|balena ?etcher|raspberry pi imager)\b/, 'follow the `/terminal` skill — hand the command to the user\'s own terminal (you can, via `open -a Terminal`), don\'t run interactive/destructive disk commands in your own shell'],
  [/отформат|прошить (образ|карту|флешк|sd|мicro)|прошей (образ|карту|флешк)|запиши образ|записать образ|образ на (карту|флешк|sd|микро)|нарезать образ|отформатируй (карту|флешк|sd)/, 'follow the `/terminal` skill — hand the command to the user\'s own terminal (you can, via `open -a Terminal`), don\'t run interactive/destructive disk commands in your own shell'],
];

const hits = [];
for (const [re, hint] of rules) {
  if (!re.test(p)) continue;
  const h = (searchOff && isWebHint(hint)) ? SEARCH_OFF_NOTE : hint;  // suppress dead-search nudges
  if (!hits.includes(h)) hits.push(h);
  if (hits.length === 2) break;
}
if (!hits.length) process.exit(0);

const msg =
  'Toolkit hint — this request may fit: ' + hits.join('; ') +
  '. Do so only if it genuinely applies; for a quick question or one-line edit, just answer directly.';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '[toolkit] ' + msg },
}));
