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

export const driverSchema = z.object({
  code: z.string(),
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
  components: z.record(z.string(), z.number()),
  drivers: z.array(driverSchema),
  changed: z.array(z.object({ code: z.string(), delta: z.number() })),
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
  changed: z.array(z.object({ code: z.string(), delta: z.number() })),
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
  state_labels: z.record(z.string(), z.string()),
  latest_month: z.string(),
  holdout_groups: z.array(z.string()),
});

export type Meta = z.infer<typeof metaSchema>;

export const chatRequestSchema = z.object({
  company_id: z.string().optional(),
  messages: z.array(z.unknown()),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
