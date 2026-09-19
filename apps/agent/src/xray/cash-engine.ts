import {
  type CashEvent,
  type CashOutcome,
  type CashPoint,
  type CashScenarioInput,
  type CommitmentOpportunity,
  cashEventSchema,
  cashLedgerSchema,
  MAX_MINOR,
} from "@hackspain/shared";

export function addMonths(value: string, months: number): string {
  const day = new Date(`${value}T00:00:00Z`);
  const originalDay = day.getUTCDate();
  day.setUTCDate(1);
  day.setUTCMonth(day.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
  ).getUTCDate();
  day.setUTCDate(Math.min(originalDay, lastDay));
  return day.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const day = new Date(`${value}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function checkedMinor(value: bigint): number {
  if (value > BigInt(MAX_MINOR) || value < -BigInt(MAX_MINOR)) {
    throw new RangeError("Monetary result exceeds the safe range");
  }
  return Number(value);
}

function empty(
  status: "INSUFFICIENT_EVIDENCE" | "OUTSIDE_HORIZON",
): CashOutcome {
  return {
    status,
    min_cash_minor: null,
    closing_minor: null,
    shortfall_minor: null,
    first_breach: null,
    path: [],
    is_financial_authorization: false,
  };
}

function calculate(
  input: CashScenarioInput,
  requireVerified: boolean,
): CashOutcome {
  const ledger = cashLedgerSchema.parse(input.ledger);
  const seen = new Set<string>();
  const events: CashEvent[] = [];
  let outside =
    ledger.horizon_end >
    addMonths(
      ledger.as_of,
      Math.min(6, Math.floor(ledger.observed_months / 3)),
    );
  for (const raw of input.events) {
    const event = cashEventSchema.parse(raw);
    if (event.company_id !== ledger.company_id || seen.has(event.id)) {
      throw new Error("Event identity or company differs from the ledger");
    }
    seen.add(event.id);
    outside ||= event.date <= ledger.as_of || event.date > ledger.horizon_end;
    events.push(event);
  }
  if (
    ledger.opening_minor === null ||
    (requireVerified && !(ledger.opening_verified && ledger.coverage_verified))
  ) {
    return empty("INSUFFICIENT_EVIDENCE");
  }
  if (outside) {
    return empty("OUTSIDE_HORIZON");
  }
  const buckets = new Map<string, { debits: bigint; credits: bigint }>();
  for (const event of events) {
    const bucket = buckets.get(event.date) ?? { debits: 0n, credits: 0n };
    if (event.amount_minor < 0) {
      bucket.debits += BigInt(event.amount_minor);
    } else {
      bucket.credits += BigInt(event.amount_minor);
    }
    buckets.set(event.date, bucket);
  }
  const days = [
    ...new Set([ledger.as_of, ledger.horizon_end, ...buckets.keys()]),
  ].sort();
  let cash = BigInt(ledger.opening_minor);
  let minimum = ledger.opening_minor;
  let firstBreach: CashPoint | null = null;
  const path: CashPoint[] = [];
  for (const day of days) {
    const bucket = buckets.get(day) ?? { debits: 0n, credits: 0n };
    for (const phase of ["DEBITS", "CREDITS"] as const) {
      cash += phase === "DEBITS" ? bucket.debits : bucket.credits;
      const point: CashPoint = {
        date: day,
        phase,
        cash_minor: checkedMinor(cash),
      };
      minimum = Math.min(minimum, point.cash_minor);
      if (firstBreach === null && point.cash_minor < ledger.floor_minor) {
        firstBreach = point;
      }
      path.push(point);
    }
  }
  return {
    status:
      minimum < ledger.floor_minor
        ? "INCOMPATIBLE"
        : "COMPATIBLE_UNDER_ASSUMPTIONS",
    min_cash_minor: minimum,
    closing_minor: checkedMinor(cash),
    shortfall_minor: checkedMinor(
      BigInt(ledger.floor_minor) > BigInt(minimum)
        ? BigInt(ledger.floor_minor) - BigInt(minimum)
        : 0n,
    ),
    first_breach: firstBreach,
    path,
    is_financial_authorization: false,
  };
}

export function evaluateCash(input: CashScenarioInput): CashOutcome {
  return calculate(input, true);
}

export function previewCash(input: CashScenarioInput): CashOutcome {
  return calculate(input, false);
}

export function compareAdvances(
  input: CashScenarioInput,
  opportunity: CommitmentOpportunity,
) {
  const alternatives = [...opportunity.permitted_advance_bps]
    .sort((a, b) => a - b)
    .map((bps) => {
      const advance = checkedMinor(
        (BigInt(opportunity.revenue_minor) * BigInt(bps) + 5000n) / 10000n,
      );
      const base = {
        company_id: input.ledger.company_id,
        currency: input.ledger.currency,
      };
      const events: CashEvent[] = [
        ...input.events,
        ...opportunity.costs.map((cost) => ({
          ...base,
          id: `opportunity:cost:${cost.id}`,
          date: cost.date,
          amount_minor: -cost.amount_minor,
        })),
        {
          ...base,
          id: "opportunity:advance",
          date: opportunity.advance_date,
          amount_minor: advance,
        },
        {
          ...base,
          id: "opportunity:final",
          date: opportunity.final_payment_date,
          amount_minor: opportunity.revenue_minor - advance,
        },
      ];
      return {
        advance_bps: bps,
        advance_minor: advance,
        cash: previewCash({ ledger: input.ledger, events }),
      };
    });
  return {
    search_kind: "ENUMERATED_GRID" as const,
    minimum_tested_feasible_bps:
      alternatives.find(
        (item) => item.cash.status === "COMPATIBLE_UNDER_ASSUMPTIONS",
      )?.advance_bps ?? null,
    alternatives,
  };
}
