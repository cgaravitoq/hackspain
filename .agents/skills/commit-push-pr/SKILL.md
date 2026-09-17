---
name: commit-push-pr
description: >
  Commit changes, push the branch and open a pull request against staging
  following this repository's conventions. Use when the user asks to commit,
  push, open a PR, "ship it", "send for review", "sube la PR", or any
  combination, and when self-reviewing work before delivering it.
---

# Commit, push and pull request

Stop at whatever the user asked for: commit only, commit and push, or the full flow.

## Step 1 - Branch

You must be on a `hsp-<number>-<slug>` branch created by the Linear webhook.
On `staging` or `main`, stop and run the `take-task` skill first.

## Step 2 - Commit

Header only, at most 72 characters, Conventional Commit with a scope:

```
<type>(<scope>): <imperative summary>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `infra`, `perf`, `style`, `build`, `revert`.
- Scopes: `agent`, `web`, `shared`, `ci`, `repo`.
- Imperative mood, English, no trailing period, no body. Context goes in the PR.
- One commit per logical step in dependency order: `refactor` prep, then `feat`/`fix`, then `test`, then `docs`/`chore`.
- Stage an explicit file list: `git add <paths>`. Never `git add -A` or `git add .`.

Hooks run secretlint, Biome and oxlint on commit and typecheck plus tests on push.
If a hook fails, fix the cause, re-stage and commit again. Never `--no-verify`.

## Step 3 - Push

```bash
git fetch origin
git rebase origin/staging
git push -u origin HEAD
```

Use `--force-with-lease` only after a rebase of your own unmerged branch, never on `staging` or `main`.

## Step 4 - Pull request

Read the Linear issue for context. Title equals the main commit header (it becomes the squash commit).
Body from [references/pr-body-template.md](references/pr-body-template.md), every section filled.

```bash
gh pr create --base staging --title "<type>(<scope>): <summary>" --body-file <(cat <<'BODY'
<filled template>
BODY
)
```

Then move the Linear issue to **In Review** if the GitHub integration did not already, and return the PR URL.

## Gotchas

- GitHub derives a bad title from the branch name; always pass `--title`.
- CI's `swarm-review` job comments findings on the PR. Fix real ones as new `fix(<scope>):` commits on the branch, never by amending.
- `worker-configuration.d.ts` changes only when `wrangler.jsonc` changed; if it shows up in the diff without that, you ran `types` against a stale config.

## Error handling

| Situation | Action |
|---|---|
| On `staging` or `main` | Stop, run `take-task` |
| Push rejected | `git fetch origin && git rebase origin/staging`, resolve, push again |
| PR already exists | Push to the branch; do not open a second PR |
| No Linear issue for the branch | Ask which issue this is; do not invent one |
