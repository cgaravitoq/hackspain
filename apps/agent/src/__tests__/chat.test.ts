import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { compareSchema } from "@hackspain/shared";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../app.ts";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function stream(parts: LanguageModelV4StreamPart[]) {
  return {
    stream: simulateReadableStream<LanguageModelV4StreamPart>({
      chunks: [{ type: "stream-start", warnings: [] }, ...parts],
    }),
  };
}

function textReply(text: string) {
  return stream([
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage,
    },
  ]);
}

function toolCall(
  name: string,
  input: { company_id?: string; company_ids?: string[] },
) {
  return stream([
    {
      type: "tool-call",
      toolCallId: "call-1",
      toolName: name,
      input: JSON.stringify(input),
    },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage,
    },
  ]);
}

function ask(model: MockLanguageModelV4, body: { company_id?: string }) {
  return createApp({ model: () => model }).request(
    "/chat",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "¿Por qué cae?" }],
          },
        ],
        ...body,
      }),
    },
    env,
  );
}

function systemPrompt(model: MockLanguageModelV4, call: number) {
  const prompt = model.doStreamCalls[call]?.prompt ?? [];
  return prompt
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
}

function toolResult(model: MockLanguageModelV4) {
  const parts =
    model.doStreamCalls[1]?.prompt
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content) ?? [];
  const result = parts.find((part) => part.type === "tool-result");
  return result?.type === "tool-result"
    ? { toolName: result.toolName, output: JSON.stringify(result.output) }
    : { toolName: null, output: "" };
}

function toolsHandedToModel(model: MockLanguageModelV4) {
  return (model.doStreamCalls[0]?.tools ?? []).flatMap((tool) =>
    tool.type === "function" ? [tool] : [],
  );
}

describe("POST /chat", () => {
  it("grounds the model in the radiography of the company on screen", async () => {
    const model = new MockLanguageModelV4({
      doStream: [textReply("Cae porque cobra 40.000 € y paga 100.000 €.")],
    });
    const response = await ask(model, { company_id: "COMP_A" });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Cae porque cobra 40.000 €");
    const system = systemPrompt(model, 0);
    expect(system).toContain("Empresa en pantalla: COMP_A");
    expect(system).toContain("cayendo");
    expect(system).toContain("Reclamar las 2 facturas vencidas");
    expect(system).not.toContain("Radiografía:");
    expect(system).not.toContain("Qué cambió:");
    expect(system).not.toContain('"state_label"');
  });

  it("runs the tool the model asks for against D1 and feeds the result back", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("score", { company_id: "COMP_B" }),
        textReply("COMP_B está sana con 91 puntos."),
      ],
    });
    const response = await ask(model, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("COMP_B está sana");
    expect(model.doStreamCalls).toHaveLength(2);
    const { toolName, output } = toolResult(model);
    expect(toolName).toBe("score");
    expect(output).toContain('"score":91');
    expect(output).toContain('"state":"healthy"');
  });

  it("offers the model a compare tool that names its cap and the demo names", async () => {
    const model = new MockLanguageModelV4({ doStream: [textReply("ok")] });
    const response = await ask(model, {});
    expect(await response.text()).toContain("ok");
    const tools = toolsHandedToModel(model);
    expect(tools.map((tool) => tool.name)).toContain("compare");
    const compare = tools.find((tool) => tool.name === "compare");
    expect(compare?.description).toContain("Up to three companies");
    expect(compare?.description).toContain("Talleres Ribera");
    expect(compare?.inputSchema).toMatchObject({
      type: "object",
      required: ["company_ids"],
      properties: {
        company_ids: { type: "array", minItems: 1, maxItems: 3 },
      },
    });
  });

  it("runs the compare tool the model asks for and feeds both companies back", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("compare", { company_ids: ["COMP_B", "Talleres Ribera"] }),
        textReply("COMP_B va mejor que Talleres Ribera."),
      ],
    });
    const response = await ask(model, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("COMP_B va mejor");
    const { toolName, output } = toolResult(model);
    expect(toolName).toBe("compare");
    const comparison = z
      .object({ type: z.literal("json"), value: compareSchema })
      .parse(JSON.parse(output)).value;
    expect(comparison.companies.map((company) => company.company_id)).toEqual([
      "COMP_B",
      "COMP_0176",
    ]);
  });

  it("rejects a body without messages", async () => {
    const model = new MockLanguageModelV4({ doStream: [textReply("no")] });
    const response = await createApp({ model: () => model }).request(
      "/chat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company_id: "COMP_A" }),
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });
});
