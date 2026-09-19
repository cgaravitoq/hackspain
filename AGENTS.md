# HackSpain 2026 - Agent Guidance

`CLAUDE.md` is a symlink to this file, so both names resolve to the same guide.
Cursor and Codex read `AGENTS.md` directly; OpenCode reads it through `opencode.json`.

## What this is

A 5-person team entry for HackSpain 2026 (36 hours, 18-20 September, Madrid).
The product is decided on Friday once the track is known; this repository is the base every feature lands on.
Everything runs on Cloudflare from a single account: two Workers, TypeScript end to end, Bun as the only package manager.

## Commands

| Command | What it does |
|---|---|
| `bun install` | Installs dependencies and the git hooks (lefthook) |
| `bun run dev` | `wrangler dev` for the agent and `vite` for the web, in parallel |
| `bun run verify` | Every gate CI runs, in the same order: format, lint, typecheck, test, deploy dry-run |
| `bun run format:fix` | Biome formats and fixes what it can |
| `bun run lint` | oxlint with the ultracite anti-slop preset, warnings are errors |
| `bun run typecheck` | `tsc --noEmit` per workspace (`vue-tsc` in web) |
| `bun run test` | Vitest per workspace, never reaches the network |
| `bun --filter @hackspain/agent types` | Regenerates `worker-configuration.d.ts` after editing `wrangler.jsonc` |
| `bun --filter @hackspain/agent load -- --local` | Validates `pipeline/artifacts` with the shared schemas, writes `artifacts/xray.sql`, applies migrations and loads the local D1 (`-- --env staging` targets staging) |
| `cd pipeline && uv run xray score --data <dir> --out artifacts` | Scores the nine Embat CSVs and writes `companies.json`, `alerts.json`, `groups.json`, `backtest.json`, `meta.json` and `scores/<id>.json` |
| `cd pipeline && uv run pytest` | Pipeline tests |

## Layout

| Path | What it holds |
|---|---|
| `apps/agent/` | Hono Worker, the API and the agent brain. `src/app.ts` builds the app through `createApp()`, `src/index.ts` exports it |
| `apps/web/` | Vue 3 + Vite, deployed as static assets of its own Worker. `src/worker.ts` proxies `/api/*` to the agent over a service binding |
| `packages/shared/` | Zod schemas and types crossing the agent/web boundary. Source-only, no build step |
| `pipeline/` | Python 3.13+ scorer on uv and polars, outside `bun run verify`. `pipeline/data` and `pipeline/artifacts` are gitignored |
| `.agents/skills/` | Team skills; `.claude/skills` is a symlink to it |
| `.github/workflows/` | `ci.yml` on pull requests, `deploy-staging.yml` on push to `staging`, `deploy-production.yml` on push to `main` |

## The X Ray surface

- The agent reads everything from the D1 binding `DB` (`hackspain-xray`, `hackspain-xray-staging` on staging); migrations live in `apps/agent/migrations/`.
- One row per company carries the summary and the whole series as JSON, written by the load script.
- GET routes: `/health`, `/companies?state&group_id&limit`, `/companies/:id`, `/companies/:id/explain`, `/groups/:id`, `/alerts?kind&limit`, `/backtest`, `/meta`.
- `POST /chat` streams an AI SDK response from Workers AI `@cf/deepseek-ai/deepseek-v4-flash-0731` through the `AI` binding (`remote: true`).
- `ALL /mcp` serves a stateless Streamable HTTP MCP server with tools `score`, `explain`, `what_changed`, `group_map` and `alerts`.

## Invariants

