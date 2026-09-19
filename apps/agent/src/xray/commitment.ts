import type {
  CommitmentCheckpoint,
  CommitmentStatus,
  OpeningBasis,
} from "@hackspain/shared";

export type Ledger = {
  company_id: string;
  currency: "EUR";
  as_of: string;
  horizon_end: string;
  observed_months: number;
  opening_minor: number | null;
  floor_minor: number;
  opening_basis: OpeningBasis;
};

export type Flow = {
  id: string;
  company_id: string;
  currency: string;
  date: string;
  amount_minor: number;
};

type Evaluation = {
  status: CommitmentStatus;
  min_cash_minor?: number;
  closing_minor?: number;
  shortfall_minor?: number;
  first_breach?: CommitmentCheckpoint | null;
  path?: CommitmentCheckpoint[];
  is_financial_authorization: false;
};

type AdvanceAlternative = Evaluation & {
  advance_bps: number;
  advance_minor: number;
};

type AdvanceComparison = {
  search_kind: "ENUMERATED_GRID";
  minimum_tested_feasible_bps: number | null;
  alternatives: AdvanceAlternative[];
};

type DateParts = { year: number; month: number; day: number };

function money(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Amount must be integer cents within the safe range");
  }
  return value;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDate(value: string): DateParts {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD");
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new Error("Date must be a real calendar date");
  }
  return { year, month, day };
}

export function addMonths(value: string, months: number): string {
  const date = parseDate(value);
  const absoluteMonth = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  const result = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  parseDate(result);
  return result;
}

function validate(ledger: Ledger, flows: Flow[]): boolean {
  parseDate(ledger.as_of);
  parseDate(ledger.horizon_end);
  if (ledger.horizon_end <= ledger.as_of) {
    throw new Error("Horizon must end after the as-of date");
  }
  if (ledger.currency !== "EUR" || !ledger.company_id) {
    throw new Error("Evaluation requires one company in EUR");
  }
  if (money(ledger.floor_minor) < 0) {
    throw new Error("Cash floor cannot be negative");
  }
  if (ledger.opening_minor !== null) {
    money(ledger.opening_minor);
  }
  if (!Number.isInteger(ledger.observed_months) || ledger.observed_months < 0) {
    throw new Error("Observed months must be a non-negative integer");
  }
  let outside =
    ledger.horizon_end >
    addMonths(
      ledger.as_of,
      Math.min(6, Math.floor(ledger.observed_months / 3)),
    );
  const identifiers = new Set<string>();
  for (const flow of flows) {
    if (!flow.id || identifiers.has(flow.id)) {
      throw new Error("Flow id is missing or duplicated");
    }
    identifiers.add(flow.id);
    money(flow.amount_minor);
    parseDate(flow.date);
    if (
      flow.currency !== ledger.currency ||
      flow.company_id !== ledger.company_id
    ) {
      throw new Error("Flow currency or company is outside the ledger");
    }
    outside ||= !(ledger.as_of < flow.date && flow.date <= ledger.horizon_end);
  }
  return outside;
}

function days(ledger: Ledger, flows: Flow[]): string[] {
  return [
    ...new Set([
      ledger.as_of,
      ledger.horizon_end,
      ...flows.map((flow) => flow.date),
    ]),
  ].sort();
}

function trace(
  opening: number,
  flows: Flow[],
  evaluationDays: string[],
): CommitmentCheckpoint[] {
  const buckets = new Map<string, [number, number]>();
  for (const flow of flows) {
    const bucket = buckets.get(flow.date) ?? [0, 0];
    const index = flow.amount_minor < 0 ? 0 : 1;
    bucket[index] = money(bucket[index] + flow.amount_minor);
    buckets.set(flow.date, bucket);
  }
  let cash = opening;
  const path: CommitmentCheckpoint[] = [];
  for (const date of evaluationDays) {
    const bucket = buckets.get(date) ?? [0, 0];
    cash = money(cash + bucket[0]);
    path.push({ date, phase: "DEBITS", cash_minor: cash });
    cash = money(cash + bucket[1]);
    path.push({ date, phase: "CREDITS", cash_minor: cash });
  }
  return path;
}

function result(ledger: Ledger, path: CommitmentCheckpoint[]): Evaluation {
  const minimum = Math.min(...path.map((point) => point.cash_minor));
  return {
    status:
      minimum < ledger.floor_minor
        ? "INCOMPATIBLE"
        : "COMPATIBLE_UNDER_ASSUMPTIONS",
    min_cash_minor: minimum,
    closing_minor: path.at(-1)?.cash_minor ?? minimum,
    shortfall_minor: Math.max(0, ledger.floor_minor - minimum),
    first_breach:
      path.find((point) => point.cash_minor < ledger.floor_minor) ?? null,
    path,
    is_financial_authorization: false,
  };
}

export function evaluate(ledger: Ledger, flows: Flow[]): Evaluation {
  const outside = validate(ledger, flows);
  if (ledger.opening_minor === null || ledger.opening_basis === "UNKNOWN") {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      is_financial_authorization: false,
    };
  }
  if (outside) {
    return { status: "OUTSIDE_HORIZON", is_financial_authorization: false };
  }
  return result(
    ledger,
    trace(ledger.opening_minor, flows, days(ledger, flows)),
  );
}

export function compareAdvances(
  ledger: Ledger,
  revenueMinor: number,
  gridBps: number[],
  advanceDate: string,
  finalDate: string,
  costs: Flow[],
): AdvanceComparison {
  if (money(revenueMinor) <= 0 || gridBps.length < 1 || gridBps.length > 101) {
    throw new Error("Positive revenue and a bounded grid are required");
  }
  if (
    gridBps.some(
      (basisPoints) =>
        !Number.isInteger(basisPoints) ||
        basisPoints < 0 ||
        basisPoints > 10_000,
    )
  ) {
    throw new Error("Advance must use integer basis points");
  }
  parseDate(advanceDate);
  parseDate(finalDate);
  if (advanceDate > finalDate) {
    throw new Error("Advance cannot follow final collection");
  }
  const common = { company_id: ledger.company_id, currency: ledger.currency };
  const alternatives = [...new Set(gridBps)]
    .sort((left, right) => left - right)
    .map((advance_bps) => {
      const advance_minor = Number(
        (BigInt(revenueMinor) * BigInt(advance_bps) + 5000n) / 10_000n,
      );
      return {
        advance_bps,
        advance_minor,
        ...evaluate(ledger, [
          ...costs,
          {
            ...common,
            id: "offer-advance",
            date: advanceDate,
            amount_minor: advance_minor,
          },
          {
            ...common,
            id: "offer-final",
            date: finalDate,
            amount_minor: money(revenueMinor - advance_minor),
          },
        ]),
      };
    });
  return {
    search_kind: "ENUMERATED_GRID",
    minimum_tested_feasible_bps:
      alternatives.find(
        (alternative) => alternative.status === "COMPATIBLE_UNDER_ASSUMPTIONS",
      )?.advance_bps ?? null,
    alternatives,
  };
}
