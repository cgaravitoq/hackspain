import {
  COMMITMENT_LABEL,
  type CommitmentRequest,
  commitmentEvaluationSchema,
  commitmentRequestSchema,
} from "@hackspain/shared";
import {
  addMonths,
  compareAdvances,
  type Flow,
  type Ledger,
} from "./commitment.ts";
import { reportInput } from "./report-tool.ts";
import type { Store } from "./store.ts";

type FlowScope = Pick<Ledger, "company_id" | "currency">;

export const commitmentInput = commitmentRequestSchema.extend({
  company: reportInput.shape.company,
  opening_minor: commitmentRequestSchema.shape.opening_minor.describe(
    "Opening cash in integer EUR cents",
  ),
  floor_minor: commitmentRequestSchema.shape.floor_minor.describe(
    "Minimum cash floor in integer EUR cents",
  ),
  revenue_minor: commitmentRequestSchema.shape.revenue_minor.describe(
    "Opportunity revenue in integer EUR cents",
  ),
  advance_date: commitmentRequestSchema.shape.advance_date.describe(
    "Advance collection date as YYYY-MM-DD",
  ),
  final_date: commitmentRequestSchema.shape.final_date.describe(
    "Final collection date as YYYY-MM-DD",
  ),
  advance_bps: commitmentRequestSchema.shape.advance_bps.describe(
    "Advance alternatives in integer basis points from 0 to 10000",
  ),
  costs: commitmentRequestSchema.shape.costs.describe(
    "Opportunity costs with dates as YYYY-MM-DD and amounts in positive integer EUR cents",
  ),
  other_flows: commitmentRequestSchema.shape.other_flows.describe(
    "Other signed cash flows with dates as YYYY-MM-DD and amounts in integer EUR cents",
  ),
});

export const commitmentDescription =
  "Run a labelled commitment capacity simulation under user assumptions. It is never approval, confirmed available cash or a forecast.";

export async function simulateCommitment(
  store: Store,
  companyId: string,
  request: CommitmentRequest,
) {
  const company = await store.company(companyId);
  if (!company) {
    return { error: `Unknown company ${companyId}` };
  }
  if (company.currency !== "EUR") {
    return { error: "La simulación solo admite empresas en EUR" };
  }
  const allowed = Math.min(6, Math.floor(company.months_observed / 3));
  const latestMonth = company.series
    .map((entry) => entry.month)
    .sort()
    .at(-1);
  if (allowed === 0 || !latestMonth) {
    return { error: "Histórico insuficiente para proyectar" };
  }
  const asOf = addMonths(`${latestMonth}-01`, 1);
  const horizonEnd = addMonths(asOf, allowed);
  const common: FlowScope = {
    company_id: company.company_id,
    currency: "EUR",
  };
  const flows: Flow[] = [
    ...request.costs.map((cost, index) => ({
      ...common,
      id: `cost-${index}`,
      date: cost.date,
      amount_minor: -cost.amount_minor,
    })),
    ...request.other_flows.map((flow, index) => ({
      ...common,
      id: `flow-${index}`,
      date: flow.date,
      amount_minor: flow.amount_minor,
    })),
  ];
  const ledger: Ledger = {
    ...common,
    as_of: asOf,
    horizon_end: horizonEnd,
    observed_months: company.months_observed,
    opening_minor: request.opening_minor,
    floor_minor: request.floor_minor,
    opening_basis: "USER_ASSUMPTION",
  };
  const comparison = compareAdvances(
    ledger,
    request.revenue_minor,
    request.advance_bps,
    request.advance_date,
    request.final_date,
    flows,
  );
  return commitmentEvaluationSchema.parse({
    company_id: company.company_id,
    currency: "EUR",
    as_of: asOf,
    horizon_end: horizonEnd,
    observed_months: company.months_observed,
    basis: "USER_ASSUMPTION",
    readiness: "SIMULATION_ONLY",
    opening_verified: false,
    coverage_verified: false,
    is_financial_authorization: false,
    label: COMMITMENT_LABEL,
    search_kind: comparison.search_kind,
    minimum_tested_feasible_bps: comparison.minimum_tested_feasible_bps,
    assumptions: request,
    alternatives: comparison.alternatives.map((alternative) => ({
      ...alternative,
      final_minor: request.revenue_minor - alternative.advance_minor,
    })),
  });
}
