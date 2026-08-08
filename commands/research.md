---
description: "[toolkit] Research-first directive — think & investigate before flailing. ON by default in every project (after a failed fix/build, on a shaky/hacky solution, or when missing info: look at the real current state → project docs → the web, and in brainstorm find prior art, before more blind edits or asking the user). This command only lets a project OPT OUT — /research off disables it here, /research on re-enables, /research status checks. The /research skill has the full how-to."
argument-hint: '[on | off | status]'
---

The research-first opt-out switch has already been applied deterministically by the shell below — act on its result, do not re-toggle it:

!{bash "$HOME/.qwen/commands/_research.sh" {{args}}}

Research-first is **on by default everywhere** — the directive lives in the global `~/.qwen/QWEN.md`, and the detailed playbook is the `/research` skill. Based on `RESEARCH_RESULT`:
- **ON / already ON**: confirm you'll investigate before flailing — when a fix/build fails, a solution feels shaky, or info is missing, check the real current state → the project's docs → the web (or delegate to the `researcher` subagent) before more blind attempts or before asking; in brainstorm, find prior art first. Point to the `/research` skill for how to search well.
- **OFF for this project**: the opt-out block is pinned in this project's `QWEN.md`; don't auto-research here — act on what you have and ask the user when unsure. (Mention that `/research on` restores it.)
- **status**: report whether it's ON (default) or OFF (opted out) for this project.

User argument: {{args}}
