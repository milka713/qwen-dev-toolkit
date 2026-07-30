---
name: terminal
description: [toolkit] Hand a command off to the USER'S real terminal when you can't or shouldn't run it yourself — an interactive sudo password prompt, disk work (`dd`, `diskutil`, formatting an SD card), flashing an image, or any long/interactive/destructive session. You already have the ability (via `open`/`osascript` on macOS); this is how to use it, safely, and what to do when a permission is missing. Invoke with /terminal, or follow it whenever a needed command can't run in your own non-interactive shell.
priority: 15
allowedTools:
  - run_shell_command
  - read_file
  - write_file
---

# /terminal — hand a command to the user's own terminal

Your `run_shell_command` runs **non-interactively**: it can't answer a `sudo` password
prompt, can't drive a curses UI, and shouldn't silently perform an irreversible disk
operation. When a task needs one of those, **don't give up, don't fake success, and don't
try to force it through your own shell** — open the **user's real terminal** with the
command ready, so they run it under their own eyes and privileges. You *can* do this; most
models just don't realise it.

## When to hand off (instead of running it yourself)

- **Interactive `sudo`** — a command that will prompt for the user's password (your shell
  can't type it; never ask them to paste their password to you).
- **Disk / device operations** — `dd`, `diskutil`, `mkfs`, `parted`, formatting or
  flashing an SD card / USB, writing an OS image. Irreversible and device-specific.
- **Long or interactive sessions** — an installer with prompts, a REPL, `top`/`htop`, a
  process the user needs to watch or Ctrl-C themselves.
- **Anything the user should see happen** on their own machine before it's real.

## macOS — the reliable way: `open -a Terminal` a script

The **most robust** method (no AppleScript escaping, and **no special permission needed**)
is to write the command(s) to a `.command` file and open it — Terminal runs it:

```bash
cat > /tmp/qdt-handoff.command <<'SCRIPT'
#!/bin/bash
# <put the exact command(s) here — pipes, sudo, quotes all fine, no escaping>
xz -dc ~/Downloads/ubuntu-…-raspi.img.xz | sudo dd bs=1m of=/dev/rdisk2 status=progress
SCRIPT
chmod +x /tmp/qdt-handoff.command
open -a Terminal /tmp/qdt-handoff.command
```

`open` does **not** use Apple Events, so it sidesteps the Automation/Accessibility
permission wall entirely. The user gets a Terminal window running the script; `sudo`
prompts *them* for the password there. Use a heredoc so pipes and quotes need no escaping.

### Alternative: `osascript … do script` (auto-runs in Terminal)

```bash
osascript -e 'tell application "Terminal" to activate' \
          -e 'delay 0.3' \
          -e 'tell application "Terminal" to do script "COMMAND HERE"'
```

Use **separate `-e` clauses** (multi-line `-e '…'` with a leading newline throws
`syntax error … found "script"`). Inside `do script "…"`, escape `"`→`\"` and `\`→`\\`.
`do script` **auto-runs immediately**, so prefer the `.command` file for anything with
pipes/quotes. **Do not use `keystroke` / System Events** to type the command — it needs
Accessibility permission (fails with *"osascript is not allowed to send keystrokes (1002)"*)
and is brittle. `do script` / `open` are strictly better.

## When a permission IS missing — explain, don't just fail

If you use the `osascript` path and hit one of these, tell the user plainly what to enable:

- **`Not authorized to send Apple events` / error `-1743`** → **Automation** permission:
  **System Settings → Privacy & Security → Automation** → enable the controlling app's
  access to **Terminal**.
- **`not allowed to send keystrokes` / error `1002`** → **Accessibility** permission:
  **System Settings → Privacy & Security → Accessibility** → enable the controlling app.
  (Better: stop using `keystroke` and switch to the `open -a Terminal` method above, which
  needs neither.)

Explain it in one or two lines, name the exact toggle, and say you'll retry once they've
granted it. Never route around a denied permission by another trick — that's the user's
call to make.

## Safety for irreversible commands (dd, format, erase)

- **Never guess the target device.** Before any `dd`/`diskutil erase`, have the user
  confirm the disk: hand off `diskutil list` first (or show its output) and confirm which
  `/dev/rdiskN` is the SD card — writing to the wrong one destroys data.
- **Show the exact command** in chat before handing it off, and say what it will do.
- **Make the destructive step pause for a human.** Put a guard at the top of the handoff
  script so a wrong device isn't wiped the instant Terminal opens:
  ```bash
  echo "About to write to /dev/rdisk2 — this ERASES it."
  read -p "Ctrl-C to abort, or Enter to proceed… "
  ```
- Prefer `/dev/rdiskN` (raw) over `/dev/diskN` for speed, and `bs=1m status=progress`.

## Other platforms (brief)

- **Linux (GUI):** `x-terminal-emulator -e bash -c '<cmd>; exec bash'` (or
  `gnome-terminal -- bash -c '…'`, `konsole -e …`). On a **headless server** there's no
  window to open — just tell the user the exact command to run over SSH.
- **Windows:** `start cmd /k "<cmd>"` (or `start powershell -NoExit -Command "<cmd>"`).

The point is always the same: when you can't run it, **hand the user a ready-to-run command
in their own terminal and explain it** — never stall, and never pretend it ran.
