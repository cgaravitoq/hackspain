# HackSpain 2026

Team entry for [HackSpain 2026](https://hackspain.com), 18-20 September, Madrid.
TypeScript monorepo on Cloudflare Workers: a Hono agent API, a Vue front end, shared Zod contracts.
`AGENTS.md` is the operating manual for people and coding agents alike; this file is the runbook.

## Prerequisites

- [Bun](https://bun.sh) 1.4.x (`packageManager` in `package.json` pins the exact version)
- A Cloudflare account is only needed to deploy; local development and tests run offline

## Local development

```bash
bun install                                  # dependencies + git hooks
cp apps/agent/.dev.vars.example apps/agent/.dev.vars
bun run dev                                  # agent on :8787, web on :5173 proxying /api
bun run verify                               # everything CI runs
```

## Layout

```
apps/agent/       Hono Worker (API, agent logic)
apps/web/         Vue 3 + Vite, served as Worker static assets, /api proxied to the agent
packages/shared/  Zod schemas shared by both
.agents/skills/   Team skills for Claude Code, Codex, OpenCode and Cursor
```

## Workflow

1. Take a Linear issue and move it to In Progress; the webhook creates `hsp-<n>-<slug>` from `staging`.
2. `git fetch origin && git checkout hsp-<n>-<slug>`, work in small Conventional Commits.
3. Open a PR to `staging`; CI must be green and one teammate approves. Squash merge deploys staging.
4. The owner promotes `staging` to `main` by PR; merging deploys production.

Details, invariants and conventions: [`AGENTS.md`](AGENTS.md).

## Deploy

Deploys run from GitHub Actions with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.
`deploy-staging.yml` runs on push to `staging`, `deploy-production.yml` on push to `main`; both finish with a `/health` smoke test.
Manual deploys from a laptop are for emergencies only: `bun --filter @hackspain/agent deploy:staging`.

## Environments

| Environment | Web | Agent |
|---|---|---|
| staging | https://hackspain-web-staging.carlos-garavito.workers.dev | https://hackspain-agent-staging.carlos-garavito.workers.dev/health |
| production | https://hackspain-web.carlos-garavito.workers.dev | https://hackspain-agent.carlos-garavito.workers.dev/health |
