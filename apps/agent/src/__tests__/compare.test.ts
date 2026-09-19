import { env, SELF } from "cloudflare:test";
import {
  type CompanyDetail,
  compareSchema,
  explainSchema,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStore } from "../xray/store.ts";
import { createTools } from "../xray/tools.ts";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

const errorBody = z.object({ error: z.string() });

function observedMonths(company: CompanyDetail | undefined) {
  return company?.series
    .filter((entry) => entry.observed)
    .map((entry) => entry.month);
}

function countingDb(db: D1Database) {
  const queries: string[] = [];
  const proxy = new Proxy(db, {
    get(target, property) {
      if (property !== "prepare") {
        throw new Error(`compare reached D1 through ${String(property)}`);
      }
      return (query: string) => {
        queries.push(query);
        return target.prepare(query);
      };
    },
  });
  return { db: proxy, queries };
}

describe("GET /compare", () => {
  it("returns the companies in request order aligned on the union of observed months", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_0909,COMP_0176",
    );
    expect(response.status).toBe(200);
    const comparison = compareSchema.parse(await response.json());
    const [first, second] = comparison.companies;
    expect(first?.company_id).toBe("COMP_0909");
    expect(second?.company_id).toBe("COMP_0176");
    expect(observedMonths(first)).toEqual(["2026-05", "2026-07", "2026-08"]);
    expect(observedMonths(second)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(first?.series.map((entry) => entry.month)).toContain("2026-04");
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
    expect(errorBody.parse(await response.json()).error).toBe(
      "Unknown company COMP_MISSING",
    );
  });

  it("answers 404 naming every unknown company", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_A,COMP_MISSING,COMP_ALSO_MISSING",
    );
    expect(response.status).toBe(404);
    expect(errorBody.parse(await response.json()).error).toBe(
      "Unknown companies COMP_MISSING, COMP_ALSO_MISSING",
    );
  });

  it("treats a quote in an id as data and answers 404", async () => {
    const response = await SELF.fetch(
      "https://agent.test/compare?ids=COMP_A%27--",
    );
    expect(response.status).toBe(404);
    expect(errorBody.parse(await response.json()).error).toBe(
      "Unknown company COMP_A'--",
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

describe("compare tool", () => {
  it("reads three companies from D1 in a single query", async () => {
    const { db, queries } = countingDb(env.DB);
    const comparison = compareSchema.parse(
      await createTools(createStore(db)).compare({
        company_ids: ["COMP_D", "COMP_A", "COMP_B"],
      }),
    );
    expect(comparison.companies.map((company) => company.company_id)).toEqual([
      "COMP_D",
      "COMP_A",
      "COMP_B",
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/company_id IN \(/);
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
