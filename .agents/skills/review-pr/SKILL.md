---
name: review-pr
description: >
  Local second opinion on a branch or pull request before it reaches staging.
  Use when the user says "review this", "revisa la PR", "second opinion",
  "before I open the PR", or names a PR number or branch to review.
---

# Review a PR

Read-only. Never edit files, commit or comment on GitHub from this skill; report to the user.

## Step 1 - Scope

```bash
git fetch origin
git diff origin/staging...HEAD --stat
gh pr view <number> --json title,body,files 2>/dev/null
```

Check the diff matches the Linear issue: one issue, one concern. Flag files that belong to another scope.

## Step 2 - Gates

Run `bun run verify`. A red gate is the first finding; stop there and report it.

## Step 3 - Read the diff against the invariants

Walk `AGENTS.md` Invariants and Conventions and check each against the diff:

- A binding used in code but absent from `wrangler.jsonc` or its `env.staging` block.
- A hand-written `Env` type or a secret literal.
- Tests that reach the network or mock the module under test.
- CORS headers on the agent, or the web calling the agent by URL instead of `/api`.
- Comments explaining what instead of why; speculative abstraction; `any`.
- Commit headers over 72 characters or missing scope; PR title not a Conventional Commit.

## Step 4 - Correctness

For each changed function ask: what input breaks it, what happens on the error path, is the test asserting the mechanism or just the output.
Write findings as `path:line - claim - failure scenario`, most severe first.
If nothing survives, say so in one line.
