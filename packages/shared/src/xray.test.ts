import { describe, expect, it } from "vitest";
import { alertSchema, companyDetailSchema, stateSchema } from "./xray.ts";

describe("xray contracts", () => {
  it("accepts a company whose first months are not evaluable", () => {
    const detail = companyDetailSchema.parse({
      company_id: "COMP_0001",
      group_id: "GROUP_0001",
      currency: "EUR",
      scorable: true,
      holdout: false,
      months_observed: 3,
      debt_outstanding: 0,
      invoice_facts: {},
      latest: {
        month: "2026-08",
        score: 51.2,
        level: 51.2,
        momentum: null,
        state: "stable",
        confidence: "low",
      },
      series: [
        {
          month: "2026-06",
          observed: true,
          level: null,
          momentum: null,
          adjustment: null,
          score: null,
          state: "not_evaluable",
          confidence: "none",
          components: {},
          drivers: [],
          changed: [],
          evidence: {
            months_observed: 1,
            transactions_in_window: 0,
            share_uncategorised: 0,
            window: null,
            cutoff: "2026-06",
            currency: "EUR",
            sources: { transactions: true, invoices: false, debt: false },
            rule_version: "xray-score/0.1",
          },
          flows: {
            inflow: 10,
            outflow: 5,
            financing_in: 0,
            financing_out: 0,
            debt_repayment: 0,
          },
          events: { E1: false, E2: false, E3: false, E4: false },
        },
      ],
    });
    expect(detail.series[0]?.state).toBe("not_evaluable");
  });

  it("rejects an alert whose state is not one of the five states", () => {
    const result = alertSchema.safeParse({
      company_id: "COMP_0001",
      group_id: null,
      month: "2026-08",
      kind: "down",
      state: "bad",
      previous_state: "stable",
      score: 10,
      delta: -20,
      driver: null,
    });
    expect(result.success).toBe(false);
    expect(stateSchema.options).toHaveLength(6);
  });
});
