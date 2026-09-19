import { env, SELF } from "cloudflare:test";
import { commitmentEvaluationSchema } from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addMonths,
  compareAdvances,
  evaluate,
  type Flow,
  type Ledger,
} from "../xray/commitment.ts";
import oracle from "./fixtures/commitment-oracle.json";
import { commitmentRequest, seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

function ledger(changes: Partial<Ledger> = {}): Ledger {
  return {
    company_id: "DEMO",
    currency: "EUR",
    as_of: "2026-09-01",
    horizon_end: "2026-11-01",
    observed_months: 24,
    opening_minor: 4_000_000,
    floor_minor: 2_000_000,
    opening_basis: "BANK_AVAILABLE_VERIFIED",
    ...changes,
  };
}

function flow(
  id: string,
  date: string,
  amountMinor: number,
  changes: Partial<Flow> = {},
): Flow {
  return {
    id,
    company_id: "DEMO",
    currency: "EUR",
    date,
    amount_minor: amountMinor,
    ...changes,
  };
}

function order(prefix = "A", advanceMinor = 4_000_000): Flow[] {
  return [
    flow(`${prefix}-advance`, "2026-09-02", advanceMinor),
    flow(`${prefix}-cost`, "2026-09-10", -6_000_000),
    flow(`${prefix}-final`, "2026-10-30", 10_000_000 - advanceMinor),
  ];
}

describe("commitment simulation engine", () => {
  it("matches every audited oracle evaluation and advance comparison", () => {
    for (const fixture of oracle.evaluations) {
      expect(
        evaluate(
          {
            company_id: fixture.ledger.company_id,
            currency: "EUR",
            as_of: fixture.ledger.as_of,
            horizon_end: fixture.ledger.horizon_end,
            observed_months: fixture.ledger.observed_months,
            opening_minor: fixture.ledger.opening_minor,
            floor_minor: fixture.ledger.floor_minor,
            opening_basis: "BANK_AVAILABLE_VERIFIED",
          },
          fixture.flows,
        ),
        fixture.name,
      ).toEqual(fixture.output);
    }
    const fixture = oracle.comparison;
    expect(
      compareAdvances(
        {
          company_id: fixture.ledger.company_id,
          currency: "EUR",
          as_of: fixture.ledger.as_of,
          horizon_end: fixture.ledger.horizon_end,
          observed_months: fixture.ledger.observed_months,
          opening_minor: fixture.ledger.opening_minor,
          floor_minor: fixture.ledger.floor_minor,
          opening_basis: "BANK_AVAILABLE_VERIFIED",
        },
        fixture.revenue_minor,
        fixture.grid_bps,
        fixture.advance_date,
        fixture.final_date,
        fixture.costs,
      ),
    ).toEqual(fixture.output);
  });

  it("breaches the floor without an advance while forty percent keeps it", () => {
    const withoutAdvance = evaluate(ledger(), order("none", 0));
    const withAdvance = evaluate(ledger(), order("forty"));
    expect(withoutAdvance).toMatchObject({
      status: "INCOMPATIBLE",
      min_cash_minor: -2_000_000,
      closing_minor: 8_000_000,
    });
    expect(withAdvance).toMatchObject({
      status: "COMPATIBLE_UNDER_ASSUMPTIONS",
      min_cash_minor: 2_000_000,
      closing_minor: 8_000_000,
    });
  });

  it("reports the minimum feasible point in the tested grid rather than a global optimum", () => {
    const comparison = compareAdvances(
      ledger(),
      10_000_000,
      [6000, 0, 4000, 2000, 4000],
      "2026-09-02",
      "2026-10-30",
      [flow("cost", "2026-09-10", -6_000_000)],
    );
    expect(comparison.search_kind).toBe("ENUMERATED_GRID");
    expect(comparison.minimum_tested_feasible_bps).toBe(4000);
    expect(comparison.alternatives.map((item) => item.advance_bps)).toEqual([
      0, 2000, 4000, 6000,
    ]);
  });

  it("finds two individually compatible orders incompatible together", () => {
    expect(evaluate(ledger(), order("A")).status).toBe(
      "COMPATIBLE_UNDER_ASSUMPTIONS",
    );
    expect(evaluate(ledger(), order("B")).status).toBe(
      "COMPATIBLE_UNDER_ASSUMPTIONS",
    );
    expect(evaluate(ledger(), [...order("A"), ...order("B")])).toMatchObject({
      status: "INCOMPATIBLE",
      min_cash_minor: 0,
    });
  });

  it("detects an intra-month deficit hidden by month-end cash", () => {
    expect(
      evaluate(ledger(), [
        flow("expense", "2026-09-05", -3_000_000),
        flow("collection", "2026-09-25", 3_000_000),
      ]),
    ).toMatchObject({
      status: "INCOMPATIBLE",
      min_cash_minor: 1_000_000,
      closing_minor: 4_000_000,
    });
  });

  it("applies same-day debits before credits", () => {
    const result = evaluate(ledger(), [
      flow("collection", "2026-09-10", 6_000_000),
      flow("cost", "2026-09-10", -6_000_000),
    ]);
    expect(result).toMatchObject({
      status: "INCOMPATIBLE",
      min_cash_minor: -2_000_000,
      closing_minor: 4_000_000,
      first_breach: {
        date: "2026-09-10",
        phase: "DEBITS",
        cash_minor: -2_000_000,
      },
    });
  });

  it("abstains for absent or unknown opening cash and evaluates user assumptions", () => {
    expect(evaluate(ledger({ opening_minor: null }), order()).status).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
    expect(evaluate(ledger({ opening_basis: "UNKNOWN" }), order()).status).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
    expect(
      evaluate(ledger({ opening_basis: "USER_ASSUMPTION" }), order()).status,
    ).toBe("COMPATIBLE_UNDER_ASSUMPTIONS");
  });

  it("caps the horizon at six months and one third of observed history", () => {
    expect(evaluate(ledger({ observed_months: 3 }), order()).status).toBe(
      "OUTSIDE_HORIZON",
    );
    expect(
      evaluate(ledger({ horizon_end: "2027-03-01", observed_months: 18 }), [])
        .status,
    ).toBe("COMPATIBLE_UNDER_ASSUMPTIONS");
    expect(
      evaluate(ledger({ horizon_end: "2027-03-01", observed_months: 12 }), [])
        .status,
    ).toBe("OUTSIDE_HORIZON");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("reports flows outside the horizon instead of truncating them", () => {
    expect(evaluate(ledger(), [flow("future", "2027-01-01", 1)]).status).toBe(
      "OUTSIDE_HORIZON",
    );
    expect(evaluate(ledger(), [flow("past", "2026-08-31", -1)]).status).toBe(
      "OUTSIDE_HORIZON",
    );
  });

  it("rejects mixed currencies, fractional cents, invalid dates and duplicate ids", () => {
    expect(() =>
      evaluate(ledger(), [flow("usd", "2026-09-02", 1, { currency: "USD" })]),
    ).toThrow();
    expect(() =>
      evaluate(ledger(), [flow("fraction", "2026-09-02", 1.5)]),
    ).toThrow();
    expect(() => evaluate(ledger(), [flow("date", "2026-02-30", 1)])).toThrow();
    const duplicate = flow("same", "2026-09-02", 1);
    expect(() => evaluate(ledger(), [duplicate, duplicate])).toThrow();
  });

  it("changes the verdict when the advance moves or opening cash changes", () => {
    const delayed = order().map((item) =>
      item.id === "A-advance" ? { ...item, date: "2026-09-11" } : item,
    );
    expect(evaluate(ledger(), delayed).status).toBe("INCOMPATIBLE");
    expect(evaluate(ledger({ opening_minor: 3_000_000 }), order()).status).toBe(
      "INCOMPATIBLE",
    );
    expect(evaluate(ledger({ opening_minor: 4_000_000 }), order()).status).toBe(
      "COMPATIBLE_UNDER_ASSUMPTIONS",
    );
  });

  it("is order-invariant and exact for one-cent flows", () => {
    const flows = [
      flow("credit", "2026-09-02", 1),
      flow("debit", "2026-09-03", -1),
    ];
    const result = evaluate(ledger(), flows);
    expect(evaluate(ledger(), [...flows].reverse())).toEqual(result);
    expect(result.closing_minor).toBe(4_000_000);
  });

  it("computes a maximum-safe-integer advance exactly with bigint", () => {
    const revenue = Number.MAX_SAFE_INTEGER;
    const expected = Number((BigInt(revenue) * 9999n + 5000n) / 10_000n);
    const comparison = compareAdvances(
      ledger({ opening_minor: 0, floor_minor: 0 }),
      revenue,
      [9999],
      "2026-09-02",
      "2026-10-30",
      [],
    );
    expect(comparison.alternatives[0]?.advance_minor).toBe(expected);
    expect(comparison.alternatives[0]?.closing_minor).toBe(revenue);
  });
});

function requestCommitment(companyId: string, body: string) {
  return SELF.fetch(`https://agent.test/companies/${companyId}/commitment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /companies/:id/commitment", () => {
  it("returns a labelled simulation under unverified user assumptions", async () => {
    const response = await requestCommitment(
      "COMP_0176",
      JSON.stringify(commitmentRequest),
    );
    expect(response.status).toBe(200);
    const evaluation = commitmentEvaluationSchema.parse(await response.json());
    expect(evaluation).toMatchObject({
      company_id: "COMP_0176",
      readiness: "SIMULATION_ONLY",
      basis: "USER_ASSUMPTION",
      opening_verified: false,
      coverage_verified: false,
      assumptions: commitmentRequest,
      minimum_tested_feasible_bps: 4000,
    });
  });

  it("rejects caller-supplied verification and fractional cents", async () => {
    const verified = await requestCommitment(
      "COMP_0176",
      JSON.stringify({ ...commitmentRequest, opening_verified: true }),
    );
    expect(verified.status).toBe(400);
    expect(await verified.json()).toEqual({
      error: "Solicitud de simulación no válida",
    });
    const fractional = await requestCommitment(
      "COMP_0176",
      JSON.stringify({ ...commitmentRequest, opening_minor: 4_000_000.5 }),
    );
    expect(fractional.status).toBe(400);
  });

  it("distinguishes unknown companies from insufficient history", async () => {
    const unknown = await requestCommitment(
      "COMP_MISSING",
      JSON.stringify(commitmentRequest),
    );
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({
      error: "Unknown company COMP_MISSING",
    });
    const insufficient = await requestCommitment(
      "COMP_SHORT",
      JSON.stringify(commitmentRequest),
    );
    expect(insufficient.status).toBe(400);
    expect(await insufficient.json()).toEqual({
      error: "Histórico insuficiente para proyectar",
    });
  });
});
