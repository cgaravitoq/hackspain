import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // .dev.vars would otherwise override the vars a developer runs the tests with
      miniflare: { bindings: { ENVIRONMENT: "production" } },
    }),
  ],
});
