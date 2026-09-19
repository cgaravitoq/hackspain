import { describe, expect, it } from "vitest";
import {
  alertSchema,
  chatRequestSchema,
  companyDetailSchema,
  compareSchema,
  DEMO_COMPANY_NAMES,
  driverSchema,
  explainSchema,
  metaSchema,
  monthEntrySchema,
  ROLE_LABELS,
  reportSchema,
  reportSectionCodeSchema,
  roleSchema,
  stateSchema,
} from "./xray.ts";

const stableMonth = {
  month: "2026-08",
  observed: true,
  level: 50,
  momentum: 0,
  adjustment: 0,
  score: 50,
  state: "stable",
  confidence: "high",
  components: { balance: 0 },
  drivers: [],
  changed: [],
  evidence: {
    months_observed: 1,
    transactions_in_window: 1,
    share_uncategorised: 0,
    window: "2026-08 a 2026-08",
    cutoff: "2026-08",
    currency: "EUR",
    sources: { transactions: true, invoices: false, debt: false },
    rule_version: "xray-score/0.1",
  },
  flows: {
    inflow: 1,
    outflow: 1,
    financing_in: 0,
    financing_out: 0,
    debt_repayment: 0,
  },
  events: { E1: false, E2: false, E3: false, E4: false },
};

const demoCompanySummary = {
  company_id: "COMP_0176",
  group_id: "GROUP_0001",
  currency: "EUR",
  scorable: true,
  holdout: false,
  months_observed: 3,
  debt_outstanding: 1200,
  invoice_facts: {},
  latest: {
    month: "2026-08",
    score: 50,
    level: 50,
    momentum: 0,
    state: "stable",
    confidence: "high",
  },
};

