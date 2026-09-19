import { describe, expect, it } from "vitest";
import {
  alertSchema,
  backtestSchema,
  chatRequestSchema,
  companyDetailSchema,
  companyRelationsSchema,
  companySummarySchema,
  compareSchema,
  DEMO_COMPANY_NAMES,
  driverSchema,
  explainSchema,
  graphMetaSchema,
  graphSchema,
  metaSchema,
  monthEntrySchema,
  ROLE_LABELS,
  relationArtifactNodeSchema,
  relationEdgeSchema,
  relationNodeSchema,
  relationScopeSchema,
  relationsArtifactSchema,
  relationTypeSchema,
  reportFigureSchema,
  reportSchema,
  reportSectionCodeSchema,
  reportSectionSchema,
  roleSchema,
  simulateScenarioKindSchema,
  simulateSchema,
  stateSchema,
  treasurySchema,
} from "./index.ts";

const stableMonth = {
  month: "2026-08",
  observed: true,
  level: 50,
  momentum: 0,
  adjustment: 0,
  score: 50,
  delta_3: -1.2,
  delta_6: 5.4,
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
  rule_version: "xray-score/0.1",
  company_id: "COMP_0176",
  group_id: "GROUP_0001",
  currency: "EUR",
  scorable: true,
  holdout: false,
  months_observed: 3,
  last_observed_month: "2026-08",
  stale: false,
  debt_outstanding: 1200,
  invoice_facts: {},
  latest: {
    month: "2026-08",
    score: 50,
    delta_3: -1.2,
    delta_6: 5.4,
    level: 50,
    momentum: 0,
    state: "stable",
    confidence: "high",
  },
};

const demoAlert = {
  rule_version: "xray-score/0.1",
  company_id: "COMP_0001",
  group_id: "GROUP_0001",
  month: "2026-08",
  kind: "down",
  stage: "confirmed",
  state: "falling",
  previous_state: "slipping",
  score: 12.3,
  delta: -27.9,
  driver: null,
};

const demoAlertStats = {
  evaluated: 0,
  false_alarms: 0,
  false_alarm_rate: 0,
  reverted_within_3_months: 0,
  revert_rate: 0,
  censored: 0,
};

const demoBacktest = {
  rule_version: "xray-score/0.1",
  events: {},
  alerts: demoAlertStats,
  alerts_by_stage: { candidate: demoAlertStats, confirmed: demoAlertStats },
  definitions: {},
};

