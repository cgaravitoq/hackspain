import { env, SELF } from "cloudflare:test";
import { compareSchema, explainSchema } from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

const errorBody = z.object({ error: z.string() });

describe("GET /compare", () => {
  it("returns the companies in request order aligned on the union of observed months", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_B,COMP_A",
    );
    expect(response.status).toBe(200);
    const comparison = compareSchema.parse(await response.json());
    expect(comparison.companies.map((company) => company.company_id)).toEqual([
      "COMP_B",
      "COMP_A",
    ]);
    expect(comparison.months).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("answers 404 naming the unknown company", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_A,COMP_MISSING",
    );
    expect(response.status).toBe(404);
    expect(errorBody.parse(await response.json()).error).toContain(
      "COMP_MISSING",
    );
  });

  it("rejects an empty list with a message about the bounds", async () => {
    const response = await SELF.fetch("https://agent.test/compare?ids=");
    expect(response.status).toBe(400);
    expect(errorBody.parse(await response.json()).error).toContain("1 and 3");
  });

  it("rejects more than three companies with a message about the bounds", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_A,COMP_B,COMP_D,COMP_0176",
    );
    expect(response.status).toBe(400);
    expect(errorBody.parse(await response.json()).error).toContain("1 and 3");
  });

  it("treats a demo name as the id it maps to", async () => {
    const byName = await SELF.fetch(
      "https://agent.test/compare?ids=Talleres%20Ribera,COMP_A",
    );
    const byId = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_0176,COMP_A",
    );
    expect(byName.status).toBe(200);
    expect(compareSchema.parse(await byName.json())).toEqual(
      compareSchema.parse(await byId.json()),
    );
  });
});

describe("company name resolution", () => {
  it("explains a company addressed by its demo name the same way as by its id", async () => {
    const byName = await SELF.fetch(
      "https://agent.test/companies/Talleres%20Ribera/explain",
    );
    const byId = await SELF.fetch(
      "https://agent.test/companies/COMP_0176/explain",
    );
    expect(byName.status).toBe(200);
    const explanation = explainSchema.parse(await byName.json());
    expect(explanation.company_id).toBe("COMP_0176");
    expect(explanation).toEqual(explainSchema.parse(await byId.json()));
  });

  it("matches names case-insensitively and ignoring accents", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/meridian%20logistica/explain",
    );
    expect(response.status).toBe(200);
    expect(explainSchema.parse(await response.json()).company_id).toBe(
      "COMP_0909",
    );
  });
});
