import { z } from "zod";
import {
  commitmentEvaluationSchema,
  commitmentRequestSchema,
  treasurySnapshotSchema,
} from "./commitment.ts";

export const stateSchema = z.enum([
  "healthy",
  "improving",
  "stable",
  "slipping",
  "falling",
  "not_evaluable",
]);

export type State = z.infer<typeof stateSchema>;

export const STATE_LABELS: Record<State, string> = {
  healthy: "sana",
  improving: "mejorando",
  stable: "estable",
  slipping: "torciéndose",
  falling: "cayendo",
  not_evaluable: "no evaluable",
};

export const confidenceSchema = z.enum(["none", "low", "medium", "high"]);

export const componentCodeSchema = z.enum([
  "balance",
  "fees",
  "refunds",
  "momentum",
]);

export const driverCodeSchema = z.enum([
  "balance",
  "fees",
  "refunds",
  "momentum",
  "inflow_vs_prev6",
  "debt_repayment_break",
  "withdrawals",
]);

export const changeCodeSchema = z.enum([
  "balance",
  "fees",
  "refunds",
  "momentum",
  "cap",
]);

export const driverSchema = z.object({
  code: driverCodeSchema,
  contribution: z.number(),
  value: z.number().nullable(),
  unit: z.string(),
  period: z.string(),
  text: z.string(),
});

export type Driver = z.infer<typeof driverSchema>;

export const evidenceSchema = z.object({
  months_observed: z.number(),
  transactions_in_window: z.number(),
  share_uncategorised: z.number(),
  window: z.string().nullable(),
  cutoff: z.string(),
  currency: z.string(),
  sources: z.object({
    transactions: z.boolean(),
    invoices: z.boolean(),
    debt: z.boolean(),
  }),
  rule_version: z.string(),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const monthEntrySchema = z.object({
  month: z.string(),
  observed: z.boolean(),
  level: z.number().nullable(),
  momentum: z.number().nullable(),
  adjustment: z.number().nullable(),
  score: z.number().nullable(),
  delta_3: z.number().nullable(),
  delta_6: z.number().nullable(),
  state: stateSchema,
  confidence: confidenceSchema,
  components: z.partialRecord(componentCodeSchema, z.number()),
  drivers: z.array(driverSchema),
  changed: z.array(z.object({ code: changeCodeSchema, delta: z.number() })),
  evidence: evidenceSchema,
  flows: z.object({
    inflow: z.number(),
    outflow: z.number(),
    financing_in: z.number(),
    financing_out: z.number(),
    debt_repayment: z.number(),
  }),
  events: z.object({
    E1: z.boolean(),
    E2: z.boolean(),
    E3: z.boolean(),
    E4: z.boolean(),
  }),
});

export type MonthEntry = z.infer<typeof monthEntrySchema>;

export const latestSchema = z.object({
  month: z.string().nullable(),
  score: z.number().nullable(),
  delta_3: z.number().nullable(),
  delta_6: z.number().nullable(),
  level: z.number().nullable(),
  momentum: z.number().nullable(),
  state: stateSchema,
  confidence: confidenceSchema,
});

export const treasurySchema = z.object({
  starting_cash: z.number(),
  pending_receivables: z.number(),
  credit_line_limit: z.number(),
  credit_line_drawn: z.number(),
});

export type Treasury = z.infer<typeof treasurySchema>;

export const trendProjectionPointSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  base: z.number().min(0).max(100),
  favorable: z.number().min(0).max(100),
  adverse: z.number().min(0).max(100),
});

const trendProjectionEvidenceSchema = z.object({
  latest_score: z.number().min(0).max(100).nullable(),
  momentum: z.number().nullable(),
  volatility: z.number().nonnegative(),
  source_months: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
});

const trendProjectionBaseSchema = z.object({
  rule_version: z.string(),
  semantics: z.literal("scenario_range_not_confidence_interval"),
  observed_months: z.number().int().nonnegative(),
  min_months_required: z.number().int().positive(),
  months_missing: z.number().int().nonnegative(),
});