- **Tests never reach the network.** The agent tests run inside workerd through `@cloudflare/vitest-pool-workers`; the web tests fake the agent binding. A binding that needs a remote resource (Workers AI, AI Gateway) is injected, never called in a test.
- **`wrangler.jsonc` is the only place a binding is declared.** After editing it run `types` and commit the regenerated `worker-configuration.d.ts`; `Env` comes from there, never hand-written.
- **Named environments inherit nothing.** Every binding or var the production block declares is repeated under `env.staging`.
- **Secrets never enter the repository.** Local values live in `.dev.vars` (gitignored); deployed values are set with `wrangler secret put` or live in the AI Gateway. `.dev.vars.example` lists every name.
- **The browser talks to one origin.** Web calls `/api/...`, the web Worker forwards to the agent. Do not add CORS to the agent.
- **`compatibility_date` stays at or below the date the bundled workerd supports.** The comment in `apps/agent/wrangler.jsonc` says which one; bump both together.
- **Pipeline commits carry no scope.** commitlint allows only `agent`, `web`, `shared`, `ci` and `repo`; changes under `pipeline/` go unscoped.

## Conventions

- Named exports, `type` aliases for object contracts, explicit `.ts` extensions on relative imports (`allowImportingTsExtensions`).
- No comments in authored code unless they state a non-obvious why. Config files (`wrangler.jsonc`, hooks, lint rules) may carry a why comment.
- No speculative abstraction: the simplest correct solution with the fewest moving parts.
- Validate at boundaries with Zod from `@hackspain/shared`; trust internal code.
- Kebab-case for files and directories; `PascalCase` only for classes and Vue components.
- English for code, comments, commits, branches, PRs, issues and docs. Spanish is for chat.
- Use `bun`, never `npm`/`npx`/`pnpm`. Dependencies are exact versions (`bunfig.toml` sets `exact = true`).
- Never bypass hooks (`--no-verify`, `LEFTHOOK=0`); a failing hook is fixed at its root cause.
- The ultracite preset forbids `unknown` params, `Record<string, unknown>`, `typeof` narrowing, `vi.mock` and casts without a `// SAFETY:` comment.

## Git and Linear workflow

- Branches: `main` is production (protected), `staging` is the default branch and the dev environment (protected). No direct pushes to either.
- Work starts in Linear: move your issue to In Progress. A webhook creates the branch `hsp-<n>-<slug>` from `staging` and links it to the issue. Then `git fetch origin && git checkout hsp-<n>-<slug>`. Never create branches by hand.
- One issue in progress per person. An assigned issue in In Progress belongs to its assignee; pick another or ask.
- Commits: Conventional Commits, header only, at most 72 characters. A scope is optional; when present it is one of `agent`, `web`, `shared`, `ci`, `repo`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `infra`, `perf`, `style`, `build`, `revert`. The body goes in the PR, not the commit.
- One commit per logical step, made as you work, and every commit leaves `bun run verify` green.
- Pull requests always target `staging`, one PR per Linear issue, title in Conventional Commit format (it becomes the squash commit on `staging`). Fill in `.github/pull_request_template.md`. Requires green CI and one approval; auto-merge is enabled, so request review and move on.
- `staging` to `main` promotion is a PR opened by the repository owner once staging has been validated by hand.
- Stage only the files you touched. Never `git add -A`, never amend a pushed commit, never force-push `staging` or `main`, never add an agent co-author.
- Do not commit, push or open PRs without being asked.

## Tests

- Vitest everywhere. Agent tests live in `apps/agent/src/__tests__/` and call the Worker through `SELF` from `cloudflare:test`. Web tests live in `apps/web/src/__tests__/` under jsdom. Shared tests sit next to their module as `*.test.ts`.
- Test names are behavior sentences (`reports the environment the worker was configured with`), not implementation labels.
- Assert the mechanism, not just the final value: a test that could pass through another code path does not prove the one it names.
- `apps/agent/vitest.config.ts` sets `remoteBindings: false` and pins `ENVIRONMENT` through `miniflare.bindings`; `.dev.vars` would otherwise override it.
- The chat tests inject a mock `LanguageModel`; `__tests__/setup.ts` applies `TEST_MIGRATIONS`.
