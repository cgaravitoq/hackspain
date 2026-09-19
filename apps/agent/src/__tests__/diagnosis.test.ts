import { env, SELF } from "cloudflare:test";
import { explainSchema } from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { falling, seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

describe("financial diagnosis", () => {
  it("separates observed drivers from hypotheses and checks instead of claiming causes", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/explain",
    );
    const result = explainSchema.parse(await response.json());
    expect(result.diagnosis?.status).toBe("CURRENT");
    expect(result.diagnosis?.findings[0]).toMatchObject({
      code: "balance",
      certainty: "HYPOTHESIS",
      observed: result.drivers[0]?.text,
    });
    expect(result.diagnosis?.findings[0]?.evidence_ref).toContain(
      "drivers.balance",
    );
    expect(result.diagnosis?.findings[0]?.alternative).toBeTruthy();
    expect(result.diagnosis?.findings[0]?.check).toBeTruthy();
    expect(result.diagnosis?.state_since).toBe("2026-08");
  });

  it("retains useful historical signals without inventing available cash", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/explain",
    );
    const result = explainSchema.parse(await response.json());
    expect(result.diagnosis?.findings.length).toBeGreaterThan(0);
    expect(result.diagnosis?.limitations.join(" ")).toContain("caja libre");
    expect(result.diagnosis?.limitations.join(" ")).toContain("causa");
  });

  it("does not invent problems for a healthy company", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_B/explain",
    );
    const result = explainSchema.parse(await response.json());
    expect(result.diagnosis?.findings).toEqual([]);
    expect(result.diagnosis?.next_steps.join(" ")).toContain("seguimiento");
  });

  it("marks an older scored month as retrospective rather than a current diagnosis", async () => {
    const old = falling.series.at(-1);
    if (!old) {
      throw new Error("Missing fixture");
    }
    const detail = {
      ...falling,
      latest: {
        ...falling.latest,
        month: "2026-09",
        score: null,
        state: "not_evaluable",
        confidence: "none",
      },
      series: [
        ...falling.series,
        {
          ...old,
          month: "2026-09",
          observed: false,
          score: null,
          state: "not_evaluable",
          confidence: "none",
        },
      ],
    };
    await env.DB.prepare("UPDATE companies SET detail=?1 WHERE company_id=?2")
      .bind(JSON.stringify(detail), "COMP_A")
      .run();
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/explain",
    );
    const result = explainSchema.parse(await response.json());
    expect(result.month).toBe("2026-08");
    expect(result.diagnosis?.status).toBe("RETROSPECTIVE");
    expect(result.diagnosis?.limitations.join(" ")).toContain("último periodo");
  });
});