export const trendProjectionSchema = z.discriminatedUnion("status", [
  trendProjectionBaseSchema.extend({
    status: z.literal("available"),
    reason: z.null(),
    points: z.array(trendProjectionPointSchema).length(3),
    evidence: trendProjectionEvidenceSchema.extend({
      latest_score: z.number().min(0).max(100),
      momentum: z.number(),
    }),
  }),
  trendProjectionBaseSchema.extend({
    status: z.literal("insufficient_data"),
    reason: z.enum([
      "company_stale",
      "latest_score_unavailable",
      "insufficient_history",
      "momentum_unavailable",
    ]),
    points: z.array(trendProjectionPointSchema).length(0),
    evidence: trendProjectionEvidenceSchema,
  }),
]);

export type TrendProjection = z.infer<typeof trendProjectionSchema>;

export const companySummarySchema = z.object({
  rule_version: z.string(),
  company_id: z.string(),
  name: z.string().min(1),
  group_id: z.string().nullable(),
  currency: z.string().nullable(),
  scorable: z.boolean(),
  holdout: z.boolean(),
  months_observed: z.number(),
  last_observed_month: z.string().nullable(),
  stale: z.boolean(),
  debt_outstanding: z.number(),
  invoice_facts: z.object({
    overdue_count: z.number().optional(),
    overdue_amount: z.number().optional(),
    oldest_overdue_days: z.number().optional(),
    top3_share_of_pending: z.number().optional(),
  }),
  treasury: treasurySchema,
  latest: latestSchema,
  treasury_snapshot: treasurySnapshotSchema.nullable().optional(),
  trend_projection: trendProjectionSchema,
});

export type CompanySummary = z.infer<typeof companySummarySchema>;

export const companyDetailSchema = companySummarySchema.extend({
  series: z.array(monthEntrySchema),
});

export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export const alertKindSchema = z.enum(["down", "up", "recovered"]);

const alertStageSchema = z.enum(["candidate", "confirmed"]);

export const alertSchema = z.object({
  rule_version: z.string(),
  company_id: z.string(),
  group_id: z.string().nullable(),
  month: z.string(),
  kind: alertKindSchema,
  stage: alertStageSchema.nullable(),
  state: stateSchema,
  previous_state: stateSchema,
  score: z.number(),
  delta: z.number(),
  driver: z.string().nullable(),
});

export type Alert = z.infer<typeof alertSchema>;

export const groupMemberSchema = latestSchema.extend({
  company_id: z.string(),
  name: z.string().min(1),
  debt_outstanding: z.number(),
  debt_share: z.number().nullable(),
});

export const groupSchema = z.object({
  group_id: z.string(),
  holdout: z.boolean(),
  n_companies: z.number(),
  n_falling: z.number(),
  debt_outstanding: z.number(),
  debt_share_top: z.number().nullable(),
  tension: z.boolean(),
  members: z.array(groupMemberSchema),
});

export type Group = z.infer<typeof groupSchema>;

