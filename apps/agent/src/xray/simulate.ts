import type {
  CompanyDetail,
  MonthEntry,
  ReportFigure,
  Simulate,
  SimulateScenario,
} from "@hackspain/shared";
import { z } from "zod";
import { resolveCompany } from "./report.ts";
import type { Store } from "./store.ts";

const OBSERVED_MONTHS = 3;
const MOMENTUM_MONTHS = 6;
const LAMBDA = 0.25;
const ADJUSTMENT_CAP = 10;
const PENALTY_CAP = 15;
const MAX_HORIZON = 6;
const DEFAULT_FEE = 0.02;
const DEFAULT_APR = 0.06;
const CENTS = 2;
const TENTHS = 1;
// The exported flows carry no fees, so the baseline fee penalty starts at zero and only a scenario cost moves it.
const OBSERVED_FEES = 0;

export const simulateInput = z.object({
  company: z
    .string()
    .min(1)
    .describe(
      "Company id or exact demo name: Talleres Ribera, Bodegas Altamira, Meridian Logística",
    ),
  horizon: z.coerce.number().int().min(1).max(MAX_HORIZON).default(MAX_HORIZON),
  advance: z.coerce.number().min(0).default(0),
  fee: z.coerce.number().min(0).max(1).default(DEFAULT_FEE),
  draw: z.coerce.number().min(0).default(0),
  apr: z.coerce.number().min(0).max(1).default(DEFAULT_APR),
});

export type SimulateInput = z.infer<typeof simulateInput>;

export const simulateQuery = simulateInput.omit({ company: true });

export const simulateDescription =
  "Project the cash of a company from its loaded treasury over the horizon and what one receivable advance or one draw on its line does to that cash, its cost and the index. The advance is capped by the pending receivables, the draw by the undrawn part of the line, and the output is a scenario, never an observation.";

type Flows = { inflow: number; outflow: number; fees: number };

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return sum(values) / values.length;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function level(flows: Flows): number | null {
  const total = flows.inflow + flows.outflow;
  if (total <= 0) {
    return null;
  }
  const penalty =
    flows.outflow > 0
      ? -Math.min((100 * flows.fees) / flows.outflow, PENALTY_CAP)
      : 0;
  return clamp((100 * flows.inflow) / total + penalty, 0, 100);
}

function rolling(series: Flows[], index: number): Flows {
  const months = series.slice(index - OBSERVED_MONTHS + 1, index + 1);
  return {
    inflow: sum(months.map((flows) => flows.inflow)),
    outflow: sum(months.map((flows) => flows.outflow)),
    fees: sum(months.map((flows) => flows.fees)),
  };
}

function score(series: Flows[]): number | null {
  const levels = series.map((_, index) =>
    index < OBSERVED_MONTHS - 1 ? null : level(rolling(series, index)),
  );
  const final = levels.at(-1) ?? null;
  const back = levels.at(-1 - OBSERVED_MONTHS) ?? null;
  if (final === null) {
    return null;
  }
  const momentum =
    series.length >= MOMENTUM_MONTHS && back !== null ? final - back : 0;
  return clamp(
    final + clamp(LAMBDA * momentum, -ADJUSTMENT_CAP, ADJUSTMENT_CAP),
    0,
    100,
  );
}

function carried(
  observed: Flows[],
  monthly: Flows,
  horizon: number,
  change: (month: number, flows: Flows) => void,
): Flows[] {
  const months = Array.from({ length: horizon }, (_, index) => {
    const flows = { ...monthly };
    change(index, flows);
    return flows;
  });
  return [...observed, ...months];
}

function cashPath(
  start: number,
  net: number,
  horizon: number,
  change: (month: number) => number,
): number[] {
  const cash = [start];
  for (let month = 1; month <= horizon; month += 1) {
    cash.push((cash[month - 1] ?? 0) + net + change(month));
  }
  return cash.map((value) => round(value, CENTS));
}

type Minimum = { value: number; month: number };

function lowest(cash: number[]): Minimum {
  let month = 0;
  for (const [index, value] of cash.entries()) {
    if (value < (cash[month] ?? 0)) {
      month = index;
    }
  }
  return { value: cash[month] ?? 0, month };
}

function tenths(value: number | null): number | null {
  return value === null ? null : round(value, TENTHS);
}

function delta(after: number | null, before: number | null): number {
  const from = tenths(before);
  const to = tenths(after);
  return from === null || to === null ? 0 : round(to - from, TENTHS);
}

function withFigures(
  currency: string,
  scenario: Omit<SimulateScenario, "decision_figures">,
): SimulateScenario {
  const figures: ReportFigure[] = [
    { label: "Caja mínima", value: scenario.minimum_cash, unit: currency },
    { label: "Caja final", value: scenario.final_cash, unit: currency },
    { label: "Coste", value: scenario.cost, unit: currency },
    { label: "Delta score", value: scenario.score_delta, unit: "pts" },
  ];
  return { ...scenario, decision_figures: figures };
}

