import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "migrations"),
  );
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // The AI binding would otherwise open a remote session; the chat tests inject a mock model.
        remoteBindings: false,
        // .dev.vars would otherwise override the vars a developer runs the tests with
        miniflare: {
          bindings: { ENVIRONMENT: "production", TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: { setupFiles: ["./src/__tests__/setup.ts"] },
  };
});
