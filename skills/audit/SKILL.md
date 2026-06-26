---
name: audit
description: Security review at the architecture and code level — find hardcoded secrets, secrets about to be committed, authn/authz gaps, injection (SQL/command/path), unsafe deserialization, SSRF, missing input validation, weak crypto, and risky dependencies. Use before shipping, before a commit/push, after building an auth/network/file/DB feature, or when the user asks to check security. Invoke with /audit or /audit <focus or path>.
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

Review the project (or the recent changes / the path the user named) for security problems, think like an attacker, and report findings ordered by severity. Fix the clearly-safe ones; flag the rest with a concrete remediation.

## Step 1 — Scope

- If the user gave a path or focus, start there.
- Otherwise prefer the **recent diff** (`git diff`, `git diff --staged`, `git diff HEAD`); fall back to the whole tree if there's no diff.
- For a large codebase, delegate the breadth-first hunt to a read-only `scout` subagent (or several) and aggregate — keep your own context lean.

## Step 2 — Secrets & repo hygiene (do this first, every time)

1. Hunt for hardcoded credentials in tracked files: API keys, tokens, private keys, passwords, connection strings with embedded passwords. Use targeted greps (`-----BEGIN`, `AKIA`, `sk-`, `api_key`, `password`, `secret`, `token=`).
2. Check nothing secret is staged or committed: inspect `git status`, and whether `.env`, `*.pem`, `*.key`, `id_rsa`, `credentials*` are tracked. If any secret file is tracked, that's a **critical** finding — it must be removed from the index and added to `.gitignore` (and, if already pushed, the secret rotated and history scrubbed).
3. Confirm there's a `.gitignore` covering `.env`, key material, and local secret files.

## Step 3 — Architecture-level review

Reason about the design, not just lines:

- **AuthN/AuthZ:** is every sensitive operation actually authenticated and authorized? Look for missing checks, IDOR (object access by id with no ownership check), trusting client-supplied roles, JWT verified properly (signature + expiry + audience), session handling.
- **Trust boundaries & input:** is all external input (HTTP params, headers, files, env, message payloads) validated and treated as untrusted? Where does untrusted data reach a sink?
- **Injection sinks:** SQL built by string concatenation (use parameterized queries), shell commands built from input (`os.system`/`exec`/backticks), path traversal from user input, template/SSTI, deserialization of untrusted data.
- **SSRF / outbound:** user-controlled URLs fetched server-side; unrestricted redirects.
- **Secrets handling:** secrets read from env/secret-manager (good) vs hardcoded; secrets logged or returned in errors.
- **Crypto:** no MD5/SHA1 for passwords (use bcrypt/argon2), no ECB, no hardcoded IV/salt, TLS verification not disabled.
- **Transport & config:** debug mode off in prod, permissive CORS (`*` with credentials), security headers, default/weak credentials.
- **Dependencies:** obviously outdated or known-risky packages; run the ecosystem audit if cheap (`npm audit`, `pip-audit`).

## Step 4 — Report

Group findings by severity and make each one actionable:

```
CRITICAL — <what> @ <file:line> — <why it's exploitable> — <fix>
HIGH     — ...
MEDIUM   — ...
LOW/INFO — ...
```

Be specific (file:line, the exact sink, the concrete fix). Don't pad with generic advice; if the code is clean on a dimension, say so briefly.

## Step 5 — Fix the safe ones

Directly apply low-risk, unambiguous fixes: move a hardcoded secret to an environment variable (and add it to `.gitignore`/`.env.example`), parameterize a SQL query, add a missing authorization check that mirrors an existing pattern, replace a weak hash. Leave anything risky or architectural as a clearly-described recommendation for the user to decide. Verify fixes don't break the build/tests.

> Note: a deterministic `secret-guard` hook also blocks hardcoded secrets at write time — but this audit is the architectural backstop and catches what's already in the tree.

---
The user's focus/path argument, if any, follows.
