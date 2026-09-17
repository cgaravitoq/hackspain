# PR body template

Fill every section. Mark `[x]` only for what you actually verified.

```markdown
## Summary

<1-3 sentences: what this PR does and why, referencing the Linear issue context>

Resolves HSP-<number>

## Changes

- <one bullet per logical change>

## How it was tested

- <command or manual step, and what you observed>

## Checklist

- [ ] Title is a Conventional Commit
- [ ] `bun run verify` passes locally
- [ ] No secrets, no `.dev.vars` content, no Spanish in code or docs
- [ ] `worker-configuration.d.ts` regenerated if `wrangler.jsonc` changed
```