export function simulate(
  company: CompanyDetail,
  months: MonthEntry[],
  input: SimulateInput,
): Simulate {
  const { treasury } = company;
  const currency = company.currency ?? "EUR";
  const observed = months.map((entry) => ({
    inflow: entry.flows.inflow,
    outflow: entry.flows.outflow,
    fees: OBSERVED_FEES,
  }));
  const net = mean(
    months.map(
      (entry) =>
        entry.flows.inflow - entry.flows.outflow - entry.flows.debt_repayment,
    ),
  );
  const monthly = {
    inflow: mean(observed.map((flows) => flows.inflow)),
    outflow: mean(observed.map((flows) => flows.outflow)),
    fees: mean(observed.map((flows) => flows.fees)),
  };
  const baselineCash = cashPath(
    treasury.starting_cash,
    net,
    input.horizon,
    () => 0,
  );
  const baselineMinimum = lowest(baselineCash);
  const baselineScore = score(
    carried(observed, monthly, input.horizon, () => undefined),
  );
  const scenarios: SimulateScenario[] = [];

  if (input.advance > 0) {
    const applied = round(
      Math.min(input.advance, treasury.pending_receivables),
      CENTS,
    );
    const cost = round(applied * input.fee, CENTS);
    const cash = cashPath(
      treasury.starting_cash,
      net,
      input.horizon,
      (month) => (month === 1 ? applied - cost : 0),
    );
    const advanced = score(
      carried(observed, monthly, input.horizon, (month, flows) => {
        if (month === 0) {
          flows.inflow += applied;
          flows.fees += cost;
          flows.outflow += cost;
        }
      }),
    );
    const minimum = lowest(cash);
    scenarios.push(
      withFigures(currency, {
        kind: "receivable_advance",
        requested: round(input.advance, CENTS),
        applied,
        capped: applied < input.advance,
        cost,
        cash,
        final_cash: cash.at(-1) ?? 0,
        minimum_cash: minimum.value,
        minimum_cash_month: minimum.month,
        score: tenths(advanced),
        score_delta: delta(advanced, baselineScore),
        debt_outstanding_after: round(treasury.credit_line_drawn, CENTS),
      }),
    );
  }

  if (input.draw > 0) {
    const available = Math.max(
      treasury.credit_line_limit - treasury.credit_line_drawn,
      0,
    );
    const applied = round(Math.min(input.draw, available), CENTS);
    const interest = round((applied * input.apr) / 12, CENTS);
    const cost = round(interest * input.horizon, CENTS);
    const cash = cashPath(
      treasury.starting_cash,
      net,
      input.horizon,
      (month) => (month === 1 ? applied : 0) - interest,
    );
    const drawn = score(
      carried(observed, monthly, input.horizon, (_month, flows) => {
        flows.fees += interest;
        flows.outflow += interest;
      }),
    );
    const minimum = lowest(cash);
    scenarios.push(
      withFigures(currency, {
        kind: "credit_line_draw",
        requested: round(input.draw, CENTS),
        applied,
        capped: applied < input.draw,
        cost,
        cash,
        final_cash: cash.at(-1) ?? 0,
        minimum_cash: minimum.value,
        minimum_cash_month: minimum.month,
        score: tenths(drawn),
        score_delta: delta(drawn, baselineScore),
        debt_outstanding_after: round(
          treasury.credit_line_drawn + applied,
          CENTS,
        ),
      }),
    );
  }

  return {
    company_id: company.company_id,
    label: "escenario",
    horizon: input.horizon,
    inputs: {
      starting_cash: round(treasury.starting_cash, CENTS),
      pending_receivables: round(treasury.pending_receivables, CENTS),
      credit_line_limit: round(treasury.credit_line_limit, CENTS),
      credit_line_drawn: round(treasury.credit_line_drawn, CENTS),
      net_flow_monthly: round(net, CENTS),
    },
    baseline: {
      cash: baselineCash,
      final_cash: baselineCash.at(-1) ?? 0,
      minimum_cash: baselineMinimum.value,
      minimum_cash_month: baselineMinimum.month,
      score: tenths(baselineScore),
    },
    scenarios,
  };
}

export async function simulateCompany(
  store: Store,
  input: SimulateInput,
): Promise<Simulate | { error: string }> {
  const company = await store.company(resolveCompany(input.company));
  if (!company) {
    return { error: "Unknown company" };
  }
  const months = company.series
    .filter((entry) => entry.observed)
    .slice(-OBSERVED_MONTHS);
  if (months.length < OBSERVED_MONTHS) {
    return { error: "No months observed" };
  }
  return simulate(company, months, input);
}
