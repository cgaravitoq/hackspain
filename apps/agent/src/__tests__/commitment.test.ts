import { env, SELF } from "cloudflare:test";
import {
  commitmentContextSchema,
  commitmentResponseSchema,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { falling, type RequestBody, seed } from "./fixtures.ts";

const opportunity = {
  title: "New customer order",
  revenue_minor: 10_000_000,
  advance_date: "2026-09-02",
  final_payment_date: "2026-10-30",
  permitted_advance_bps: [0, 2000, 4000, 6000],
  costs: [{ id: "materials", date: "2026-09-10", amount_minor: 6_000_000 }],
};
const request = {
  opportunity,
  horizon_months: 2,
  reserve_floor_minor: 2_000_000,
};
const snapshot = {
  as_of: "2026-09-01",
  currency: "EUR",
  ledger_minor: 4_000_000,
  available_minor: null,
  availability_verified: false,
  account_ids: ["ACCOUNT_A"],
  accounts_expected: 1,
  accounts_observed: 1,
  source: "balances.csv",
  limitations: ["Availability is not reported"],
};

beforeAll(async () => {
  await seed(env.DB);
  const template = falling.series.at(-1);
  if (!template) {
    throw new Error("Missing fixture month");
  }
  const series = Array.from({ length: 18 }, (_, index) => ({
    ...template,
    month: new Date(Date.UTC(2025, index + 2, 1)).toISOString().slice(0, 7),
    observed: true,
    flows: {
      inflow: 100,
      outflow: 100,
      debt_repayment: 50,
      financing_in: 500,
      financing_out: 0,
    },
  }));
  const detail = {
    ...falling,
    months_observed: 18,
    series,
    treasury_snapshot: snapshot,
  };
  await env.DB.prepare("UPDATE companies SET detail=?1 WHERE company_id=?2")
    .bind(JSON.stringify(detail), "COMP_A")
    .run();
});

function simulate(body: RequestBody, company = "COMP_A") {
  return SELF.fetch(`https://agent.test/companies/${company}/commitment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("commitment simulation routes", () => {
  it("reads the ledger snapshot from D1 and exposes its limited provenance", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/commitment-context",
    );
    expect(response.status).toBe(200);
    const context = commitmentContextSchema.parse(await response.json());
    expect(context.basis).toBe("LEDGER_SCENARIO_ONLY");
    expect(context.snapshot?.ledger_minor).toBe(4_000_000);
    expect(context.snapshot?.available_minor).toBeNull();
    expect(context.history_months).toBe(18);
    expect(context.max_horizon_months).toBe(6);
  });

  it("uses one deterministic evaluation and labels every result as non-reservable", async () => {
    const response = await simulate(request);
    expect(response.status).toBe(200);
    const body = commitmentResponseSchema.parse(await response.json());
    expect(body.evaluation.status).toBe("EVALUATED");
    expect(body.evaluation.reservable).toBe(false);
    expect(body.evaluation.label).toBe(
      "Simulación, no reservable, requiere revisión humana",
    );
    expect(body.evaluation.minimum_tested_feasible_bps).toBe(6000);
    expect(body.evaluation.baseline?.closing_minor).toBe(4_000_000);
    expect(
      body.evaluation.alternatives.every(
        (item) => item.cash.is_financial_authorization === false,
      ),
    ).toBe(true);
    expect(body.report_section.code).toBe("decision");
    expect(body.report_section.body).toContain("no reservable");
    expect(body.report_section.body.split("\n\n")[0]).toMatch(
      /^Con un anticipo del 60 % \([\d.]+ €\), la caja mínima estimada es [\d.-]+ €, por encima del suelo de [\d.]+ €\./u,
    );
    expect(body.report_section.figures.length).toBeGreaterThan(0);
  });

  it("says which advance comes closest when none keeps the floor", async () => {
    const response = await simulate({
      ...request,
      opportunity: { ...request.opportunity, permitted_advance_bps: [0, 1000] },
    });
    const body = commitmentResponseSchema.parse(await response.json());
    expect(body.evaluation.minimum_tested_feasible_bps).toBeNull();
    expect(body.report_section.body.split("\n\n")[0]).toMatch(
      /^Ninguna de las opciones de anticipo evaluadas \(0 %, 10 %\) mantiene la caja por encima del suelo de [\d.]+ €\. En el mejor caso, con un anticipo del 10 %, la caja mínima estimada sería [\d.-]+ €\./u,
    );
  });

  it("does not subtract debt repayments again or roll financing income forward", async () => {
    const response = await simulate(request);
    const body = commitmentResponseSchema.parse(await response.json());
    expect(body.evaluation.context.monthly_outflow_minor).toBe(10_000);
    expect(body.evaluation.context.monthly_inflow_minor).toBe(10_000);
    expect(body.evaluation.baseline?.closing_minor).toBe(4_000_000);
  });

  it("rejects client attempts to inject ledger values or verification flags", async () => {
    for (const injected of [
      { opening_verified: true },
      { opening_minor: 90_000_000 },
      { ledger: snapshot },
    ]) {
      expect((await simulate({ ...request, ...injected })).status).toBe(400);
    }
  });

  it("returns insufficient evidence rather than manufacturing cash for legacy artifacts", async () => {
    const response = await simulate(request, "COMP_B");
    expect(response.status).toBe(200);
    const body = commitmentResponseSchema.parse(await response.json());
    expect(body.evaluation.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(body.evaluation.alternatives).toEqual([]);
    expect(body.evaluation.context.snapshot).toBeNull();
  });

  it("does not truncate material payments outside the supported horizon", async () => {
    const response = await simulate({ ...request, horizon_months: 1 });
    const body = commitmentResponseSchema.parse(await response.json());
    expect(body.evaluation.status).toBe("OUTSIDE_HORIZON");
    expect(body.evaluation.alternatives).toEqual([]);
  });

  it("returns validation and lookup errors without calling a language model", async () => {
    expect(
      (
        await simulate({
          ...request,
          opportunity: { ...opportunity, revenue_minor: -1 },
        })
      ).status,
    ).toBe(400);
    expect((await simulate(request, "MISSING")).status).toBe(404);
    const malformed = await SELF.fetch(
      "https://agent.test/companies/COMP_A/commitment",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      },
    );
    expect(malformed.status).toBe(400);
  });

  it("returns the same evaluation through MCP without publishing a reservation tool", async () => {
    const rpc = (method: string, params: RequestBody) =>
      SELF.fetch("https://agent.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
    const listed = await rpc("tools/list", {});
    const tools = z
      .object({
        result: z.object({ tools: z.array(z.object({ name: z.string() })) }),
      })
      .parse(await listed.json()).result.tools;
    expect(tools.map((item) => item.name)).toContain("simulate_commitment");
    expect(
      tools.some((item) => /reserve|payment|release/.test(item.name)),
    ).toBe(false);
    const called = await rpc("tools/call", {
      name: "simulate_commitment",
      arguments: { company_id: "COMP_A", ...request },
    });
    const result = z
      .object({
        result: z.object({ content: z.array(z.object({ text: z.string() })) }),
      })
      .parse(await called.json());
    const remote = commitmentResponseSchema.parse(
      JSON.parse(result.result.content[0]?.text ?? ""),
    );
    const direct = commitmentResponseSchema.parse(
      await (await simulate(request)).json(),
    );
    expect(remote).toEqual(direct);
  });
});
