---
description: "[toolkit] Tell the toolkit whether web search is available this session. Web search (the SearXNG MCP / any *_web_search tool) isn't always reachable; when it's down, the toolkit's constant 'search the web' nudges just make the model flail on a dead tool. /search off silences those nudges and tells the model to work from local sources + memory; /search on restores the default; /search status checks."
argument-hint: '[on | off | status]'
disable-model-invocation: true
---

The search-availability state has already been set **deterministically** by the shell below — act on its result, do not re-run it:

!{bash "$HOME/.qwen/commands/_search.sh" {{args}}}

This flips one bit — the presence of `~/.qwen/.search-off` — that the `skill-reminder` hook reads. Default is **ON** (search available). Use `/search off` when the search backend (the SearXNG MCP server, or whatever `*_web_search` tool you rely on) is unreachable, so the model isn't pushed toward a tool that will just fail.

Based on `SEARCH_RESULT`:

- **DISABLED** — confirm web search is off for now: the toolkit will stop telling the model to search, and error/version/prior-art prompts will instead steer it to local files, the repo, `--version`/`--help`, and memory (marking unverified claims). Re-enable with `/search on` once the backend is back.
- **ENABLED** — confirm the default is restored: web-search nudges are active again.
- **status** — report whether search is currently ON or OFF.

Note: this only changes the **nudging** (the main session's `skill-reminder` hook). It does not add or remove the actual search tool — that's your MCP config. It takes effect immediately (the hook reads the flag on every prompt); no restart needed.

User argument: {{args}}
