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
        // .dev.vars would otherwise override the vars a developer runs the tests with,
        // and a TYPESAFE_API_KEY there would send the default judge to the network.
        miniflare: {
          bindings: {
            ENVIRONMENT: "production",
            TYPESAFE_API_KEY: "",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: { setupFiles: ["./src/__tests__/setup.ts"] },
  };
});
