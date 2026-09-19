import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
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

function toolCall(name: string, input: { company_id: string }) {
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
    expect(system).toContain('"state_label":"cayendo"');
    expect(system).toContain("Reclamar las 2 facturas vencidas");
  });

  it("runs the tool the model asks for against D1 and feeds the result back", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("score", { company_id: "COMP_B" }),
        textReply("COMP_B está sana con 91 puntos."),
      ],
    });
    const response = await ask(model, {});
    expect(await response.text()).toContain("COMP_B está sana");
    const parts =
      model.doStreamCalls[1]?.prompt
        .filter((message) => message.role === "tool")
        .flatMap((message) => message.content) ?? [];
    const toolResult = parts.find((part) => part.type === "tool-result");
    const output =
      toolResult?.type === "tool-result"
        ? JSON.stringify(toolResult.output)
        : "";
    expect(toolResult?.type === "tool-result" && toolResult.toolName).toBe(
      "score",
    );
    expect(output).toContain('"score":91');
    expect(output).toContain('"state":"healthy"');
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
