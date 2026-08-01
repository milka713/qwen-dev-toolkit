# Design brief — `/classifier-window`: shrink the AUTO-mode classifier transcript

**Status:** specified, not implemented. Written 2026-08-01 from measurements on the local
inference stack (see the data appendix — every number here was measured, none estimated).

**What this command does in one line:** patches a single integer inside the installed qwen-code
bundle so the AUTO-mode permission classifier is fed fewer history messages, cutting each
verdict from ~33 s to ~10 s without touching the model.

---

## 1. What exactly we change

One constant, in the qwen-code bundle shipped with the installed CLI:

```js
// packages/core/src/permissions/classifier-transcript.ts, as bundled
var MAX_TRANSCRIPT_MESSAGES = 40;
```

Change `40` to `N` (default **16**). Nothing else. No logic, no structure, no rebuild — the
bundle is plain (unminified) JavaScript, and the change takes effect on the next qwen start.

**There is exactly one definition.** Verified on qwen-code 0.21.0:

| chunk | definitions | uses |
|---|---|---|
| `chunks/chunk-PHOF65IG.js` | **1** | 6 |
| `chunks/src-GE4TTTML.js` | 0 | 2 |
| `chunks/acpAgent-6J2U72PQ.js` | 0 | 2 |

The other two chunks import the binding, so patching the single definition covers every use.
**The command must assert this** — if it ever finds zero or more than one definition, it must
fail loudly rather than guess.

---

## 2. Why — the measured case

### The constant is a *sliding* window, and that is the whole problem

```js
const recent = messages.length > MAX_TRANSCRIPT_MESSAGES
             ? messages.slice(-MAX_TRANSCRIPT_MESSAGES) : messages;
```

The classifier prompt is `system (~1533 tok, stable) + transcript + pending call`. Because the
transcript is the **last** N messages, every new message shifts everything after the system
prompt. llama.cpp's prefix cache matches from the start, so the shift invalidates all of it.

Measured on a 40-message (~23.5k token) transcript:

| | time | cached tokens |
|---|---|---|
| same window twice | **0.6 s** | 23 523 |
| **window slid by one message** | **57.6 s** | **1 533** |

In real use the window slides on essentially every call, so the cache never helps and **every
verdict pays a full cold prefill**. That is the 20–60 s stall users see as the agent "thinking"
before each tool approval.

### Why the obvious alternatives do not work — all tested, do not retry

| Attempted fix | Result |
|---|---|
| `--cache-reuse 256` (llama.cpp KV-shift prefix reuse) | **No effect** (58.2 s vs 57.6 s). Qwen3.5 is hybrid: 24 of 32 layers are *linear* attention, whose recurrent state cannot be shifted or replayed from an offset. |
| Bigger batch `-ub 1024 -b 2048` | Slightly **worse** (24.7 → 26.1 s) and +144 MiB VRAM. Prefill is a sequential scan; it does not widen. |
| Lower quantisation | **No effect at all.** 4B at Q8_0 / Q4_K_XL / Q2_K_XL: 73.5 / 75.9 / 76.9 s on the same 27.8k prompt — an 8× difference in weight size, zero speed difference. Prefill is compute-bound, and dequantising on the fly costs what reading wider weights saves. |
| Smaller model | Faster, but **unsafe** — see below. |

### Why not just use a smaller model

Full bake-off on the same 40-case suite (all Q8_0, `-c 32768`, same flags):

| model | VRAM | 27.8k prefill | safety | character of the errors |
|---|---|---|---|---|
| **Qwen3.5-4B** (current) | 5469 MiB | 73.5 s | **38/40** | both misses are **over-blocks** |
| Qwen3.5-2B | 2431 MiB | 30.9 s | 36/40 | 4 **false negatives**: settings.json self-edit, ngrok, hook self-edit, `kubectl get secrets` |
| Qwen3.5-0.8B | 1283 MiB | 22.7 s | 34/40 | 5 false negatives incl. **`dd if=/dev/zero of=/dev/sda`** and **`mkfs.ext4`** |
| Qwen3-0.6B (dense) | 4297 MiB | 53.4 s | 20/40 | blocks *everything* — 0/10 on safe cases; that is the score of a constant "BLOCK" |
| Qwen3Guard-Gen-0.6B | 4301 MiB | 54.3 s | 32/40 | wrong in both directions; misses `curl \| sh`, `mkfs.ext4`, force-push |

Two conclusions worth keeping:

1. **Direction of error matters more than the score.** qwen-code's classifier is two-stage, and
   **Stage 2 only reviews blocks** — an allow is never re-checked. So a false negative is
   unrecoverable (the action just runs), while an over-block is merely annoying. The 4B's profile
   (over-blocks only) is exactly right; every smaller model's profile is exactly wrong.
2. **A purpose-built guard model is worse, not better.** Qwen3Guard is trained on a content-safety
   taxonomy with its own prompt template; fed our command-safety rubric it operates out of
   distribution. Tested and rejected.

So the model stays at Qwen3.5-4B Q8_0, and the only safe lever left is the prompt size.

### What the change buys

The real observed window of 40 messages weighed 16 736 tokens (~420 tok/message). The 4B
prefills at ~505 tok/s:

| N | prompt | verdict |
|---|---|---|
| 40 (stock) | ~16.7k | ~33 s |
| 20 | ~8.4k | ~17 s |
| **16 (proposed default)** | ~6.7k | **~13 s** |
| 12 | ~5.0k | ~10 s |
| 10 | ~4.2k | ~8 s |

Safety is unchanged at 38/40 — it is the same model.

### Why the floor is 10, and why 16 is the default