const demoReport = {
  company_id: "COMP_0176",
  month: "2026-08",
  role: "tesorero",
  rule_version: "xray-report/0.1",
  generated_at: "2026-09-19T10:00:00.000Z",
  summary: "La empresa se mantiene estable.",
  sections: [
    {
      code: "resumen",
      title: "Resumen",
      body: "Todo en orden.",
      figures: [{ label: "Score", value: 50, unit: "pts" }],
    },
    { code: "que_hacer", title: "Qué hacer", body: "Nada." },
  ],
  export_url: "/reports/COMP_0176/2026-08.pdf",
};

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

  it("rejects an alert whose state is not one of the six trajectory states", () => {
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

  it("rejects a driver whose code is not one of the pipeline codes", () => {
    const result = driverSchema.safeParse({
      code: "not_a_driver",
      contribution: 1,
      value: 1,
      unit: "ratio",
      period: "2026-06 a 2026-08",
      text: "no",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a month whose components use a key the pipeline does not emit", () => {
    const result = monthEntrySchema.safeParse({
      month: "2026-08",
      observed: true,
      level: 50,
      momentum: 0,
      adjustment: 0,
      score: 50,
      state: "stable",
      confidence: "high",
      components: { surprise: 1 },
      drivers: [],
      changed: [],
      evidence: {
        months_observed: 1,
        transactions_in_window: 1,
        share_uncategorised: 0,
        window: "2026-08 a 2026-08",
        cutoff: "2026-08",
        currency: "EUR",
        sources: { transactions: true, invoices: false, debt: false },
        rule_version: "xray-score/0.1",
      },
      flows: {
        inflow: 1,
        outflow: 1,
        financing_in: 0,
        financing_out: 0,
        debt_repayment: 0,
      },
      events: { E1: false, E2: false, E3: false, E4: false },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a month whose changed entry uses a code the pipeline does not emit", () => {
    const result = monthEntrySchema.safeParse({
      ...stableMonth,
      changed: [{ code: "surprise", delta: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["changed", 0, "code"],
    ]);
  });

  it("rejects an explanation whose changed entry uses a code the pipeline does not emit", () => {
    const result = explainSchema.safeParse({
      company_id: "COMP_0001",
      group_id: null,
      month: "2026-08",
      score: 50,
      level: 50,
      momentum: 0,
      state: "stable",
      state_label: "estable",
      confidence: "high",
      drivers: [],
      changed: [{ code: "surprise", delta: 1 }],
      events: [],
      evidence: stableMonth.evidence,
      flows: stableMonth.flows,
      invoice_facts: {},
      action: "Nada que hacer",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["changed", 0, "code"],
    ]);
  });

  it("rejects a meta whose state labels carry a key that is not a trajectory state", () => {
    const result = metaSchema.safeParse({
      state_labels: { healthy: "sana", bad: "mala" },
      latest_month: "2026-08",
      holdout_groups: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["state_labels"],
    ]);
  });

  it("rejects a chat request whose messages are not UI messages", () => {
    expect(
      chatRequestSchema.safeParse({ messages: ["not a message"] }).success,
    ).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(
      chatRequestSchema.parse({
        company_id: "COMP_A",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "¿Por qué cae?" }],
          },
        ],
      }).messages,
    ).toHaveLength(1);
  });

  it("rejects a chat request whose role is not one of the three product roles", () => {
    const result = chatRequestSchema.safeParse({
      role: "ceo",
      messages: [
        { id: "m1", role: "user", parts: [{ type: "text", text: "Hola" }] },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["role"]]);
  });

  it("accepts a chat request carrying a product role and keeps it", () => {
    const request = chatRequestSchema.parse({
      role: "tesorero",
      messages: [
        { id: "m1", role: "user", parts: [{ type: "text", text: "Hola" }] },
      ],
    });
    expect(request.role).toBe("tesorero");
  });

  it("accepts each of the three product roles", () => {
    for (const role of ["tesorero", "financiero", "ventas"]) {
      expect(roleSchema.parse(role)).toBe(role);
    }
  });

  it("admits exactly the three product roles, in order", () => {
    expect(roleSchema.options).toEqual(["tesorero", "financiero", "ventas"]);
    expect(roleSchema.safeParse("admin").success).toBe(false);
  });

  it("labels each product role with its capitalised Spanish name", () => {
    expect(ROLE_LABELS).toEqual({
      tesorero: "Tesorero",
      financiero: "Financiero",
      ventas: "Ventas",
    });
  });

  it("accepts a report and defaults missing figures to an empty list", () => {
    const report = reportSchema.parse(demoReport);
    expect(report.sections).toHaveLength(2);
    expect(report.sections[1]?.figures).toEqual([]);
  });

  it("rejects a report whose role is not one of the three product roles", () => {
    const result = reportSchema.safeParse({ ...demoReport, role: "ceo" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["role"]]);
  });

  it("rejects a report section whose code is not one of the six section codes", () => {
    const result = reportSchema.safeParse({
      ...demoReport,
      sections: [{ code: "intro", title: "Intro", body: "Texto" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections", 0, "code"],
    ]);
  });

  it("rejects a report figure whose value is not a number", () => {
    const result = reportSchema.safeParse({
      ...demoReport,
      sections: [
        {
          code: "resumen",
          title: "Resumen",
          body: "Texto",
          figures: [{ label: "Score", value: "50", unit: "pts" }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections", 0, "figures", 0, "value"],
    ]);
  });

  it("rejects a report without sections", () => {
    const result = reportSchema.safeParse({ ...demoReport, sections: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections"],
    ]);
  });

  it("rejects a report that omits the sections key", () => {
    const { sections: _sections, ...reportWithoutSections } = demoReport;
    const result = reportSchema.safeParse(reportWithoutSections);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections"],
    ]);
  });

  it("accepts a report for each of the three product roles", () => {
    for (const role of ["tesorero", "financiero", "ventas"]) {
      expect(reportSchema.parse({ ...demoReport, role }).role).toBe(role);
    }
  });

  it("admits exactly the six section codes, decision included, in order", () => {
    expect(reportSectionCodeSchema.options).toEqual([
      "resumen",
      "por_que",
      "que_hacer",
      "datos_y_limites",
      "grupo",
      "decision",
    ]);
  });

  it("accepts a report generated at the current instant", () => {
    const generatedAt = new Date().toISOString();
    const report = reportSchema.parse({
      ...demoReport,
      generated_at: generatedAt,
    });
    expect(report.generated_at).toBe(generatedAt);
  });

  it("rejects a report whose generated_at is not an ISO datetime", () => {
    const result = reportSchema.safeParse({
      ...demoReport,
      generated_at: "yesterday",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["generated_at"],
    ]);
  });

  it("rejects a report without an export url", () => {
    const { export_url: _exportUrl, ...reportWithoutExportUrl } = demoReport;
    const result = reportSchema.safeParse(reportWithoutExportUrl);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["export_url"],
    ]);
  });

  it("rejects a report figure without a label", () => {
    const result = reportSchema.safeParse({
      ...demoReport,
      sections: [
        {
          code: "resumen",
          title: "Resumen",
          body: "Texto",
          figures: [{ value: 50, unit: "pts" }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections", 0, "figures", 0, "label"],
    ]);
  });

  it("rejects a report figure without a unit", () => {
    const result = reportSchema.safeParse({
      ...demoReport,
      sections: [
        {
          code: "resumen",
          title: "Resumen",
          body: "Texto",
          figures: [{ label: "Score", value: 50 }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["sections", 0, "figures", 0, "unit"],
    ]);
  });

  it("accepts a compare payload of one month and one company with its series", () => {
    const compare = compareSchema.parse({
      months: ["2026-08"],
      companies: [{ ...demoCompanySummary, series: [stableMonth] }],
    });
    expect(compare.companies[0]?.series).toEqual([stableMonth]);
  });

  it("accepts a compare payload of three companies", () => {
    const compare = compareSchema.parse({
      months: ["2026-08"],
      companies: [
        { ...demoCompanySummary, company_id: "COMP_0001", series: [] },
        { ...demoCompanySummary, company_id: "COMP_0002", series: [] },
        { ...demoCompanySummary, company_id: "COMP_0003", series: [] },
      ],
    });
    expect(compare.companies.map((company) => company.company_id)).toEqual([
      "COMP_0001",
      "COMP_0002",
      "COMP_0003",
    ]);
  });

  it("rejects a compare payload with no companies", () => {
    const result = compareSchema.safeParse({
      months: ["2026-08"],
      companies: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["companies"],
    ]);
  });

  it("rejects a compare payload that omits the companies key", () => {
    const result = compareSchema.safeParse({ months: ["2026-08"] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["companies"],
    ]);
  });

  it("rejects a compare payload that omits the months key", () => {
    const result = compareSchema.safeParse({
      companies: [{ ...demoCompanySummary, series: [] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["months"],
    ]);
  });

  it("rejects a compare company without its series", () => {
    const result = compareSchema.safeParse({
      months: ["2026-08"],
      companies: [demoCompanySummary],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["companies", 0, "series"],
    ]);
  });

  it("rejects a compare series entry without its evidence", () => {
    const { evidence: _evidence, ...monthWithoutEvidence } = stableMonth;
    const result = compareSchema.safeParse({
      months: ["2026-08"],
      companies: [{ ...demoCompanySummary, series: [monthWithoutEvidence] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["companies", 0, "series", 0, "evidence"],
    ]);
  });

  it("rejects a compare payload listing more than three companies", () => {
    const result = compareSchema.safeParse({
      months: ["2026-08"],
      companies: [
        { ...demoCompanySummary, company_id: "COMP_0001", series: [] },
        { ...demoCompanySummary, company_id: "COMP_0002", series: [] },
        { ...demoCompanySummary, company_id: "COMP_0003", series: [] },
        { ...demoCompanySummary, company_id: "COMP_0004", series: [] },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["companies"],
    ]);
  });

  it("rejects a compare payload without months", () => {
    const result = compareSchema.safeParse({
      months: [],
      companies: [{ ...demoCompanySummary, series: [] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["months"],
    ]);
  });

  it("maps each demo company name to its fictional company id", () => {
    expect(DEMO_COMPANY_NAMES).toEqual({
      "Talleres Ribera": "COMP_0176",
      "Bodegas Altamira": "COMP_0077",
      "Meridian Logística": "COMP_0909",
    });
  });
});
