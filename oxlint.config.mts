import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";

export default defineConfig({
  extends: [antiSlop],
  ignorePatterns: [
    "**/dist/**",
    "**/.wrangler/**",
    "**/worker-configuration.d.ts",
  ],
});