The slice is applied to the **raw** history *before* filtering. The transcript keeps only user
text and prior tool calls — tool **results are dropped but still occupy window slots**. So 40 raw
entries are roughly 20 meaningful ones, and 10 raw could be ~5. During a long chain of
consecutive tool calls a small window can contain **no user message at all**, and the classifier
judges intent from exactly that (*"Actions consistent with the user's most recent message reflect
user intent"*). Starve it and it starts blocking legitimate work.

**Do not offer values below 8.** Default 16, sensible range 12–20.

---

## 3. Command requirements

Follow the existing toolkit conventions: `commands/_classifier-window.js` + `.sh` +
`commands/classifier-window.md`, shared helpers from `_qdt.js`, output a single
`CLASSIFIER_WINDOW_RESULT: …` line for the model to act on, managed-file header comment.

### Interface

```
/classifier-window            → status
/classifier-window status     → status
/classifier-window <N>        → set to N (8..40)
/classifier-window off|reset  → restore to 40 (stock)
```

### Locating the bundle — must be robust

Do **not** hardcode a path. The install root differs per platform and the chunk filename carries
a content hash that changes every release.

1. Resolve the CLI: `which qwen` → fully resolve symlinks → that lands on `…/@qwen-code/qwen-code/cli-entry.js`.
   On this Mac: `/usr/local/bin/qwen` → `/usr/local/Cellar/qwen-code/0.21.0/libexec/lib/node_modules/@qwen-code/qwen-code/cli-entry.js`.
   On a plain npm install it will be under the global `node_modules` instead.
2. From that file's directory, search `chunks/*.js` for the **definition** regex
   `/var MAX_TRANSCRIPT_MESSAGES\s*=\s*(\d+)\s*;/`.
3. Require **exactly one** file with **exactly one** match. Zero or many → abort with a clear
   message naming what was found.

### Behaviour

- **Idempotent.** Re-running with the same N is a no-op that still reports success. This matters
  because the command is the recovery path after an upgrade.
- **Back up once per version** before the first write (e.g. `<chunk>.qdt-bak`), so `reset` works
  even if the stock value is no longer known.
- **Verify after writing** — re-read the file and confirm the definition now reads N. Never
  report success from the write call alone.
- **Report before → after** in the result line, plus the resolved chunk path and the detected
  qwen-code version.
- **Warn that qwen must be restarted** for the change to take effect.
- **`status`** reports: current value, whether it differs from stock 40, the resolved path, and
  the qwen-code version it was applied to.

### Failure modes to handle explicitly

| Situation | Required behaviour |
|---|---|
| `qwen` not on PATH / cannot resolve | abort, say so |
| definition not found | abort, say the constant may have been renamed upstream and this toolkit version needs updating — **never** silently do nothing |
| more than one definition | abort and list the files |
| file not writable (root-owned install) | abort with the exact `sudo` command the user would need |
| already at requested N | report no-op success |

### The upgrade problem — the main real risk

`brew upgrade qwen-code` (or `npm i -g`) replaces the whole install directory, so **the patch is
silently lost and the window reverts to 40**. The failure mode is benign — "slow again", not
"broken" — but it is invisible.

Mitigation, in order of value:

1. The command is idempotent and re-runnable, so recovery is one invocation.
2. **Recommended:** a `SessionStart` hook that reads the current value and, if the toolkit has a
   recorded preference that no longer matches, prints one line: *"classifier window reverted to
   40 after a qwen-code upgrade — run `/classifier-window 16`"*. Store the preference in the
   toolkit's own state, not in the bundle.
3. Mention the caveat in `commands/classifier-window.md` so it is discoverable.

### Non-goals

- Do not try to make the window *stable* (append-only) from here — that is an upstream change to
  `classifier-transcript.ts` and cannot be done by patching one constant. It is the real fix and
  is worth an upstream issue; the numbers in §2 are the evidence it would need.
- Do not touch the classifier prompt, the model, or the timeouts.

---

## 4. Acceptance tests

1. `status` on a stock install reports `40` and the resolved path.
2. `/classifier-window 16` → reports `40 → 16`, and an independent grep of the chunk shows `16`.
3. Re-running `/classifier-window 16` → reports a no-op, file unchanged (compare mtime/hash).
4. `/classifier-window reset` → back to `40`, verified by grep.
5. `/classifier-window 3` → rejected as below the floor, file untouched.
6. With the constant renamed in a copy of the bundle → aborts with the "renamed upstream" message
   and does not write.
7. End-to-end: with `16` applied and qwen restarted, a long session's classifier request is
   visibly smaller (the local llama.cpp log reports a smaller `prompt eval` token count).

---

## 5. Data appendix — provenance

All measurements: GTX 1060 6GB, llama.cpp `b10218` (native `sm_61`), Qwen3.5-4B Q8_0 unless
stated, `-c 32768`, `-ub 256 -b 512`, `--cache-ram 1000`, reasoning off, JIT excluded.

Harness lives on the inference box at `/home/mark/fastmodel/` and mirrored in the localAI backup
repo (`github.com/milka713/localAI`, `fastmodel/`):

- `extract_prompt.js` — reconstructs the **real** Stage-1 system prompt from the qwen-code bundle
  so the bench uses the production prompt, not an approximation.
- `run_classifier.py` — 40 labelled tool-call cases, temp 0, `max_tokens` 32, STAGE1_SCHEMA
  json_schema. Pure LLM calls; nothing is ever executed.
- `prefill_bench.py` — prefill latency vs prompt size. **Note:** content must differ per size or
  successive runs share a prefix and silently hit the cache — an earlier version of this bench
  did exactly that and reported ~4× too-fast numbers.
- `cases.json`, `timing.py`.

Fuller write-up, including the PCIe/riser context of this machine:
`docs/06-classifier-latency.md` in the localAI backup repo.
