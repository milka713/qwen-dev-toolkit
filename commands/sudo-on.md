---
description: "[toolkit] DANGER (sudo) — grant the local model FULL PASSWORDLESS ROOT (any sudo command) on THIS machine. Off by default. /sudo-on <password> stages it and shows a warning, /sudo-on confirm actually enables it, /sudo-on status checks. Turn OFF with /sudo-off. A wrong or looping model with this on can irreversibly destroy the machine, so only on boxes you own and accept losing."
argument-hint: '<sudo-password> | confirm | status'
disable-model-invocation: true
---

> ☢️ **EXTREME DANGER.** This hands the local model **full, passwordless `sudo`** on this machine. A mistaken or looping model can **irreversibly wreck the system** (wipe files, drop firewall rules, brick services). This exists only because the operator explicitly asked for it. Enable it only on a machine you own and can afford to lose, and run `/sudo-off` the instant you're done.

The command already ran deterministically via the shell below — act on `SUDO_RESULT`, do not try to enable/disable sudo any other way yourself:

!{bash "$HOME/.qwen/commands/_sudoctl.sh" on {{args}}}

Based on `SUDO_RESULT`:
- **A warning + "staged" message** (from `/sudo-on <password>`): relay the danger to the user in plain, strong words and **ask them to confirm they really want full root for the model**. Do **not** run confirm for them — only the user themselves types `/sudo-on confirm`.
- **"sudo is now ACTIVE"**: tell the user, loudly, that the model now has full root and it stays on until `/sudo-off`. From now on, run privileged commands only via the `SUDO_ASKPASS=... sudo -A <command>` form shown, do **exactly** what the user asked and nothing more, and never print/echo/cat the password or the askpass file.
- **status / pending / off**: report the state plainly.

User argument: {{args}}
