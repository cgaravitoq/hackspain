import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

type Params = {
  name?: string;
  arguments?: { company_id?: string; kind?: string };
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

describe("POST /mcp", () => {
  it("lists the X Ray tools and report export with their input schemas", async () => {
    const response = await rpc("tools/list", {});
    expect(response.status).toBe(200);
    const body = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.literal(1),
        result: z.object({
          tools: z.array(
            z.object({ name: z.string(), inputSchema: z.object({}).loose() }),
          ),
        }),
      })
      .parse(await response.json());
    expect(body.result.tools.map((tool) => tool.name)).toEqual([
      "score",
      "explain",
      "what_changed",
      "group_map",
      "alerts",
      "report",
    ]);
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
