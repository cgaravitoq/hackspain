---
name: promote-to-main
description: >
  Promote validated staging to production by opening the staging-to-main pull
  request and checking the production deploy. Repository owner only. Use when
  the user says "promote to main", "release to production", "sube a main",
  or "promociona staging".
---

# Promote staging to main

Owner only. If the user is not the repository owner, explain that and stop.

## Step 1 - Confirm staging is validated

```bash
gh run list --branch staging --workflow deploy-staging.yml --limit 1
```

The last staging deploy must be green and the user must confirm the staging URL was checked by hand.
No confirmation, no promotion.

## Step 2 - Open the promotion PR

```bash
git fetch origin
gh pr create --base main --head staging \
  --title "chore(repo): promote staging to production" \
  --body-file <(cat <<'BODY'
## Summary

Promotes the validated staging state to production.

## Included

<`gh pr list --base staging --state merged --limit 20` summary, one line per merged PR with its HSP key>

## Checks

- [ ] `deploy-staging.yml` green on the head commit
- [ ] Staging validated by hand
BODY
)
```

Merge with **merge commit**, not squash: `main` must contain the same commits as `staging` or the next promotion re-applies history.

## Step 3 - Watch production

```bash
gh run watch --exit-status $(gh run list --branch main --workflow deploy-production.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

The workflow ends with a `/health` smoke test against the production URL. If it fails, do not retry blindly: read the deploy log, and if the previous version was healthy roll back with `wrangler rollback` in the failing app before diagnosing.
