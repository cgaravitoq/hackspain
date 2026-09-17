import { SELF } from "cloudflare:test";
import { healthResponseSchema } from "@hackspain/shared";
import { describe, expect, it } from "vitest";

describe("GET /health", () => {
  it("reports the environment the worker was configured with", async () => {
    const response = await SELF.fetch("https://agent.test/health");
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      ok: true,
      environment: "production",
    });
  });
});