export const diagnosisSchema = z.strictObject({
  status: z.enum(["CURRENT", "RETROSPECTIVE", "INSUFFICIENT_EVIDENCE"]),
  scope: z.literal("PARTIAL_TREASURY_DIAGNOSIS"),
  state_since: z.string().nullable(),
  findings: z.array(
    z.strictObject({
      code: driverCodeSchema,
      certainty: z.literal("HYPOTHESIS"),
      observed: z.string(),
      hypothesis: z.string(),
      alternative: z.string(),
      check: z.string(),
      action: z.string(),
      evidence_ref: z.string(),
    }),
  ),
  next_steps: z.array(z.string()),
  limitations: z.array(z.string()),
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;

export const explainSchema = z.object({
  company_id: z.string(),
  name: z.string().min(1),
  group_id: z.string().nullable(),
  month: z.string(),
  score: z.number().nullable(),
  level: z.number().nullable(),
  momentum: z.number().nullable(),
  state: stateSchema,
  state_label: z.string(),
  confidence: confidenceSchema,
  drivers: z.array(driverSchema),
  changed: z.array(z.object({ code: changeCodeSchema, delta: z.number() })),
  events: z.array(z.string()),
  evidence: evidenceSchema,
  flows: monthEntrySchema.shape.flows,
  invoice_facts: companySummarySchema.shape.invoice_facts,
  action: z.string(),
  diagnosis: diagnosisSchema.optional(),
});

export type Explain = z.infer<typeof explainSchema>;

export const groupMapSchema = groupSchema.extend({
  tension_reason: z.string().nullable(),
  members: z.array(groupMemberSchema.extend({ state_label: z.string() })),
});

export type GroupMap = z.infer<typeof groupMapSchema>;

const alertStatsSchema = z.object({
  evaluated: z.number(),
  false_alarms: z.number(),
  false_alarm_rate: z.number().nullable(),
  reverted_within_3_months: z.number(),
  revert_rate: z.number().nullable(),
  censored: z.number(),
});

export const backtestSchema = z.object({
  rule_version: z.string(),
  events: z.record(
    z.string(),
    z.object({
      events: z.number(),
      with_prior_alert: z.number(),
      coverage: z.number().nullable(),
      median_lead_months: z.number().nullable(),
    }),
  ),
  alerts: alertStatsSchema,
  alerts_by_stage: z.object({
    candidate: alertStatsSchema,
    confirmed: alertStatsSchema,
  }),
  definitions: z.record(z.string(), z.string()),
});

export type Backtest = z.infer<typeof backtestSchema>;

export const metaSchema = z.object({
  rule_version: z.string(),
  generated_at: z.iso.datetime({ offset: true }),
  policy: z.record(z.string(), z.number()),
  state_labels: z.partialRecord(stateSchema, z.string()),
  latest_month: z.string(),
  holdout_groups: z.array(z.string()),
  gaps: z.object({
    companies_with_gaps: z.number().int().nonnegative(),
    unobserved_months: z.number().int().nonnegative(),
    stale_companies: z.number().int().nonnegative(),
  }),
});

export type Meta = z.infer<typeof metaSchema>;

export const roleSchema = z.enum(["tesorero", "financiero", "ventas"]);

export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  tesorero: "Tesorero",
  financiero: "Financiero",
  ventas: "Ventas",
};

export const reportSectionCodeSchema = z.enum([
  "resumen",
  "por_que",
  "que_hacer",
  "datos_y_limites",
  "grupo",
  "decision",
]);

export type ReportSectionCode = z.infer<typeof reportSectionCodeSchema>;

export const reportFigureSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.string(),
});

export type ReportFigure = z.infer<typeof reportFigureSchema>;

export const reportSectionSchema = z.object({
  code: reportSectionCodeSchema,
  title: z.string(),
  body: z.string(),
  figures: z.array(reportFigureSchema).default([]),
});

export type ReportSection = z.infer<typeof reportSectionSchema>;

export const commitmentResponseSchema = z.strictObject({
  evaluation: commitmentEvaluationSchema,
  report_section: reportSectionSchema,
});
export type CommitmentResponse = z.infer<typeof commitmentResponseSchema>;

export const reportSchema = z.object({
  schema_version: z.literal("human-v2"),
  company_id: z.string(),
  company_name: z.string().min(1),
  month: z.string(),
  role: roleSchema,
  rule_version: z.string(),
  generated_at: z.iso.datetime(),
  score: z.number().nullable(),
  state: stateSchema,
  state_label: z.string(),
  headline: z.string().min(1),
  summary: z.string().min(1),
  score_explanation: z.string().min(1),
  outlook: z.string().min(1),
  caveat: z.string(),
  next_steps: z.array(z.string().min(1)).max(2),
  source: z.enum(["llm", "template"]),
  export_url: z.string(),
  trend_projection: trendProjectionSchema,
});

export type Report = z.infer<typeof reportSchema>;

export type ReportHeadings = {
  score_explanation: string;
  outlook: string;
  caveat: string;
  next_steps: string;
};

