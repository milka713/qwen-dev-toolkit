---
description: "[toolkit] Set the fast-model permission-classifier transcript window (MAX_TRANSCRIPT_MESSAGES) in the installed qwen-code bundle — fewer messages = shorter classifier prompt = far less cache-busting prefill = faster AUTO-mode verdicts, at no change to safety (same model); stock 40 (~33s on the local 4B) becomes 16 (~13s). Deterministic one-constant patch; applies after restarting qwen-code. /classifier-window <8..40> sets, reset restores 40, status shows current."
argument-hint: '[<N 8..40> | status | reset]'
disable-model-invocation: true
---

The classifier-window patch has already been applied **deterministically** by the shell below — act on its result, do not re-run or hand-edit anything:

!{bash "$HOME/.qwen/commands/_classifier-window.sh" {{args}}}

This patches exactly one constant (`MAX_TRANSCRIPT_MESSAGES`) in the installed qwen-code bundle. Based on `CLASSIFIER_WINDOW_RESULT`:

- **SET / RESET ok** — state the was → now value, and make clear the change **takes effect only after the user restarts / re-opens qwen-code** (the running process already loaded the old bundle).
- **NOOP** — the bundle was already at the requested value; nothing was written.
- **STATUS** — report the current window, whether it differs from stock (40), the chunk path, and the qwen-code version. If it flags DRIFT, offer to re-apply.
- **ERROR** — relay the reason and its suggested fix **verbatim** (qwen not on PATH / constant renamed upstream / more than one definition / bundle not writable). Do **not** try to edit the bundle by hand or guess a path.

Heads-up to pass on: a qwen-code update (`brew upgrade qwen-code`, `npm i -g @qwen-code/qwen-code`) replaces the whole bundle and silently reverts the window to 40. Just re-run this command to reapply — it's idempotent, and the SessionStart check (`classifier-window-check`) will remind you when it drifts.

Lower bound is 8 and stock is 40; the sweet spot is ~16. Safety is unchanged (same model) — this only trades window size for classifier latency.

User argument: {{args}}
