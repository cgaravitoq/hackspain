import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

// SAFETY: vitest.config.ts injects TEST_MIGRATIONS as a miniflare binding next to the wrangler ones
await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
