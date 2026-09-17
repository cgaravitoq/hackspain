---
name: cloudflare-worker
description: >
  Patterns for the two Workers in this repository: adding a Hono route, a
  binding (KV, D1, R2, Durable Object, Workers AI, AI Gateway), a secret, or a
  test that runs inside workerd. Use when touching apps/agent, apps/web,
  wrangler.jsonc, or asking how to call a model from the Worker.
---

# Cloudflare Worker patterns

## Add a route

Routes live in `apps/agent/src/app.ts` on the `Hono<{ Bindings: Env }>` app built by `createApp()`.
Validate input at the boundary with a Zod schema from `@hackspain/shared`, respond with `context.json(body, status)`.
Add the response schema to `packages/shared` when the web consumes it.

## Add a binding

1. Declare it in `apps/agent/wrangler.jsonc` under the top-level block **and** under `env.staging` (environments inherit nothing).
2. Run `bun --filter @hackspain/agent types` and commit `worker-configuration.d.ts`.
3. Use it through `context.env.<BINDING>`; the type is already there.
4. Resources that need creating (a D1 database, a KV namespace) are created once by the account owner with `wrangler <resource> create`, never from CI.

Binding names: `DB` for D1, `KV` for KV, `BUCKET` for R2, `AI` for Workers AI, `AGENT` for the service binding from web.

Workers AI note: the `AI` binding always calls the remote API, also under `wrangler dev` and in tests. Keep the model call behind a function that tests can replace.

## Durable Object or Agents SDK

Add the class to `durable_objects.bindings` plus a `migrations` entry with `new_sqlite_classes`, in both environment blocks.
For the Agents SDK (`agents` package) the class extends `Agent<Env, State>`; route to it with `routeAgentRequest` from the Hono app.
Search the `agents` and `cloudflare-docs` resources in `btca.config.jsonc` before guessing an API.

## Call a model

Provider keys live in the AI Gateway of the account, not in the Worker.
The Worker needs the gateway URL and its token as secrets: add them to `apps/agent/.dev.vars.example`, set them locally in `.dev.vars`, and deployed with `wrangler secret put NAME` and `wrangler secret put NAME --env staging`.
Declare secret names in a `declare namespace Cloudflare { interface Env { NAME: string } }` block in `apps/agent/src/env.d.ts` so `Env` stays generated plus one file.

## Tests

Agent tests run inside workerd: `import { SELF, env } from "cloudflare:test"` and call `SELF.fetch("https://agent.test/route")`.
Anything remote (AI, Gateway, external HTTP) is injected through `createApp(deps)` and faked in the test.
Web Worker tests are plain Vitest under jsdom and fake the `AGENT` binding as an object with `fetch`.

## Local development

`bun run dev` starts both Workers. The web dev server proxies `/api` to the agent through the service binding, so the browser only needs `http://localhost:5173`.
`wrangler dev` reads `.dev.vars`; copy `.dev.vars.example` first.
