import type { ChatRequest } from "@hackspain/shared";
import {
  convertToModelMessages,
  type LanguageModel,
  stepCountIs,
  streamText,
  tool,
  validateUIMessages,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Store } from "./store.ts";
import { createTools, toolDescriptions, toolInputs } from "./tools.ts";

export const CHAT_MODEL = "@cf/deepseek-ai/deepseek-v4-flash-0731";

export function workersAiModel(binding: Ai): LanguageModel {
  return createWorkersAI({ binding })(CHAT_MODEL);
}

const SYSTEM = `Eres X Ray, el analista de salud financiera dentro de Embat.
Respondes en español, en tres o cuatro frases como máximo, con las cifras y periodos que devuelven las herramientas.
Nunca inventes números ni empresas: si no tienes el dato, llama a la herramienta o di que no está en los datos.
El score va de 0 a 100 y mide cobros operativos frente a pagos en los últimos tres meses; los estados son sana, mejorando, estable, torciéndose, cayendo y no evaluable.
Cuando una empresa está torciéndose o cayendo, termina con la acción sugerida y el módulo de Embat donde hacerla.`;

async function context(
  tools: ReturnType<typeof createTools>,
  companyId: string | undefined,
): Promise<string> {
  const alerts = await tools.alerts({ limit: 5 });
  const lines = [
    `Alertas del último mes (${alerts.month ?? "sin datos"}): ${alerts.count} mostradas, las peores primero: ${JSON.stringify(alerts.alerts)}`,
  ];
  if (companyId) {
    const explanation = await tools.explain({ company_id: companyId });
    const changed = await tools.what_changed({ company_id: companyId });
    lines.push(
      `Empresa en pantalla: ${companyId}.`,
      `Radiografía: ${JSON.stringify(explanation)}`,
      `Qué cambió: ${JSON.stringify(changed)}`,
    );
  }
  return lines.join("\n");
}

export async function chat(
  model: LanguageModel,
  store: Store,
  request: ChatRequest,
): Promise<Response> {
  const tools = createTools(store);
  const messages = await validateUIMessages({ messages: request.messages });
  const result = streamText({
    model,
    system: `${SYSTEM}\n\n${await context(tools, request.company_id)}`,
    messages: await convertToModelMessages(messages),
    tools: {
      score: tool({
        description: toolDescriptions.score,
        inputSchema: toolInputs.score,
        execute: tools.score,
      }),
      explain: tool({
        description: toolDescriptions.explain,
        inputSchema: toolInputs.explain,
        execute: tools.explain,
      }),
      what_changed: tool({
        description: toolDescriptions.what_changed,
        inputSchema: toolInputs.what_changed,
        execute: tools.what_changed,
      }),
      group_map: tool({
        description: toolDescriptions.group_map,
        inputSchema: toolInputs.group_map,
        execute: tools.group_map,
      }),
      alerts: tool({
        description: toolDescriptions.alerts,
        inputSchema: toolInputs.alerts,
        execute: tools.alerts,
      }),
    },
    stopWhen: stepCountIs(5),
  });
  return result.toUIMessageStreamResponse();
}