const demoMeta = {
  rule_version: "xray-score/0.1",
  generated_at: "2026-09-19T13:04:05+00:00",
  policy: { lambda: 0.25, adjustment_cap: 10, window_months: 3 },
  state_labels: { healthy: "sana" },
  latest_month: "2026-08",
  holdout_groups: [],
  gaps: { companies_with_gaps: 2, unobserved_months: 5, stale_companies: 1 },
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

const demoTreasury = {
  starting_cash: 150_000,
  pending_receivables: 33_333.33,
  credit_line_limit: 73_333.33,
  credit_line_drawn: 40_000,
};

const demoScenario = {
  kind: "receivable_advance",
  requested: 50_000,
  applied: 33_333.33,
  capped: true,
  cost: 666.67,
  cash: [150_000, 122_666.66, 62_666.66],
  final_cash: 62_666.66,
  minimum_cash: 62_666.66,
  minimum_cash_month: 2,
  score: 34.2,
  score_delta: 5.6,
  debt_outstanding_after: 40_000,
  decision_figures: [
    { label: "Caja mínima", value: 62_666.66, unit: "EUR" },
    { label: "Caja final", value: 62_666.66, unit: "EUR" },
    { label: "Coste", value: 666.67, unit: "EUR" },
    { label: "Delta score", value: 5.6, unit: "pts" },
  ],
};

const demoSimulate = {
  company_id: "COMP_B",
  label: "escenario",
  horizon: 2,
  inputs: { ...demoTreasury, net_flow_monthly: -60_000 },
  baseline: {
    cash: [150_000, 90_000, 30_000],
    final_cash: 30_000,
    minimum_cash: 30_000,
    minimum_cash_month: 2,
    score: 28.6,
  },
  scenarios: [demoScenario],
};

describe("xray contracts", () => {
  it.each([
    { delta_3: -1.2, delta_6: 5.4 },
    { delta_3: 0, delta_6: null },
    { delta_3: null, delta_6: 0 },
  ])("preserves score deltas in latest and series: %j", (deltas) => {
    const detail = companyDetailSchema.parse({
      ...demoCompanySummary,
      latest: { ...demoCompanySummary.latest, ...deltas },
      series: [{ ...stableMonth, ...deltas }],
    });
    expect(detail.latest).toMatchObject(deltas);
    expect(detail.series[0]).toMatchObject(deltas);
  });

  it.each([
    { field: "delta_3", value: "1.2" },
    { field: "delta_6", value: "5.4" },
    { field: "delta_3", value: undefined },
    { field: "delta_6", value: undefined },
  ])(
    "rejects invalid score deltas at their exact paths: %j",
    ({ field, value }) => {
      const result = companyDetailSchema.safeParse({
        ...demoCompanySummary,
        latest: { ...demoCompanySummary.latest, [field]: value },
        series: [{ ...stableMonth, [field]: value }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path)).toEqual([
        ["latest", field],
        ["series", 0, field],
      ]);
    },
  );

  it("accepts a company whose first months are not evaluable", () => {
    const detail = companyDetailSchema.parse({
      rule_version: "xray-score/0.1",
      company_id: "COMP_0001",
      group_id: "GROUP_0001",
      currency: "EUR",
      scorable: true,
      holdout: false,
      months_observed: 3,
      last_observed_month: "2026-08",
      stale: false,
      debt_outstanding: 0,
      invoice_facts: {},
      latest: {
        month: "2026-08",
        score: 51.2,
        delta_3: null,
        delta_6: null,
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
          delta_3: null,
          delta_6: null,
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
      delta_3: null,
      delta_6: null,
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
      ...demoMeta,
      state_labels: { healthy: "sana", bad: "mala" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["state_labels"],
    ]);
  });

  it("accepts a meta carrying the policy the score was computed with", () => {
    const meta = metaSchema.parse(demoMeta);
    expect(meta.rule_version).toBe("xray-score/0.1");
    expect(meta.generated_at).toBe("2026-09-19T13:04:05+00:00");
    expect(meta.policy).toEqual({
      lambda: 0.25,
      adjustment_cap: 10,
      window_months: 3,
    });
  });

  it("rejects a meta without the rule version", () => {
    const { rule_version: _ruleVersion, ...meta } = demoMeta;
    const result = metaSchema.safeParse(meta);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["rule_version"],
    ]);
  });

  it("rejects a meta without the generation timestamp", () => {
    const { generated_at: _generatedAt, ...meta } = demoMeta;
    const result = metaSchema.safeParse(meta);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["generated_at"],
    ]);
  });

  it("rejects a meta whose policy value is not a number", () => {
    const result = metaSchema.safeParse({
      ...demoMeta,
      policy: { lambda: "0.25" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["policy", "lambda"],
    ]);
  });

  it("rejects an alert without the rule version", () => {
    const { rule_version: _ruleVersion, ...alert } = demoAlert;
    const result = alertSchema.safeParse(alert);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["rule_version"],
    ]);
  });

  it("rejects an alert whose stage is neither candidate nor confirmed", () => {
    expect(
      alertSchema.safeParse({ ...demoAlert, stage: "maybe" }).success,
    ).toBe(false);
    expect(alertSchema.parse({ ...demoAlert, stage: null }).stage).toBeNull();
  });

  it("rejects a backtest whose alerts_by_stage is missing", () => {
    const { alerts_by_stage: _byStage, ...backtest } = demoBacktest;
    const result = backtestSchema.safeParse(backtest);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["alerts_by_stage"],
    ]);
  });

  it("rejects a backtest whose confirmed block loses one of the six alert fields", () => {
    const { revert_rate: _revertRate, ...confirmed } = demoAlertStats;
    const result = backtestSchema.safeParse({
      ...demoBacktest,
      alerts_by_stage: { ...demoBacktest.alerts_by_stage, confirmed },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["alerts_by_stage", "confirmed", "revert_rate"],
    ]);
  });

  it("accepts a staged block that never evaluated a rate", () => {
    const empty = {
      ...demoAlertStats,
      false_alarm_rate: null,
      revert_rate: null,
    };
    const backtest = backtestSchema.parse({
      ...demoBacktest,
      alerts_by_stage: { candidate: empty, confirmed: empty },
    });
    expect(backtest.alerts_by_stage.candidate.revert_rate).toBeNull();
    expect(backtest.alerts_by_stage.confirmed.false_alarm_rate).toBeNull();
  });

  it("rejects a company summary without the last observed month", () => {
    const { last_observed_month: _lastObserved, ...company } =
      demoCompanySummary;
    const result = companySummarySchema.safeParse(company);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["last_observed_month"],
    ]);
  });

  it("rejects a company summary without the stale flag", () => {
    const { stale: _stale, ...company } = demoCompanySummary;
    const result = companySummarySchema.safeParse(company);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["stale"],
    ]);
  });

  it("rejects a meta without the gap counts", () => {
    const { gaps: _gaps, ...meta } = demoMeta;
    const result = metaSchema.safeParse(meta);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["gaps"]]);
  });

  it("rejects a meta whose unobserved month count is not a non-negative integer", () => {
    const result = metaSchema.safeParse({
      ...demoMeta,
      gaps: { ...demoMeta.gaps, unobserved_months: -1 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["gaps", "unobserved_months"],
    ]);
  });

  it("rejects a backtest without the rule version", () => {
    const { rule_version: _ruleVersion, ...backtest } = demoBacktest;
    const result = backtestSchema.safeParse(backtest);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["rule_version"],
    ]);
  });

  it("rejects a company summary without the rule version", () => {
    const { rule_version: _ruleVersion, ...company } = demoCompanySummary;
    const result = companySummarySchema.safeParse(company);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["rule_version"],
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

  it("parses a section and a figure with their standalone schemas", () => {
    const figure = { label: "Score", value: 50, unit: "pts" };
    const section = { code: "grupo", title: "Grupo", body: "Sin tensión." };
    expect(reportFigureSchema.parse(figure)).toEqual(figure);
    expect(reportSectionSchema.parse(section)).toEqual({
      ...section,
      figures: [],
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

  it("rejects an empty report naming every required field", () => {
    const result = reportSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["company_id"],
      ["month"],
      ["role"],
      ["rule_version"],
      ["generated_at"],
      ["summary"],
      ["sections"],
      ["export_url"],
    ]);
  });

  it("rejects an empty report section naming every required field", () => {
    const result = reportSectionSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["code"],
      ["title"],
      ["body"],
    ]);
  });

  it("rejects an empty report figure naming every required field", () => {
    const result = reportFigureSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["label"],
      ["value"],
      ["unit"],
    ]);
  });

  it("rejects an empty compare payload naming every required field", () => {
    const result = compareSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["months"],
      ["companies"],
    ]);
  });

  it("maps each demo company name to its fictional company id", () => {
    expect(DEMO_COMPANY_NAMES).toEqual({
      "Talleres Ribera": "COMP_0176",
      "Bodegas Altamira": "COMP_0077",
      "Meridian Logística": "COMP_0909",
    });
  });

  it("keeps a company summary parseable with and without the treasury snapshot", () => {
    expect(
      companySummarySchema.parse(demoCompanySummary).treasury,
    ).toBeUndefined();
    expect(
      companySummarySchema.parse({
        ...demoCompanySummary,
        treasury: demoTreasury,
      }).treasury,
    ).toEqual(demoTreasury);
  });

  it("rejects a treasury that omits the undrawn credit line", () => {
    const { credit_line_drawn: _drawn, ...incomplete } = demoTreasury;
    const result = treasurySchema.safeParse(incomplete);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["credit_line_drawn"],
    ]);
  });

  it("accepts a labelled scenario payload with its figures in order", () => {
    const simulate = simulateSchema.parse(demoSimulate);
    expect(simulate.label).toBe("escenario");
    expect(simulate.scenarios[0]?.decision_figures.map((f) => f.label)).toEqual(
      ["Caja mínima", "Caja final", "Coste", "Delta score"],
    );
    expect(simulate.scenarios[0]?.kind).toBe("receivable_advance");
  });

  it("accepts a baseline whose score is not evaluable yet", () => {
    const simulate = simulateSchema.parse({
      ...demoSimulate,
      baseline: { ...demoSimulate.baseline, score: null },
      scenarios: [{ ...demoScenario, score: null, score_delta: 0 }],
    });
    expect(simulate.baseline.score).toBeNull();
  });

  it("rejects a payload whose label is not escenario", () => {
    const result = simulateSchema.safeParse({
      ...demoSimulate,
      label: "observado",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["label"],
    ]);
  });

  it("rejects a payload without the escenario label", () => {
    const { label: _label, ...unlabelled } = demoSimulate;
    const result = simulateSchema.safeParse(unlabelled);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["label"],
    ]);
  });

  it("rejects a scenario whose kind is not one of the two simulated decisions", () => {
    const result = simulateSchema.safeParse({
      ...demoSimulate,
      scenarios: [{ ...demoScenario, kind: "receivable_sale" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["scenarios", 0, "kind"],
    ]);
    expect(simulateScenarioKindSchema.options).toEqual([
      "receivable_advance",
      "credit_line_draw",
    ]);
  });

  it("rejects a scenario without its decision figures", () => {
    const { decision_figures: _figures, ...scenario } = demoScenario;
    const result = simulateSchema.safeParse({
      ...demoSimulate,
      scenarios: [scenario],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["scenarios", 0, "decision_figures"],
    ]);
  });

  it("rejects a scenario figure whose unit is missing", () => {
    const result = simulateSchema.safeParse({
      ...demoSimulate,
      scenarios: [
        {
          ...demoScenario,
          decision_figures: [{ label: "Coste", value: 666.67 }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["scenarios", 0, "decision_figures", 0, "unit"],
    ]);
  });

  it("rejects a baseline cash path without its starting month", () => {
    const result = simulateSchema.safeParse({
      ...demoSimulate,
      baseline: { ...demoSimulate.baseline, cash: [] },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["baseline", "cash"],
    ]);
  });
});

const relationEdge = {
  source: "COMP_0001",
  target: "COMP_0002",
  relation_type: "INFERRED_PAYMENT_TO",
  subtype: "cash_pooling",
  scope: "intragroup",
  confidence: "high",
  claim_status: "inferred",
  evidence_level: "bank_mirror",
  matches: 12,
  amount_minor: 1_234_500,
  currency: "EUR",
  first_date: "2025-01-03",
  last_date: "2026-08-27",
  evidence_ids: ["TX_0001", "TX_0002"],
  detail: { subtype_counts: { cash_pooling: 12 } },
  example: "Traspaso automatico de saldos",
  provider_identity_confirmed: false,
};

const relationArtifactNode = {
  company_id: "COMP_0001",
  group_id: "GROUP_0001",
  degree: 3,
  role: "group_treasury_hub",
  intercompany_flow_volume_minor: 9_000_000,
};

const relationNode = {
  ...relationArtifactNode,
  score: 51.2,
  state: "stable",
  scorable: true,
};

const relationsArtifact = {
  meta: {
    rule_version: "xray-relations/0.1",
    generated_at: "2026-09-19T13:04:05+00:00",
    counts: { INFERRED_PAYMENT_TO: 1731, OPEN_OBLIGATION_TO: 6 },
  },
  calibration: {
    bank_flows_observed_min_2: { intragroup: 41, intergroup: 7 },
  },
  nodes: [relationArtifactNode],
  edges: [relationEdge],
};

describe("relation contracts", () => {
  it("admits exactly the three relation types, in order", () => {
    expect(relationTypeSchema.options).toEqual([
      "INFERRED_PAYMENT_TO",
      "OPEN_OBLIGATION_TO",
      "SHARES_COUNTERPARTY_WITH",
    ]);
  });

  it("admits exactly the two relation scopes, in order", () => {
    expect(relationScopeSchema.options).toEqual(["intragroup", "intergroup"]);
    expect(relationScopeSchema.safeParse("both").success).toBe(false);
  });

  it("accepts an edge with every field of the relation contract", () => {
    expect(relationEdgeSchema.parse(relationEdge)).toEqual(relationEdge);
  });

  it("rejects an edge whose relation type is not one of the three relation types", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      relation_type: "OWNS",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["relation_type"],
    ]);
  });

  it("rejects an edge whose confidence is not one of the three relation confidences", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      confidence: "certain",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["confidence"],
    ]);
  });

  it("rejects an edge whose claim status is not inferred", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      claim_status: "confirmed",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["claim_status"],
    ]);
  });

  it("rejects an edge whose provider identity was confirmed", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      provider_identity_confirmed: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["provider_identity_confirmed"],
    ]);
  });

  it("rejects an edge whose evidence level is not one the pipeline emits", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      evidence_level: "guess",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["evidence_level"],
    ]);
  });

  it("rejects an edge whose subtype is not one the pipeline emits", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      subtype: "salary",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["subtype"],
    ]);
  });

  it("rejects an edge carrying more than twenty evidence ids", () => {
    const result = relationEdgeSchema.safeParse({
      ...relationEdge,
      evidence_ids: Array.from({ length: 21 }, (_item, index) => `TX_${index}`),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["evidence_ids"],
    ]);
  });

  it("accepts the artifact node the pipeline writes without the joined score", () => {
    expect(relationArtifactNodeSchema.parse(relationArtifactNode)).toEqual(
      relationArtifactNode,
    );
    const result = relationNodeSchema.safeParse(relationArtifactNode);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["score"],
      ["state"],
      ["scorable"],
    ]);
  });

  it("accepts a served node with the score, state and scorable of the latest month", () => {
    expect(relationNodeSchema.parse(relationNode)).toEqual(relationNode);
  });

  it("rejects a node whose role is not one of the three graph roles", () => {
    const result = relationNodeSchema.safeParse({
      ...relationNode,
      role: "treasury",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["role"]]);
  });

  it("accepts the relations artifact the pipeline writes, calibration included", () => {
    const artifact = relationsArtifactSchema.parse(relationsArtifact);
    expect(artifact.calibration.bank_flows_observed_min_2?.intergroup).toBe(7);
    expect(artifact.nodes).toHaveLength(1);
    expect(artifact.edges[0]?.claim_status).toBe("inferred");
  });

  it("rejects a relations artifact whose edge carries an unknown relation type", () => {
    const result = relationsArtifactSchema.safeParse({
      ...relationsArtifact,
      edges: [{ ...relationEdge, relation_type: "OWNS" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["edges", 0, "relation_type"],
    ]);
  });

  it("accepts a graph of served nodes and edges", () => {
    const graph = graphSchema.parse({
      meta: relationsArtifact.meta,
      nodes: [relationNode],
      edges: [relationEdge],
    });
    expect(graph.nodes[0]?.state).toBe("stable");
  });

  it("serves a count for every relation type, zero when the artifact omits it", () => {
    expect(Object.keys(graphMetaSchema.shape.counts.shape)).toEqual(
      relationTypeSchema.options,
    );
    const meta = graphMetaSchema.parse({
      ...relationsArtifact.meta,
      counts: {},
    });
    expect(meta.counts).toEqual({
      INFERRED_PAYMENT_TO: 0,
      OPEN_OBLIGATION_TO: 0,
      SHARES_COUNTERPARTY_WITH: 0,
    });
    expect(
      relationsArtifactSchema.parse(relationsArtifact).meta.counts,
    ).toEqual({
      INFERRED_PAYMENT_TO: 1731,
      OPEN_OBLIGATION_TO: 6,
      SHARES_COUNTERPARTY_WITH: 0,
    });
  });

  it("rejects a graph whose meta count is negative", () => {
    const result = graphMetaSchema.safeParse({
      ...relationsArtifact.meta,
      counts: { INFERRED_PAYMENT_TO: -1 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["counts", "INFERRED_PAYMENT_TO"],
    ]);
  });

  it("rejects a graph whose meta counts use a key that is not a relation type", () => {
    const result = graphSchema.safeParse({
      meta: { ...relationsArtifact.meta, counts: { OWNS: 1 } },
      nodes: [relationNode],
      edges: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["meta", "counts"],
    ]);
  });

  it("accepts a company relations payload whose edges carry the counterpart", () => {
    const relations = companyRelationsSchema.parse({
      company_id: "COMP_0001",
      edges: [
        {
          ...relationEdge,
          counterpart_company_id: "COMP_0002",
          counterpart_group_id: "GROUP_0001",
          counterpart_score: 88.1,
          counterpart_state: "healthy",
        },
      ],
    });
    expect(relations.edges[0]?.counterpart_state).toBe("healthy");
  });

  it("rejects a company relation edge without the counterpart state", () => {
    const {
      counterpart_state: _counterpartState,
      ...edgeWithoutCounterpartState
    } = {
      ...relationEdge,
      counterpart_company_id: "COMP_0002",
      counterpart_group_id: "GROUP_0001",
      counterpart_score: 88.1,
      counterpart_state: "healthy" as const,
    };
    const result = companyRelationsSchema.safeParse({
      company_id: "COMP_0001",
      edges: [edgeWithoutCounterpartState],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["edges", 0, "counterpart_state"],
    ]);
  });
});
