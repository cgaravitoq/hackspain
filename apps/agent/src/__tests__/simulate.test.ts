import { env, SELF } from "cloudflare:test";
import {
  type Simulate,
  type SimulateScenario,
  simulateSchema,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

function route(query: string) {
  return SELF.fetch(`https://agent.test/companies/${query}`);
}

async function simulation(query: string): Promise<Simulate> {
  const response = await route(query);
  expect(response.status).toBe(200);
  return simulateSchema.parse(await response.json());
}

function single(body: Simulate): SimulateScenario {
  const [scenario] = body.scenarios;
  if (!scenario) {
    throw new Error("the payload carries no scenario");
  }
  return scenario;
}

async function error(response: Response): Promise<{ error: string }> {
  return z.object({ error: z.string() }).parse(await response.json());
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

function tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

describe("GET /companies/:id/simulate", () => {
  it("carries the loaded treasury into the baseline cash path it projects", async () => {
    const body = await simulation("COMP_B/simulate");
    expect(body.company_id).toBe("COMP_B");
    expect(body.label).toBe("escenario");
    expect(body.horizon).toBe(6);
    expect(body.inputs).toEqual({
      starting_cash: 150_000,
      pending_receivables: 33_333.33,
      credit_line_limit: 73_333.33,
      credit_line_drawn: 40_000,
      net_flow_monthly: -60_000,
    });
    expect(body.baseline).toEqual({
      cash: [150_000, 90_000, 30_000, -30_000, -90_000, -150_000, -210_000],
      final_cash: -210_000,
      minimum_cash: -210_000,
      minimum_cash_month: 6,
      score: 28.6,
    });
    expect(body.scenarios).toEqual([]);
  });

  it("projects every month from the published monthly net flow to the cent", async () => {
    const body = await simulation("COMP_H/simulate?draw=12000&apr=0.06");
    const net = body.inputs.net_flow_monthly;
    const steps = (cash: number[]) =>
      cash.slice(1).map((value, month) => cents(value - (cash[month] ?? 0)));
    expect(net).toBe(cents((-60_000 - 59_999 - 59_999) / 3));
    expect(net).toBe(-59_999.33);
    expect(body.baseline.cash).toEqual([
      150_000, 90_000.67, 30_001.34, -29_997.99, -89_997.32, -149_996.65,
      -209_995.98,
    ]);
    expect(steps(body.baseline.cash)).toEqual(Array(6).fill(net));
    const draw = single(body);
    const interest = cents((12_000 * 0.06) / 12);
    expect(steps(draw.cash)).toEqual([
      cents(net + 12_000 - interest),
      ...Array(5).fill(cents(net - interest)),
    ]);
  });

  it("resolves a demo company name and projects only the requested horizon", async () => {
    const named = await simulation("Bodegas%20Altamira/simulate?horizon=2");
    expect(named.company_id).toBe("COMP_0077");
    expect(named.horizon).toBe(2);
    expect(named.baseline.cash).toEqual([150_000, 90_000, 30_000]);
    expect(named.baseline.minimum_cash_month).toBe(2);
  });

  it("caps an advance at the pending receivables and charges its fee once", async () => {
    const body = await simulation("COMP_B/simulate?advance=50000&fee=0.02");
    const advance = single(body);
    expect(advance.kind).toBe("receivable_advance");
    expect(advance.requested).toBe(50_000);
    expect(advance.applied).toBe(33_333.33);
    expect(advance.capped).toBe(true);
    expect(advance.cost).toBe(666.67);
    expect(advance.cash).toEqual([
      150_000, 122_666.66, 62_666.66, 2_666.66, -57_333.34, -117_333.34,
      -177_333.34,
    ]);
    expect(advance.final_cash).toBe(-177_333.34);
    expect(advance.minimum_cash).toBe(-177_333.34);
    expect(advance.minimum_cash_month).toBe(6);
    expect(advance.debt_outstanding_after).toBe(40_000);
  });

  it("advances the whole request when it fits under the pending receivables", async () => {
    const advance = single(
      await simulation("COMP_B/simulate?advance=10000&fee=0.02"),
    );
    expect(advance.applied).toBe(10_000);
    expect(advance.capped).toBe(false);
    expect(advance.cost).toBe(200);
  });

  it("caps a draw at the undrawn credit line and subtracts its interest every month", async () => {
    const body = await simulation("COMP_B/simulate?draw=50000&apr=0.07");
    const draw = single(body);
    expect(draw.kind).toBe("credit_line_draw");
    expect(draw.requested).toBe(50_000);
    expect(draw.applied).toBe(33_333.33);
    expect(draw.capped).toBe(true);
    expect(draw.cost).toBe(1_166.64);
    expect(draw.cash).toEqual([
      150_000, 123_138.89, 62_944.45, 2_750.01, -57_444.43, -117_638.87,
      -177_833.31,
    ]);
    expect(draw.final_cash).toBe(-177_833.31);
    expect(draw.minimum_cash).toBe(-177_833.31);
    expect(draw.minimum_cash_month).toBe(6);
    expect(draw.debt_outstanding_after).toBe(73_333.33);
  });

  it("re-scores the draw with its interest inside both the fees and the outflow of every projected month", async () => {
    const body = await simulation("COMP_B/simulate?draw=50000&apr=0.07");
    const draw = single(body);
    const interest = cents((33_333.33 * 0.07) / 12);
    const windowInflow = 3 * 40_000;
    const windowOutflow = 3 * (100_000 + interest);
    const windowFees = 3 * interest;
    const drawnLevel =
      (100 * windowInflow) / (windowInflow + windowOutflow) -
      (100 * windowFees) / windowOutflow;
    const baselineLevel = (100 * windowInflow) / (windowInflow + 300_000);
    expect(interest).toBe(194.44);
    expect(body.baseline.score).toBe(tenths(baselineLevel));
    expect(draw.score).toBe(tenths(drawnLevel));
    expect(draw.score_delta).toBe(
      tenths(tenths(drawnLevel) - tenths(baselineLevel)),
    );
    expect(draw.score_delta).toBe(-0.3);
  });

  it("scores the projected months of the scenario against the baseline", async () => {
    const body = await simulation(
      "COMP_B/simulate?advance=30000&fee=0.02&horizon=3",
    );
    expect(body.baseline.score).toBe(28.6);
    const advance = single(body);
    expect(advance.score).toBe(34.2);
    expect(advance.score_delta).toBe(5.6);
  });

  it("labels the decision figures in the order the report section reads", async () => {
    const body = await simulation(
      "COMP_B/simulate?advance=30000&fee=0.02&horizon=3",
    );
    const advance = single(body);
    const cost = 30_000 * 0.02;
    const monthOne = 150_000 - 60_000 + 30_000 - cost;
    const monthThree = monthOne - 2 * 60_000;
    expect(advance.decision_figures).toEqual([
      { label: "Caja mínima", value: monthThree, unit: "EUR" },
      { label: "Caja final", value: monthThree, unit: "EUR" },
      { label: "Coste", value: cost, unit: "EUR" },
      { label: "Delta score", value: 5.6, unit: "pts" },
    ]);
    expect(monthThree).toBe(-600);
  });

  it("rejects a horizon above the six months the projection covers", async () => {
    const response = await route("COMP_B/simulate?horizon=7");
    expect(response.status).toBe(400);
    expect(await error(response)).toEqual({
      error: "Too big: expected number to be <=6",
    });
  });

  it("rejects a negative amount", async () => {
    const response = await route("COMP_B/simulate?advance=-1");
    expect(response.status).toBe(400);
    expect(await error(response)).toEqual({
      error: "Too small: expected number to be >=0",
    });
  });

  it("answers 404 for a company that is not in the dataset", async () => {
    const response = await route("COMP_NOPE/simulate");
    expect(response.status).toBe(404);
    expect(await error(response)).toEqual({ error: "Unknown company" });
  });

  it("answers 404 when the company has fewer than three observed months", async () => {
    const response = await route("COMP_G/simulate");
    expect(response.status).toBe(404);
    expect(await error(response)).toEqual({ error: "No months observed" });
  });
});

describe("POST /mcp simulate", () => {
  it("answers the tool with the same scenario the route returns", async () => {
    const routed = await simulation("COMP_B/simulate?advance=50000&fee=0.02");
    const response = await SELF.fetch("https://agent.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "simulate",
          arguments: { company: "COMP_B", advance: 50_000, fee: 0.02 },
        },
      }),
    });
    expect(response.status).toBe(200);
    const called = z
      .object({
        result: z.object({
          content: z.array(
            z.object({ type: z.literal("text"), text: z.string() }),
          ),
        }),
      })
      .parse(await response.json());
    expect(
      simulateSchema.parse(JSON.parse(called.result.content[0]?.text ?? "")),
    ).toEqual(routed);
  });
});
