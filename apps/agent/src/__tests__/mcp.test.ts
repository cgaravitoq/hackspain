import { env, SELF } from "cloudflare:test";
import { compareSchema } from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

type Params = {
  name?: string;
  arguments?: { company_id?: string; company_ids?: string[]; kind?: string };
};

function rpc(method: string, params: Params, id = 1) {
  return SELF.fetch("https://agent.test/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

const rpcResult = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number(),
  result: z.object({
    content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  }),
});

const rpcToolError = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.literal(1),
  result: z.object({
    isError: z.literal(true),
    content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  }),
});

async function toolResult(name: string, args: Params["arguments"]) {
  const response = await rpc("tools/call", { name, arguments: args });
  const body = rpcResult.parse(await response.json());
  return JSON.parse(body.result.content[0]?.text ?? "");
}

describe("POST /mcp", () => {
  it("lists the seven X Ray tools with their input schemas", async () => {
    const response = await rpc("tools/list", {});
    expect(response.status).toBe(200);
    const body = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.literal(1),
        result: z.object({
          tools: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
              inputSchema: z.object({}).loose(),
            }),
          ),
        }),
      })
      .parse(await response.json());
    expect(body.result.tools.map((tool) => tool.name)).toEqual([
      "score",
      "explain",
      "what_changed",
      "group_map",
      "compare",
      "alerts",
      "report",
    ]);
    const compare = body.result.tools.find((tool) => tool.name === "compare");
    expect(compare?.description).toContain("Up to three companies");
    expect(compare?.description).toContain("Talleres Ribera");
  });

  it("scores a company addressed by its demo name", async () => {
    const score = await toolResult("score", { company_id: "Talleres Ribera" });
    expect(score).toMatchObject({ company_id: "COMP_0176", score: 74.1 });
  });

  it("explains a company addressed by its demo name", async () => {
    const explanation = await toolResult("explain", {
      company_id: "Talleres Ribera",
    });
    expect(explanation).toMatchObject({
      company_id: "COMP_0176",
      month: "2026-08",
      score: 74.1,
    });
  });

  it("reports what changed for a company addressed by its demo name", async () => {
    const changed = await toolResult("what_changed", {
      company_id: "Talleres Ribera",
    });
    expect(changed).toMatchObject({
      company_id: "COMP_0176",
      month: "2026-08",
      previous_month: "2026-07",
    });
  });

  it("answers a score call with the state and evidence read from D1", async () => {
    const response = await rpc("tools/call", {
      name: "score",
      arguments: { company_id: "COMP_A" },
    });
    const body = rpcResult.parse(await response.json());
    expect(body.id).toBe(1);
    const score = z
      .object({
        score: z.number(),
        state: z.string(),
        state_label: z.string(),
        evidence: z.object({ rule_version: z.string() }),
      })
      .parse(JSON.parse(body.result.content[0]?.text ?? ""));
    expect(score).toMatchObject({
      score: 12.3,
      state: "falling",
      state_label: "cayendo",
      evidence: { rule_version: "xray-score/0.1" },
    });
  });

  it("explains what changed since the previous month and since when", async () => {
    const response = await rpc("tools/call", {
      name: "what_changed",
      arguments: { company_id: "COMP_A" },
    });
    const body = rpcResult.parse(await response.json());
    const changed = JSON.parse(body.result.content[0]?.text ?? "");
    expect(changed).toMatchObject({
      month: "2026-08",
      previous_month: "2026-07",
      delta: -27.9,
      state: "falling",
      previous_state: "slipping",
      state_since: "2026-08",
    });
  });

  it("reports state_since as the first month of the current state, not the last month of the previous one", async () => {
    const response = await rpc("tools/call", {
      name: "what_changed",
      arguments: { company_id: "COMP_D" },
    });
    const body = rpcResult.parse(await response.json());
    const changed = JSON.parse(body.result.content[0]?.text ?? "");
    expect(changed.state).toBe("slipping");
    expect(changed.previous_state).toBe("slipping");
    expect(changed.state_since).toBe("2026-06");
  });

  it("compares up to three companies in request order on their observed months", async () => {
    const response = await rpc("tools/call", {
      name: "compare",
      arguments: { company_ids: ["COMP_0909", "COMP_0176"] },
    });
    const body = rpcResult.parse(await response.json());
    const comparison = compareSchema.parse(
      JSON.parse(body.result.content[0]?.text ?? ""),
    );
    expect(comparison.companies.map((company) => company.company_id)).toEqual([
      "COMP_0909",
      "COMP_0176",
    ]);
    expect(
      comparison.companies[0]?.series.find((entry) => entry.month === "2026-04")
        ?.observed,
    ).toBe(false);
    expect(comparison.months).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("compares companies addressed by their demo names", async () => {
    const response = await rpc("tools/call", {
      name: "compare",
      arguments: { company_ids: ["Talleres Ribera", "COMP_A"] },
    });
    const body = rpcResult.parse(await response.json());
    const comparison = compareSchema.parse(
      JSON.parse(body.result.content[0]?.text ?? ""),
    );
    expect(comparison.companies.map((company) => company.company_id)).toEqual([
      "COMP_0176",
      "COMP_A",
    ]);
  });

  it("rejects a compare call with more than three companies", async () => {
    const response = await rpc("tools/call", {
      name: "compare",
      arguments: { company_ids: ["COMP_A", "COMP_B", "COMP_D", "COMP_0176"] },
    });
    const body = rpcToolError.parse(await response.json());
    expect(body.result.content[0]?.text).toContain(
      "expected array to have <=3 items at company_ids",
    );
  });

  it("rejects a compare call with no companies", async () => {
    const response = await rpc("tools/call", {
      name: "compare",
      arguments: { company_ids: [] },
    });
    const body = rpcToolError.parse(await response.json());
    expect(body.result.content[0]?.text).toContain(
      "expected array to have >=1 items at company_ids",
    );
  });

  it("rejects a tool call whose arguments do not match the schema", async () => {
    const response = await rpc("tools/call", {
      name: "alerts",
      arguments: { kind: "sideways" },
    });
    const body = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.literal(1),
        result: z.object({ isError: z.boolean().optional() }).loose(),
      })
      .or(
        z.object({
          jsonrpc: z.literal("2.0"),
          id: z.literal(1),
          error: z.object({ code: z.number(), message: z.string() }).loose(),
        }),
      )
      .parse(await response.json());
    expect("error" in body || body.result.isError).toBeTruthy();
  });
});
