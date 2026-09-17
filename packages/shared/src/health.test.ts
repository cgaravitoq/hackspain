import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.ts";

describe("healthResponseSchema", () => {
  it("accepts a ready response for a known environment", () => {
    const parsed = healthResponseSchema.safeParse({
      ok: true,
      environment: "staging",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown environment", () => {
    const parsed = healthResponseSchema.safeParse({
      ok: true,
      environment: "qa",
    });
    expect(parsed.success).toBe(false);
  });
});