export const REPORT_HEADINGS: Record<Role, ReportHeadings> = {
  tesorero: {
    score_explanation: "Qué ha cambiado",
    outlook: "Qué podemos esperar",
    caveat: "Ten en cuenta",
    next_steps: "Qué conviene revisar",
  },
  financiero: {
    score_explanation: "Por qué tiene esta puntuación",
    outlook: "Cómo interpretar los próximos meses",
    caveat: "Hasta dónde llega esta lectura",
    next_steps: "Qué comprobar antes de decidir",
  },
  ventas: {
    score_explanation: "Qué explica su situación",
    outlook: "Qué podemos esperar",
    caveat: "Ten en cuenta",
    next_steps: "Cómo abordar la conversación",
  },
};

export const REPORT_WORD_LIMITS: Record<Role, number> = {
  tesorero: 300,
  financiero: 350,
  ventas: 260,
};

export const compareSchema = z.object({
  months: z.array(z.string()).min(1),
  companies: z.array(companyDetailSchema).min(1).max(3),
});

export type Compare = z.infer<typeof compareSchema>;

export const relationTypeSchema = z.enum([
  "INFERRED_PAYMENT_TO",
  "OPEN_OBLIGATION_TO",
  "SHARES_COUNTERPARTY_WITH",
]);

export type RelationType = z.infer<typeof relationTypeSchema>;

export const relationConfidenceSchema = z.enum(["high", "medium", "low"]);

export type RelationConfidence = z.infer<typeof relationConfidenceSchema>;

export const relationSubtypeSchema = z.enum([
  "cash_pooling",
  "credit_line_financing",
  "payroll_on_behalf",
  "taxes_on_behalf",
  "funds_transfer",
  "commercial_payment",
  "other_flows",
  "sale_to_purchase_invoice",
  "in_house_bank_line",
  "client_portfolio_transfer",
  "shared_supplier_or_client",
]);

export type RelationSubtype = z.infer<typeof relationSubtypeSchema>;

export const relationScopeSchema = z.enum(["intragroup", "intergroup"]);

export type RelationScope = z.infer<typeof relationScopeSchema>;

export const relationEvidenceLevelSchema = z.enum([
  "bank_mirror",
  "invoice_mirror",
  "debt_balance_mirror",
  "shared_counterparty_id",
]);

export const relationEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  relation_type: relationTypeSchema,
  subtype: relationSubtypeSchema,
  scope: relationScopeSchema,
  confidence: relationConfidenceSchema,
  claim_status: z.literal("inferred"),
  evidence_level: relationEvidenceLevelSchema,
  matches: z.number().int().nonnegative(),
  amount_minor: z.number().int(),
  currency: z.string(),
  first_date: z.string(),
  last_date: z.string(),
  evidence_ids: z.array(z.string()).max(20),
  detail: z.record(z.string(), z.unknown()),
  example: z.string(),
  provider_identity_confirmed: z.literal(false),
});

export type RelationEdge = z.infer<typeof relationEdgeSchema>;

export const relationRoleSchema = z.enum([
  "group_treasury_hub",
  "connected",
  "isolated",
]);

export const relationArtifactNodeSchema = z.object({
  company_id: z.string(),
  name: z.string().min(1),
  group_id: z.string().nullable(),
  degree: z.number().int().nonnegative(),
  role: relationRoleSchema,
  intercompany_flow_volume_minor: z.number().int().nonnegative(),
});

export type RelationArtifactNode = z.infer<typeof relationArtifactNodeSchema>;

export const relationNodeSchema = relationArtifactNodeSchema.extend({
  score: z.number().nullable(),
  state: stateSchema,
  scorable: z.boolean(),
});

export type RelationNode = z.infer<typeof relationNodeSchema>;

const relationCountSchema = z.number().int().nonnegative().default(0);

export const graphMetaSchema = z.object({
  rule_version: z.string(),
  generated_at: z.iso.datetime({ offset: true }),
  counts: z.strictObject({
    INFERRED_PAYMENT_TO: relationCountSchema,
    OPEN_OBLIGATION_TO: relationCountSchema,
    SHARES_COUNTERPARTY_WITH: relationCountSchema,
  }),
});

export type GraphMeta = z.infer<typeof graphMetaSchema>;

