import {
  type CashEvent,
  type CashLedger,
  cashEventSchema,
  cashLedgerSchema,
  cashOutcomeSchema,
  commitmentOpportunitySchema,
} from "@hackspain/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  compareAdvances,
  evaluateCash,
  previewCash,
} from "../xray/cash-engine.ts";
import goldenJson from "./fixtures/commitment-goldens.json";

const ledger: CashLedger = {
  company_id: "DEMO",
  currency: "EUR",
  as_of: "2026-09-01",
  horizon_end: "2026-11-01",
  observed_months: 24,
  opening_minor: 4_000_000,
  floor_minor: 2_000_000,
  opening_verified: true,
  coverage_verified: true,
};
const event = (id: string, date: string, amount: number): CashEvent => ({
  id,
  date,
  amount_minor: amount,
  company_id: "DEMO",
  currency: "EUR",
});
const opportunity = commitmentOpportunitySchema.parse({
  title: "New order",
  revenue_minor: 10_000_000,
  advance_date: "2026-09-02",
  final_payment_date: "2026-10-30",
  permitted_advance_bps: [0, 2000, 4000, 6000],
  costs: [{ id: "materials", date: "2026-09-10", amount_minor: 6_000_000 }],
});

const goldens = z
  .object({
    cases: z.array(
      z.object({
        ledger: cashLedgerSchema,
        events: z.array(cashEventSchema),
        expected: cashOutcomeSchema,
      }),
    ),
  })
  .parse(goldenJson);

describe("cash scenarios", () => {
  it.each(goldens.cases)(
    "matches the Python oracle for a generated cash path %#",
    (input) => {
      expect(evaluateCash(input)).toEqual(input.expected);
    },
  );

  it("finds the least tested advance without creating money", () => {
    const result = compareAdvances({ ledger, events: [] }, opportunity);
    expect(result.minimum_tested_feasible_bps).toBe(4000);
    expect(result.alternatives.map((item) => item.cash.min_cash_minor)).toEqual(
      [-2_000_000, 0, 2_000_000, 4_000_000],
    );
    expect(
      result.alternatives.every(
        (item) => item.cash.closing_minor === 8_000_000,
      ),
    ).toBe(true);
  });

  it("catches an intramonth shortfall even when the closing cash is unchanged", () => {
    const result = evaluateCash({
      ledger,
      events: [
        event("out", "2026-09-05", -3_000_000),
        event("in", "2026-09-25", 3_000_000),
      ],
    });
    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.min_cash_minor).toBe(1_000_000);
    expect(result.closing_minor).toBe(4_000_000);
  });

  it("processes debits before credits when only a calendar date is known", () => {
    const result = evaluateCash({
      ledger,
      events: [
        event("in", "2026-09-10", 6_000_000),
        event("out", "2026-09-10", -6_000_000),
      ],
    });
    expect(result.min_cash_minor).toBe(-2_000_000);
    expect(result.first_breach?.phase).toBe("DEBITS");
  });

  it("keeps unverified cash separate from a labelled arithmetic preview", () => {
    const input = {
      ledger: { ...ledger, opening_verified: false, coverage_verified: false },
      events: [],
    };
    expect(evaluateCash(input).status).toBe("INSUFFICIENT_EVIDENCE");
    expect(previewCash(input).closing_minor).toBe(4_000_000);
    expect(previewCash(input).is_financial_authorization).toBe(false);
    expect(input.ledger.opening_verified).toBe(false);
    expect(
      previewCash({
        ledger: { ...input.ledger, opening_minor: null },
        events: [],
      }).status,
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("refuses horizons beyond six months or one third of usable history", () => {
    expect(
      evaluateCash({ ledger: { ...ledger, observed_months: 3 }, events: [] })
        .status,
    ).toBe("OUTSIDE_HORIZON");
    expect(
      evaluateCash({
        ledger: { ...ledger, horizon_end: "2027-04-01" },
        events: [],
      }).status,
    ).toBe("OUTSIDE_HORIZON");
    expect(
      evaluateCash({ ledger, events: [event("late", "2027-01-01", 100)] })
        .status,
    ).toBe("OUTSIDE_HORIZON");
  });

  it("does not let two individually compatible orders spend the same cash", () => {
    const one = [
      event("a-in", "2026-09-02", 4_000_000),
      event("a-out", "2026-09-10", -6_000_000),
    ];
    const two = [
      event("b-in", "2026-09-02", 4_000_000),
      event("b-out", "2026-09-10", -6_000_000),
    ];
    expect(evaluateCash({ ledger, events: one }).status).toBe(
      "COMPATIBLE_UNDER_ASSUMPTIONS",
    );
    expect(evaluateCash({ ledger, events: [...one, ...two] }).status).toBe(
      "INCOMPATIBLE",
    );
  });

  it("rejects duplicate identities and never silently overflows monetary sums", () => {
    const payment = event("same", "2026-09-02", 1);
    expect(() =>
      evaluateCash({ ledger, events: [payment, payment] }),
    ).toThrow();
    expect(() =>
      evaluateCash({
        ledger: { ...ledger, opening_minor: Number.MAX_SAFE_INTEGER },
        events: [payment],
      }),
    ).toThrow();
  });

  it("rounds percentages with exact intermediate arithmetic and a balancing remainder", () => {
    const result = compareAdvances(
      { ledger, events: [] },
      {
        ...opportunity,
        revenue_minor: 9_007_199_254_740_000,
        permitted_advance_bps: [3333],
        costs: [
          {
            id: "cost",
            date: "2026-09-10",
            amount_minor: 9_007_199_254_740_000,
          },
        ],
      },
    );
    expect(result.alternatives[0]?.advance_minor).toBe(3_002_099_511_604_842);
    expect(result.alternatives[0]?.cash.closing_minor).toBe(4_000_000);
  });
});
