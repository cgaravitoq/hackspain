import { z } from "zod";

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
  level: z.number().nullable(),
  momentum: z.number().nullable(),
  state: stateSchema,
  confidence: confidenceSchema,
});

export const companySummarySchema = z.object({
  company_id: z.string(),
  group_id: z.string().nullable(),
  currency: z.string().nullable(),
  scorable: z.boolean(),
  holdout: z.boolean(),
  months_observed: z.number(),
  debt_outstanding: z.number(),
  invoice_facts: z.object({
    overdue_count: z.number().optional(),
    overdue_amount: z.number().optional(),
    oldest_overdue_days: z.number().optional(),
    top3_share_of_pending: z.number().optional(),
  }),
  latest: latestSchema,
});

export type CompanySummary = z.infer<typeof companySummarySchema>;

export const companyDetailSchema = companySummarySchema.extend({
  series: z.array(monthEntrySchema),
});

export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export const alertKindSchema = z.enum(["down", "up", "recovered"]);

export const alertSchema = z.object({
  company_id: z.string(),
  group_id: z.string().nullable(),
  month: z.string(),
  kind: alertKindSchema,
  state: stateSchema,
  previous_state: stateSchema,
  score: z.number(),
  delta: z.number(),
  driver: z.string().nullable(),
});

export type Alert = z.infer<typeof alertSchema>;

export const groupMemberSchema = latestSchema.extend({
  company_id: z.string(),
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

export const explainSchema = z.object({
  company_id: z.string(),
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
});

export type Explain = z.infer<typeof explainSchema>;

export const groupMapSchema = groupSchema.extend({
  tension_reason: z.string().nullable(),
  members: z.array(groupMemberSchema.extend({ state_label: z.string() })),
});

export type GroupMap = z.infer<typeof groupMapSchema>;

export const backtestSchema = z.object({
  events: z.record(
    z.string(),
    z.object({
      events: z.number(),
      with_prior_alert: z.number(),
      coverage: z.number(),
      median_lead_months: z.number().nullable(),
    }),
  ),
  alerts: z.object({
    evaluated: z.number(),
    false_alarms: z.number(),
    false_alarm_rate: z.number(),
    reverted_within_3_months: z.number(),
    revert_rate: z.number(),
    censored: z.number(),
  }),
  definitions: z.record(z.string(), z.string()),
});

export type Backtest = z.infer<typeof backtestSchema>;

export const metaSchema = z.object({
  state_labels: z.partialRecord(stateSchema, z.string()),
  latest_month: z.string(),
  holdout_groups: z.array(z.string()),
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

export const reportSchema = z.object({
  company_id: z.string(),
  month: z.string(),
  role: roleSchema,
  rule_version: z.string(),
  generated_at: z.iso.datetime(),
  summary: z.string(),
  sections: z.array(reportSectionSchema).min(1),
  export_url: z.string(),
});

export type Report = z.infer<typeof reportSchema>;

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

export const graphMetaSchema = z.object({
  rule_version: z.string(),
  generated_at: z.iso.datetime({ offset: true }),
  counts: z.partialRecord(relationTypeSchema, z.number().int().nonnegative()),
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

export const DEMO_COMPANY_NAMES = {
  "Talleres Ribera": "COMP_0176",
  "Bodegas Altamira": "COMP_0077",
  "Meridian Logística": "COMP_0909",
} satisfies Record<string, string>;

const chatPartSchema = z
  .object({
    type: z.string().min(1),
  })
  .loose();

export const chatMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(chatPartSchema).min(1),
  })
  .loose();

export const chatRequestSchema = z.object({
  company_id: z.string().min(1).optional(),
  role: roleSchema.optional(),
  messages: z.array(chatMessageSchema).min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
