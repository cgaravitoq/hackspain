import { describe, expect, it } from "vitest";
import {
  cashScenarioInputSchema,
  commitmentOpportunitySchema,
  commitmentRequestSchema,
  euroToMinor,
  treasurySnapshotSchema,
} from "./index.ts";

const opportunity = {
  title: "New order",
  revenue_minor: 10_000_000,
  advance_date: "2026-09-02",
  final_payment_date: "2026-10-30",
  permitted_advance_bps: [0, 2000, 4000, 6000],
  costs: [{ id: "materials", date: "2026-09-10", amount_minor: 6_000_000 }],
};

const ledger = {
  company_id: "COMP_A",
  currency: "EUR",
  as_of: "2026-09-01",
  horizon_end: "2026-11-01",
  observed_months: 24,
  opening_minor: 4_000_000,
  floor_minor: 2_000_000,
  opening_verified: true,
  coverage_verified: true,
};

const cashEvent = {
  id: "payment",
  company_id: "COMP_A",
  currency: "EUR",
  date: "2026-09-10",
  amount_minor: -6_000_000,
};

describe("commitment contracts", () => {
  it("accepts a dated opportunity without trusting client balances", () => {
    expect(
      commitmentRequestSchema.parse({
        opportunity,
        horizon_months: 2,
        reserve_floor_minor: 2_000_000,
      }),
    ).toEqual({
      opportunity,
      horizon_months: 2,
      reserve_floor_minor: 2_000_000,
    });
  });

  it("rejects availability assertions and balances on the public request", () => {
    for (const forbidden of [
      { opening_verified: true },
      { opening_minor: 90_000_000 },
      { ledger },
      { company_id: "OTHER" },
    ]) {
      expect(
        commitmentRequestSchema.safeParse({
          opportunity,
          horizon_months: 2,
          reserve_floor_minor: 0,
          ...forbidden,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects ambiguous dates, fractional cents and duplicate costs", () => {
    for (const invalid of [
      { ...opportunity, advance_date: "2026-02-30" },
      { ...opportunity, revenue_minor: 1.5 },
      { ...opportunity, revenue_minor: 0 },
      { ...opportunity, permitted_advance_bps: [4000, 4000] },
      { ...opportunity, permitted_advance_bps: [10001] },
      { ...opportunity, costs: [...opportunity.costs, ...opportunity.costs] },
      { ...opportunity, final_payment_date: "2026-08-01" },
    ]) {
      expect(commitmentOpportunitySchema.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  it("checks internal ledger consistency, company boundaries and event dates", () => {
    expect(
      cashScenarioInputSchema.safeParse({ ledger, events: [cashEvent] })
        .success,
    ).toBe(true);
    for (const invalid of [
      { ledger: { ...ledger, opening_minor: null }, events: [] },
      { ledger, events: [{ ...cashEvent, company_id: "OTHER" }] },
      { ledger, events: [{ ...cashEvent, currency: "USD" }] },
      { ledger, events: [cashEvent, cashEvent] },
      { ledger, events: [{ ...cashEvent, date: ledger.as_of }] },
      { ledger, events: [{ ...cashEvent, date: "2027-01-01" }] },
    ]) {
      expect(cashScenarioInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("preserves absent availability instead of substituting the ledger balance", () => {
    const snapshot = treasurySnapshotSchema.parse({
      as_of: "2026-09-01",
      currency: "EUR",
      ledger_minor: 4_000_000,
      available_minor: null,
      account_ids: ["P1"],
      accounts_expected: 1,
      accounts_observed: 1,
      source: "balances.csv",
      availability_verified: false,
      limitations: ["Available is missing"],
    });
    expect(snapshot.available_minor).toBeNull();
    expect(snapshot.availability_verified).toBe(false);
    expect(
      treasurySnapshotSchema.safeParse({
        ...snapshot,
        availability_verified: true,
      }).success,
    ).toBe(false);
  });

  it("parses decimal euros exactly and rejects ambiguous formats and overflow", () => {
    expect(euroToMinor("40000,01")).toBe(4_000_001);
    expect(euroToMinor("0.10")).toBe(10);
    expect(euroToMinor("0")).toBe(0);
    for (const invalid of [
      "40.000",
      "1e3",
      "-10",
      "1.001",
      "NaN",
      "90071992547410.00",
    ]) {
      expect(() => euroToMinor(invalid)).toThrow();
    }
  });
});
