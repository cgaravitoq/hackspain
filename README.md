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
pipeline/         Python 3.13+ scorer (uv + polars), outside `bun run verify`
.agents/skills/   Team skills for Claude Code, Codex, OpenCode and Cursor
```

## Data pipeline and D1

From `pipeline/`, `uv run xray score --data <dir> --out artifacts` reads six Embat CSVs from `<dir>` (`companies`, `groups`, `banking_products`, `transactions`, `invoices`, `debt_products`) and writes `companies.json`, `alerts.json`, `groups.json`, `backtest.json`, `meta.json` and `scores/<id>.json`.
`uv run pytest` runs the pipeline tests; `pipeline/data` and `pipeline/artifacts` are gitignored.

The agent serves the artifacts from the D1 binding `DB` (migrations in `apps/agent/migrations/`, one row per company with the summary and the whole series as JSON).
`bun --filter @hackspain/agent load -- --local` validates the artifacts with the shared schemas, writes `artifacts/xray.sql`, applies the migrations and loads the local database; `-- --env staging` targets staging.

## API

- GET: `/health`, `/companies?state&group_id&limit`, `/companies/:id`, `/companies/:id/explain`, `/groups/:id`, `/alerts?kind&limit`, `/backtest`, `/meta`.
- `POST /chat` streams an AI SDK response from Workers AI `@cf/deepseek-ai/deepseek-v4-flash-0731`.
- `ALL /mcp` serves a stateless Streamable HTTP MCP server with tools `score`, `explain`, `what_changed`, `group_map` and `alerts`.

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

| Environment | Web | Agent | MCP |
|---|---|---|---|
| staging | https://hackspain-web-staging.carlos-garavito.workers.dev | https://hackspain-agent-staging.carlos-garavito.workers.dev/health | https://hackspain-agent-staging.carlos-garavito.workers.dev/mcp |
| production | https://hackspain-web.carlos-garavito.workers.dev | https://hackspain-agent.carlos-garavito.workers.dev/health | https://hackspain-agent.carlos-garavito.workers.dev/mcp |
