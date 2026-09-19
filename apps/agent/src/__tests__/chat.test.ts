import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import {
  companyRelationsSchema,
  compareSchema,
  type Role,
  relationsArtifactSchema,
} from "@hackspain/shared";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../app.ts";
import { chat } from "../xray/chat.ts";
import type { reportInput } from "../xray/report-tool.ts";
import { createStore } from "../xray/store.ts";
import { seed } from "./fixtures.ts";
import { relationsJson, seedRelations } from "./relations.ts";

beforeAll(async () => {
  await seed(env.DB);
  await seedRelations(
    env.DB,
    relationsArtifactSchema.parse(JSON.parse(JSON.stringify(relationsJson))),
  );
});

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
  input: {
    company?: string;
    company_id?: string;
    company_ids?: string[];
    role?: Role;
  },
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

function ask(
  model: MockLanguageModelV4,
  body: { company_id?: string; role?: Role },
) {
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

function toolCallSentToModel(model: MockLanguageModelV4) {
  const calls: { toolName: string; input: unknown }[] = [];
  for (const message of model.doStreamCalls[1]?.prompt ?? []) {
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-call") {
        calls.push({ toolName: part.toolName, input: part.input });
      }
    }
  }
  return calls;
}

const RELATIONS_PREAMBLE =
  "Establece únicamente relaciones respaldadas por los registros recibidos.";

const RELATION_RULES = [
  "1. Usa los identificadores exactos; no emparejes códigos por semejanza numérica.",
  "2. Separa relaciones observadas, inferidas y similitudes.",
  "3. En movimientos espejo, identifica como pagador candidato al titular de la salida y como receptor candidato al titular de la entrada.",
  "4. No conviertas una contraparte compartida, un grupo común o una correlación en un pago entre empresas.",
  "5. No fusiones `COUNTERPARTY` y `COMP`: propone una equivalencia con sus evidencias y señala contradicciones.",
  "6. No uses `[COMPANY]`, `[ACCOUNT]`, `[REF]` o `[NUM]` como identificadores compartidos.",
  "7. Una fecha de pago en una factura no acredita por sí sola un pago efectivo.",
  "8. No sumes factura, efecto y movimiento bancario como tres obligaciones independientes.",
  "9. No declares una deuda actual usando una operación pagada.",
  "10. No infieras riesgo de impago únicamente por existir una relación.",
  "11. Si falta evidencia, devuelve «relación no determinable».",
  "12. No utilices evidencias posteriores al corte para afirmar que el vínculo se conocía antes.",
];

const RELATION_ANSWER_RULES = [
  "Toda relación que devuelve la herramienta relations está inferida de movimientos espejo (claim_status: inferred) y provider_identity_confirmed es siempre false",
  "Nunca presentes un vínculo inferido como una obligación verificada ni como una deuda actual",
  "solo los vínculos OPEN_OBLIGATION_TO describen un saldo pendiente",
  "Cita cada importe con su divisa, su periodo (first_date a last_date) y su número de coincidencias (matches); nombra como tal un vínculo de confianza low.",
  "si no devuelve ninguna o devuelve un error, di «relación no determinable» en lugar de suponer",
  "llama a relations para la empresa en pantalla y lee counterpart_group_id y scope; no inventes una herramienta de grupo",
];

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

  it("adds the selected financial role guidance to the system prompt", async () => {
    const model = new MockLanguageModelV4({ doStream: [textReply("ok")] });
    const response = await ask(model, { role: "financiero" });
    expect(await response.text()).toContain("ok");
    expect(systemPrompt(model, 0)).toContain(
      "Empieza por la evidencia de la cartera y sus exposiciones",
    );
  });

  it("defaults a report tool call to the selected role", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("report", { company: "Talleres Ribera" }),
        textReply("Informe listo."),
      ],
    });
    const calls: z.infer<typeof reportInput>[] = [];
    const response = await chat(
      model,
      createStore(env.DB),
      {
        role: "ventas",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "Exporta el informe" }],
          },
        ],
      },
      async (input) => {
        calls.push(input);
        return {
          url: "/api/companies/COMP_0176/report.pdf?role=ventas",
          filename: "xray-COMP_0176-2026-08-ventas.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          generatedAt: "2026-09-19T12:00:00.000Z",
        };
      },
    );
    expect(await response.text()).toContain("Informe listo.");
    expect(calls).toEqual([{ company: "Talleres Ribera", role: "ventas" }]);
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
    expect(systemPrompt(model, 0)).toContain(
      "llama a compare en una sola llamada",
    );
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

  it("hands the model a relations tool and feeds every inferred edge back", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("relations", { company_id: "COMP_A" }),
        textReply("COMP_A se relaciona con COMP_B y COMP_D."),
      ],
    });
    const response = await ask(model, { company_id: "COMP_A" });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("COMP_A se relaciona");
    const relations = toolsHandedToModel(model).find(
      (tool) => tool.name === "relations",
    );
    expect(relations?.description).toContain("inferred");
    expect(relations?.description).toContain("not a verified obligation");
    const [call] = toolCallSentToModel(model);
    expect(call?.toolName).toBe("relations");
    expect(call?.input).toEqual({ company_id: "COMP_A" });
    expect(model.doStreamCalls).toHaveLength(2);
    const { toolName, output } = toolResult(model);
    expect(toolName).toBe("relations");
    const parsed = z
      .object({ type: z.literal("json"), value: companyRelationsSchema })
      .parse(JSON.parse(output)).value;
    expect(parsed.company_id).toBe("COMP_A");
    expect(parsed.edges.map((edge) => edge.counterpart_company_id)).toEqual([
      "COMP_B",
      "COMP_D",
    ]);
    expect(parsed.edges[0]?.counterpart_state).toBe("healthy");
    expect(parsed.edges[0]?.counterpart_score).toBe(91);
  });

  it("carries Miguel's twelve evidence rules and the relations answer rules", async () => {
    const model = new MockLanguageModelV4({ doStream: [textReply("ok")] });
    const response = await ask(model, { company_id: "COMP_A" });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("ok");
    expect(RELATION_RULES).toHaveLength(12);
    const system = systemPrompt(model, 0);
    const missing = [
      RELATIONS_PREAMBLE,
      ...RELATION_RULES,
      ...RELATION_ANSWER_RULES,
    ].filter((rule) => !system.includes(rule));
    expect(missing).toEqual([]);
  });

  it("resolves a demo name to its id before reading the relations", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("relations", { company_id: "Talleres Ribera" }),
        textReply("Talleres Ribera no tiene vínculos registrados."),
      ],
    });
    const response = await ask(model, { company_id: "COMP_0176" });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Talleres Ribera");
    expect(toolCallSentToModel(model)[0]?.input).toEqual({
      company_id: "Talleres Ribera",
    });
    const { toolName, output } = toolResult(model);
    expect(toolName).toBe("relations");
    expect(output).toContain('"company_id":"COMP_0176"');
  });

  it("feeds an unknown company back to the model as the relations error", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall("relations", { company_id: "COMP_ZZZ" }),
        textReply("Relación no determinable."),
      ],
    });
    const response = await ask(model, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Relación no determinable");
    const { toolName, output } = toolResult(model);
    expect(toolName).toBe("relations");
    expect(output).toContain('"error":"Unknown company COMP_ZZZ"');
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
