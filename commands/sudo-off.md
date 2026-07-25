---
description: [toolkit] Turn OFF the model's sudo access granted by /sudo-on — wipes the stored password and askpass helper and removes the guidance block, so the model can no longer run sudo and forgets the password. Always safe to run.
---

The command already ran deterministically via the shell below — act on `SUDO_RESULT`:

!{bash "$HOME/.qwen/commands/_sudoctl.sh" off}

Based on `SUDO_RESULT`, confirm to the user that the model's sudo access is now fully revoked (password and askpass helper wiped, guidance removed). This is always safe to run, even if sudo was never enabled.

User argument: {{args}}
