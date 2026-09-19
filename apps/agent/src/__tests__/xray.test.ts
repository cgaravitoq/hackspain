import { env, SELF } from "cloudflare:test";
import {
  alertSchema,
  backtestSchema,
  companyDetailSchema,
  companySummarySchema,
  explainSchema,
  groupMapSchema,
  metaSchema,
  STATE_LABELS,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStore } from "../xray/store.ts";
import { createTools } from "../xray/tools.ts";
import { backtest, company, meta, seed } from "./fixtures.ts";

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
    expect(company.rule_version).toBe("xray-score/0.1");
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

  it("lists exactly the members the group map reports for a group", async () => {
    const companies = z
      .object({ companies: z.array(companySummarySchema) })
      .parse(
        await (
          await SELF.fetch("https://agent.test/companies?group_id=GROUP_1")
        ).json(),
      );
    const group = groupMapSchema.parse(
      await (await SELF.fetch("https://agent.test/groups/GROUP_1")).json(),
    );
    expect(companies.companies.map((company) => company.company_id)).toEqual(
      group.members.map((member) => member.company_id),
    );
    expect(companies.companies).toHaveLength(group.n_companies);
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
    expect(
      all.alerts.every((alert) => alert.rule_version === "xray-score/0.1"),
    ).toBe(true);
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
  it.each(["stale", "gap"])(
    "keeps current confidence unavailable for %s data without changing explicit history",
    async (reason) => {
      const detail = company(
        `COMP_UNAVAILABLE_${reason}`,
        "GROUP_UNAVAILABLE",
        reason === "stale"
          ? [{ month: "2026-06", score: 75, state: "healthy" }]
          : [
              { month: "2026-06", score: 75, state: "healthy" },
              { month: "2026-07", score: null, state: "not_evaluable" },
            ],
      );
      detail.stale = reason === "stale";
      detail.latest = {
        ...detail.latest,
        state: "not_evaluable",
        confidence: "none",
      };
      const { series: _series, ...summary } = detail;
      await env.DB.prepare(
        "INSERT INTO companies (company_id, group_id, scorable, month, score, state, summary, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      )
        .bind(
          detail.company_id,
          detail.group_id,
          detail.scorable ? 1 : 0,
          detail.latest.month,
          detail.latest.score,
          detail.latest.state,
          JSON.stringify(summary),
          JSON.stringify(detail),
        )
        .run();
      const response = await SELF.fetch(
        `https://agent.test/companies/${detail.company_id}/explain`,
      );
      expect(response.status).toBe(200);
      const current = explainSchema.parse(await response.json());
      expect(current.confidence).toBe("none");
      expect(current.state).toBe("not_evaluable");
      expect(current.month).toBe("2026-06");
      expect(current.score).toBe(75);
      const historical = explainSchema.parse(
        await createTools(createStore(env.DB)).explain({
          company_id: detail.company_id,
          month: "2026-06",
        }),
      );
      expect(historical.confidence).toBe("high");
      expect(historical.state).toBe("healthy");
      expect(historical.score).toBe(current.score);
    },
  );

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
    const body = metaSchema.parse(await response.json());
    expect(body).toEqual(meta);
    expect(body.state_labels.falling).not.toBe(STATE_LABELS.falling);
  });

  it("publishes the policy the stored scores were computed with", async () => {
    const response = await SELF.fetch("https://agent.test/meta");
    const body = metaSchema.parse(await response.json());
    expect(body.rule_version).toBe("xray-score/0.1");
    expect(body.generated_at).toBe("2026-09-19T13:04:05+00:00");
    expect(body.policy).toEqual({
      lambda: 0.25,
      adjustment_cap: 10,
      momentum_threshold: 5,
      volatility_factor: 0.75,
      exit_factor: 0.5,
      penalty_cap: 15,
      healthy_level: 60,
      persistence_months: 3,
      window_months: 3,
      min_months: 3,
      momentum_min_months: 6,
    });
  });
});

describe("GET /backtest", () => {
  it("returns the backtest with the rule version it was scored with", async () => {
    const response = await SELF.fetch("https://agent.test/backtest");
    expect(response.status).toBe(200);
    const body = backtestSchema.parse(await response.json());
    expect(body).toEqual(backtest);
    expect(body.rule_version).toBe("xray-score/0.1");
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
