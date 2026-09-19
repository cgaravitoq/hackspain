import { z } from "zod";

export const MAX_MINOR = Number.MAX_SAFE_INTEGER;
const money = z.number().int().min(-MAX_MINOR).max(MAX_MINOR);
const nonnegativeMoney = money.nonnegative();
const identifier = z.string().min(1).max(120);

export const COMMITMENT_CONFIRMATION =
  "He confirmado la operación del formulario. Explícame el resultado.";

export function euroToMinor(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(
      "Use a nonnegative euro amount without thousands separators",
    );
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(MAX_MINOR)) {
    throw new Error("Amount exceeds the safe monetary range");
  }
  return Number(result);
}

export const treasurySnapshotSchema = z.strictObject({
  as_of: z.iso.date(),
  currency: z.literal("EUR"),
  ledger_minor: money.nullable(),
  available_minor: money.nullable(),
  account_ids: z.array(identifier),
  accounts_expected: z.number().int().nonnegative(),
  accounts_observed: z.number().int().nonnegative(),
  source: z.literal("balances.csv"),
  availability_verified: z.literal(false),
  limitations: z.array(z.string()),
});
export type TreasurySnapshot = z.infer<typeof treasurySnapshotSchema>;

export const cashLedgerSchema = z
  .strictObject({
    company_id: identifier,
    currency: z.literal("EUR"),
    as_of: z.iso.date(),
    horizon_end: z.iso.date(),
    observed_months: z.number().int().nonnegative(),
    opening_minor: money.nullable(),
    floor_minor: nonnegativeMoney,
    opening_verified: z.boolean(),
    coverage_verified: z.boolean(),
  })
  .superRefine((ledger, context) => {
    if (ledger.horizon_end <= ledger.as_of) {
      context.addIssue({
        code: "custom",
        path: ["horizon_end"],
        message: "Horizon must follow the cutoff",
      });
    }
    if (ledger.opening_verified && ledger.opening_minor === null) {
      context.addIssue({
        code: "custom",
        path: ["opening_minor"],
        message: "Verified opening cash cannot be missing",
      });
    }
  });
export type CashLedger = z.infer<typeof cashLedgerSchema>;

export const cashEventSchema = z.strictObject({
  id: identifier,
  company_id: identifier,
  currency: z.literal("EUR"),
  date: z.iso.date(),
  amount_minor: money,
});
export type CashEvent = z.infer<typeof cashEventSchema>;

export const cashScenarioInputSchema = z
  .strictObject({
    ledger: cashLedgerSchema,
    events: z.array(cashEventSchema).max(1000),
  })
  .superRefine(({ ledger, events }, context) => {
    const seen = new Set<string>();
    for (const [index, event] of events.entries()) {
      if (
        event.company_id !== ledger.company_id ||
        event.currency !== ledger.currency ||
        seen.has(event.id)
      ) {
        context.addIssue({
          code: "custom",
          path: ["events", index],
          message: "Event scope or identity is invalid",
        });
      }
      if (event.date <= ledger.as_of || event.date > ledger.horizon_end) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "date"],
          message: "Event is outside the ledger interval",
        });
      }
      seen.add(event.id);
    }
  });
export type CashScenarioInput = z.infer<typeof cashScenarioInputSchema>;

export const commitmentOpportunitySchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    revenue_minor: money.positive(),
    advance_date: z.iso.date(),
    final_payment_date: z.iso.date(),
    permitted_advance_bps: z
      .array(z.number().int().min(0).max(10000))
      .min(1)
      .max(11),
    costs: z
      .array(
        z.strictObject({
          id: identifier,
          date: z.iso.date(),
          amount_minor: money.positive(),
        }),
      )
      .min(1)
      .max(24),
  })
  .superRefine((opportunity, context) => {
    if (opportunity.advance_date > opportunity.final_payment_date) {
      context.addIssue({
        code: "custom",
        path: ["final_payment_date"],
        message: "Final payment must not precede the advance",
      });
    }
    if (
      new Set(opportunity.permitted_advance_bps).size !==
      opportunity.permitted_advance_bps.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["permitted_advance_bps"],
        message: "Advance options must be unique",
      });
    }
    if (
      new Set(opportunity.costs.map((cost) => cost.id)).size !==
      opportunity.costs.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["costs"],
        message: "Cost identifiers must be unique",
      });
    }
  });
export type CommitmentOpportunity = z.infer<typeof commitmentOpportunitySchema>;

export const commitmentRequestSchema = z.strictObject({
  opportunity: commitmentOpportunitySchema,
  horizon_months: z.number().int().min(1).max(6),
  reserve_floor_minor: nonnegativeMoney,
});
export type CommitmentRequest = z.infer<typeof commitmentRequestSchema>;

