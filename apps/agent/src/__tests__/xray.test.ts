import { env, SELF } from "cloudflare:test";
import {
  alertSchema,
  companyDetailSchema,
  companySummarySchema,
  explainSchema,
  groupMapSchema,
  metaSchema,
  STATE_LABELS,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

describe("GET /companies/:id", () => {
  it("returns the radiography of a company with its whole monthly series", async () => {
    const response = await SELF.fetch("https://agent.test/companies/COMP_A");
    expect(response.status).toBe(200);
    const company = companyDetailSchema.parse(await response.json());
    expect(company.series.map((entry) => entry.state)).toEqual([
      "not_evaluable",
      "healthy",
      "slipping",
      "falling",
    ]);
    expect(company.latest.score).toBe(12.3);
  });

  it("answers 404 for a company that is not in the dataset", async () => {
    const response = await SELF.fetch("https://agent.test/companies/COMP_X");
    expect(response.status).toBe(404);
  });
});

describe("GET /companies", () => {
  it("lists only the companies in the requested state", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies?state=falling",
    );
    const body = z
      .object({ companies: z.array(companySummarySchema) })
      .parse(await response.json());
    expect(body.companies.map((company) => company.company_id)).toEqual([
      "COMP_A",
    ]);
  });

  it("rejects a state that is not one of the six trajectory states", async () => {
    const response = await SELF.fetch("https://agent.test/companies?state=bad");
    expect(response.status).toBe(400);
  });
});

describe("GET /alerts", () => {
  it("returns the alerts of the month worst first and filters by kind", async () => {
    const all = z
      .object({ alerts: z.array(alertSchema) })
      .parse(await (await SELF.fetch("https://agent.test/alerts")).json());
    expect(all.alerts.map((alert) => alert.kind)).toEqual([
      "down",
      "recovered",
    ]);
    const recovered = z
      .object({ alerts: z.array(alertSchema) })
      .parse(
        await (
          await SELF.fetch("https://agent.test/alerts?kind=recovered")
        ).json(),
      );
    expect(recovered.alerts.map((alert) => alert.company_id)).toEqual([
      "COMP_C",
    ]);
  });
});

describe("GET /companies/:id/explain", () => {
  it("explains the latest month with drivers, events and the Embat action", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/explain",
    );
    const explanation = explainSchema.parse(await response.json());
    expect(explanation.state_label).toBe("cayendo");
    expect(explanation.events).toEqual(["E1"]);
    expect(explanation.action).toBe(
      "Reclamar las 2 facturas vencidas desde Cuentas por cobrar",
    );
  });
});

describe("GET /meta", () => {
  it("returns the dataset labels and latest month stored in D1", async () => {
    const response = await SELF.fetch("https://agent.test/meta");
    expect(response.status).toBe(200);
    expect(metaSchema.parse(await response.json())).toEqual({
      state_labels: STATE_LABELS,
      latest_month: "2026-08",
      holdout_groups: [],
    });
  });
});

describe("GET /groups/:id", () => {
  it("maps a group with its members, the tension flag and its reason", async () => {
    const response = await SELF.fetch("https://agent.test/groups/GROUP_1");
    const group = groupMapSchema.parse(await response.json());
    expect(group.tension).toBe(true);
    expect(group.tension_reason).toBe("1 de 2 empresas cayendo o torciéndose");
    expect(group.members.map((member) => member.state)).toEqual([
      "falling",
      "healthy",
    ]);
  });
});
