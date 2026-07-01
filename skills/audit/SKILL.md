---
name: audit
description: Security review at the architecture and code level — find hardcoded secrets, secrets about to be committed, authn/authz gaps, injection (SQL/command/path), XSS, unsafe deserialization, SSRF, missing input validation, weak crypto, and risky dependencies. Use PROACTIVELY before shipping, before a commit/push, after building an auth/network/file/DB feature, or when the user asks to check security ("is this safe?", "проверь безопасность"). Invoke with /audit or /audit <focus or path>.
argument-hint: '[focus area or path]'
priority: 20
allowedTools:
  - agent
  - run_shell_command
  - grep_search
  - read_file
  - glob
  - edit
  - write_file
---

# /audit — security review (architecture + code)

Review the project (or the recent changes / the path the user named) for security problems, think like an attacker, fix the clearly-safe findings, and report everything by severity.

## Ground rules

- **Every finding needs evidence**: file:line, the untrusted entry point, and how attacker data reaches the sink. If you can't show that path, it's not a vulnerability — at most a one-line LOW/INFO hardening note.
- **Verify before flagging.** A check that's absent from the diff may live in middleware, a decorator, or the caller — open the surrounding code and confirm it's really missing.
- Plain bugs with no security angle belong to `/review` — skip them here.
- **Never print a discovered secret value** in output or the report; identify it by file:line and type only.

## Step 1 — Scope

- If the user gave a path or focus, start there.
- Otherwise audit the **recent change set** (`git diff HEAD` plus untracked new files). Step 2 still covers the whole repo.
- No diff and nothing named → the whole tree.
- For a large codebase, delegate the hunt to read-only `scout` subagents — one per area (auth, input→sink paths, secrets/config, dependencies) — each returning *candidate* findings with file:line evidence. Verify the candidates before reporting — yourself for a small set, or one `verifier` subagent per candidate (refute-first; CONFIRMED/REFUTED/PLAUSIBLE with the exploit path). Never relay candidates blind; report PLAUSIBLE ones only as LOW/INFO with what's unproven.

## Step 2 — Secrets & repo hygiene (always, whole repo)

1. High-signal scan of tracked files:
   `git grep -nE -- '-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_|glpat-|xox[baprs]-|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|sk_live_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{30,}'`
   then a broader pass for `password/secret/api_key/token = "…"` assignments. Judge every hit: placeholders (`YOUR_KEY_HERE`, `example`, `xxx`), test fixtures, and env-var indirection are **fine**; values that look real are findings.
2. Secret **files** tracked by git: `git ls-files | grep -E '(^|/)\.env($|\.)|\.(pem|key|p12|pfx)$|id_rsa|id_ed25519|credentials'` — any hit is **CRITICAL**.
3. `git status`: nothing secret staged; `.gitignore` covers `.env*`, key material, and local secret files.
4. A real secret that is (or ever was) committed stays compromised after deletion. The fix, in order: **rotate the credential first**, then untrack the file, gitignore it, and (if pushed) scrub history.

## Step 3 — Architecture-level review

Reason about the design, not just lines. For each dimension, look for where untrusted data enters and what it can reach:

- **AuthN/AuthZ:** every sensitive operation both authenticated *and* authorized; IDOR (object fetched by client-supplied id with no ownership check); trusting client-sent roles/flags; JWT signature + expiry + audience actually verified; session handling.
- **Trust boundaries:** all external input (HTTP params/headers/cookies, file uploads, env, queue messages) treated as untrusted; mass assignment (request body bound straight to a model/ORM object).
- **Injection sinks:** SQL built by string concatenation (→ parameterized queries); shell commands from input (`os.system`, `exec`, backticks, `shell=True`); path traversal from user input into fs calls; template injection/SSTI; deserializing untrusted data (`pickle`, `yaml.load`, `eval`).
- **XSS:** user data rendered unescaped into HTML (`|safe`, `dangerouslySetInnerHTML`, string-built markup).
- **SSRF / outbound:** user-controlled URLs fetched server-side; open redirects.
- **Secrets handling:** read from env/secret manager (good) vs hardcoded; leaked into logs, error messages, or client responses.
- **Crypto:** MD5/SHA1 for passwords (→ bcrypt/argon2), ECB mode, hardcoded IV/salt/key, TLS verification disabled, homegrown crypto.
- **Config:** debug mode reachable in prod, CORS `*` with credentials, missing security headers, default/weak credentials.
- **Dependencies:** run the cheap ecosystem audit if the tool is already available (`npm audit --omit=dev`, `pip-audit`, `cargo audit`); note obviously abandoned or suspicious packages. Don't install heavy tooling.
- **Static analysis:** if `semgrep` is already installed, run `semgrep --config auto --quiet`, then verify its findings against the code before folding them in. Don't block on it.

## Step 4 — Fix the clearly-safe ones

Directly apply low-risk, unambiguous fixes: move a hardcoded secret to an env var (add a placeholder to `.env.example`, ensure `.gitignore`), parameterize a query, escape output, add an authorization check that mirrors an existing pattern in the codebase, replace a weak hash, disable a debug flag. Then run the project's test/build command to confirm nothing broke.

Leave anything architectural, behavior-changing, or judgment-heavy as a recommendation — don't guess. Don't touch code unrelated to a finding.

## Step 5 — Report

Severity is defined by **who can exploit it**:

- **CRITICAL** — exploitable by an unauthenticated attacker, or a real secret in the repo.
- **HIGH** — exploitable by an authenticated user, or under realistic conditions.
- **MEDIUM** — needs unusual preconditions, or a defense-in-depth gap (verbose errors, missing header).
- **LOW/INFO** — hardening advice. Code that never runs in production (tests, local dev scripts) is downgraded accordingly.

```
CRITICAL — <what> @ <file:line> — <who can exploit it and how> — <fix, or "FIXED: what was done">
HIGH     — ...
MEDIUM   — ...
LOW/INFO — ...
```

Mark what you fixed (and that tests still pass) vs what needs the user's decision. If a dimension is clean, say so in one line — don't invent nitpicks. End with the single most urgent action for the user (e.g. "rotate the AWS key now").

> Note: the deterministic `secret-guard` hook blocks hardcoded secrets at write time — this audit is the architectural backstop that catches what's already in the tree.

---
The user's focus/path argument, if any, follows.