export const commitmentDraftSchema = z.strictObject({
  opportunity: z
    .strictObject({
      title: z.string().trim().min(1).max(120).optional(),
      revenue_minor: money.positive().optional(),
      advance_date: z.iso.date().optional(),
      final_payment_date: z.iso.date().optional(),
      permitted_advance_bps: z
        .array(z.number().int().min(0).max(10000))
        .min(1)
        .max(11)
        .optional(),
      costs: z
        .array(
          z.strictObject({
            id: identifier,
            date: z.iso.date(),
            amount_minor: money.positive(),
          }),
        )
        .min(1)
        .max(24)
        .optional(),
    })
    .optional(),
  horizon_months: z.number().int().min(1).max(6).optional(),
  reserve_floor_minor: nonnegativeMoney.optional(),
});
export type CommitmentDraft = z.infer<typeof commitmentDraftSchema>;

export const commitmentDraftResultSchema = z.strictObject({
  company_id: identifier,
  draft: commitmentDraftSchema,
  missing: z.array(z.string()),
});
export type CommitmentDraftResult = z.infer<typeof commitmentDraftResultSchema>;

const REQUIRED_DRAFT_FIELDS = [
  "opportunity.title",
  "opportunity.revenue_minor",
  "opportunity.advance_date",
  "opportunity.final_payment_date",
  "opportunity.permitted_advance_bps",
  "opportunity.costs",
  "horizon_months",
  "reserve_floor_minor",
] as const;

export function missingDraftFields(draft: CommitmentDraft): string[] {
  const present = new Set<string>([
    ...Object.keys(draft.opportunity ?? {}).map((key) => `opportunity.${key}`),
    ...Object.keys(draft).filter((key) => key !== "opportunity"),
  ]);
  return REQUIRED_DRAFT_FIELDS.filter((field) => !present.has(field));
}

export const cashPointSchema = z.strictObject({
  date: z.iso.date(),
  phase: z.enum(["DEBITS", "CREDITS"]),
  cash_minor: money,
});
export type CashPoint = z.infer<typeof cashPointSchema>;

export const cashOutcomeSchema = z.strictObject({
  status: z.enum([
    "COMPATIBLE_UNDER_ASSUMPTIONS",
    "INCOMPATIBLE",
    "INSUFFICIENT_EVIDENCE",
    "OUTSIDE_HORIZON",
  ]),
  min_cash_minor: money.nullable(),
  closing_minor: money.nullable(),
  shortfall_minor: nonnegativeMoney.nullable(),
  first_breach: cashPointSchema.nullable(),
  path: z.array(cashPointSchema),
  is_financial_authorization: z.literal(false),
});
export type CashOutcome = z.infer<typeof cashOutcomeSchema>;

export const commitmentContextSchema = z.strictObject({
  company_id: identifier,
  currency: z.string().nullable(),
  as_of: z.iso.date().nullable(),
  snapshot: treasurySnapshotSchema.nullable(),
  history_months: z.number().int().nonnegative(),
  max_horizon_months: z.number().int().min(0).max(6),
  baseline_months: z.array(z.string()),
  monthly_inflow_minor: nonnegativeMoney.nullable(),
  monthly_outflow_minor: nonnegativeMoney.nullable(),
  basis: z.enum(["LEDGER_SCENARIO_ONLY", "UNAVAILABLE"]),
  limitations: z.array(z.string()),
});
export type CommitmentContext = z.infer<typeof commitmentContextSchema>;

export const commitmentEvaluationSchema = z.strictObject({
  company_id: identifier,
  context: commitmentContextSchema,
  calculation_version: z.literal("xray-commitment/1"),
  status: z.enum([
    "EVALUATED",
    "INSUFFICIENT_EVIDENCE",
    "OUTSIDE_HORIZON",
    "UNSUPPORTED_CURRENCY",
  ]),
  label: z.literal("Simulación, no reservable, requiere revisión humana"),
  reservable: z.literal(false),
  opportunity: commitmentOpportunitySchema,
  horizon_end: z.iso.date().nullable(),
  reserve_floor_minor: nonnegativeMoney,
  search_kind: z.literal("ENUMERATED_GRID"),
  minimum_tested_feasible_bps: z.number().int().min(0).max(10000).nullable(),
  baseline: cashOutcomeSchema.nullable(),
  alternatives: z.array(
    z.strictObject({
      advance_bps: z.number().int().min(0).max(10000),
      advance_minor: nonnegativeMoney,
      cash: cashOutcomeSchema,
    }),
  ),
  assumptions: z.array(z.string()),
});
export type CommitmentEvaluation = z.infer<typeof commitmentEvaluationSchema>;