export const graphSchema = z.object({
  meta: graphMetaSchema,
  nodes: z.array(relationNodeSchema),
  edges: z.array(relationEdgeSchema),
});

export type Graph = z.infer<typeof graphSchema>;

export const companyRelationEdgeSchema = relationEdgeSchema.extend({
  counterpart_company_id: z.string(),
  counterpart_group_id: z.string().nullable(),
  counterpart_score: z.number().nullable(),
  counterpart_state: stateSchema,
});

export type CompanyRelationEdge = z.infer<typeof companyRelationEdgeSchema>;

export const companyRelationsSchema = z.object({
  company_id: z.string(),
  edges: z.array(companyRelationEdgeSchema),
});

export type CompanyRelations = z.infer<typeof companyRelationsSchema>;

export const relationsArtifactSchema = z.object({
  meta: graphMetaSchema,
  calibration: z.record(
    z.string(),
    z.object({ intragroup: z.number().int(), intergroup: z.number().int() }),
  ),
  nodes: z.array(relationArtifactNodeSchema),
  edges: z.array(relationEdgeSchema),
});

export type RelationsArtifact = z.infer<typeof relationsArtifactSchema>;

export const simulateScenarioKindSchema = z.enum([
  "receivable_advance",
  "credit_line_draw",
]);

export type SimulateScenarioKind = z.infer<typeof simulateScenarioKindSchema>;

export const simulateScenarioSchema = z.object({
  kind: simulateScenarioKindSchema,
  requested: z.number(),
  applied: z.number(),
  capped: z.boolean(),
  cost: z.number(),
  cash: z.array(z.number()).min(1),
  final_cash: z.number(),
  minimum_cash: z.number(),
  minimum_cash_month: z.number().int(),
  score: z.number().nullable(),
  score_delta: z.number(),
  debt_outstanding_after: z.number(),
  decision_figures: z.array(reportFigureSchema),
});

export type SimulateScenario = z.infer<typeof simulateScenarioSchema>;

export const simulateSchema = z
  .object({
    company_id: z.string(),
    label: z.literal("escenario"),
    horizon: z.number().int(),
    inputs: z.object({
      starting_cash: z.number(),
      pending_receivables: z.number(),
      credit_line_limit: z.number(),
      credit_line_drawn: z.number(),
      net_flow_monthly: z.number(),
    }),
    baseline: z.object({
      cash: z.array(z.number()).min(1),
      final_cash: z.number(),
      minimum_cash: z.number(),
      minimum_cash_month: z.number().int(),
      score: z.number().nullable(),
    }),
    scenarios: z.array(simulateScenarioSchema),
  })
  .superRefine((simulate, context) => {
    const paths = [
      { path: ["baseline", "cash"], cash: simulate.baseline.cash },
      ...simulate.scenarios.map((scenario, index) => ({
        path: ["scenarios", index, "cash"],
        cash: scenario.cash,
      })),
    ];
    for (const { path, cash } of paths) {
      if (cash.length !== simulate.horizon + 1) {
        context.addIssue({
          code: "custom",
          message: `expected ${simulate.horizon + 1} cash entries, one per month from today to the horizon`,
          path,
        });
      }
    }
  });

export type Simulate = z.infer<typeof simulateSchema>;

const chatPartSchema = z
  .object({
    type: z.string().min(1),
  })
  .loose();

export const chatMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    parts: z.array(chatPartSchema).min(1),
  })
  .loose();

const chatCompanyId = z.string().min(1).max(120);

export const chatRequestSchema = z
  .object({
    company_id: chatCompanyId.optional(),
    compare_ids: z.array(chatCompanyId).min(1).max(3).optional(),
    role: roleSchema.optional(),
    confirmed_commitment: commitmentRequestSchema.optional(),
    messages: z.array(chatMessageSchema).min(1),
  })
  .superRefine((request, context) => {
    if (request.confirmed_commitment && !request.company_id) {
      context.addIssue({
        code: "custom",
        path: ["confirmed_commitment"],
        message: "A confirmed operation requires the selected company",
      });
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
