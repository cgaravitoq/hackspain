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
import {
  type ReportTool,
  reportDescription,
  reportInput,
} from "./report-tool.ts";
import type { Store } from "./store.ts";
import {
  createTools,
  type Tools,
  toolDescriptions,
  toolInputs,
} from "./tools.ts";

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
  tools: Tools,
  companyId: string | undefined,
): Promise<string> {
  if (!companyId) {
    return "No hay empresa en pantalla. Usa las herramientas para consultar cifras.";
  }
  const explanation = await tools.explain({ company_id: companyId });
  if ("error" in explanation) {
    return `Empresa en pantalla: ${companyId}. ${explanation.error}`;
  }
  const drivers = explanation.drivers
    .slice(0, 3)
    .map((driver) => driver.text)
    .join(" ");
  return [
    `Empresa en pantalla: ${companyId}.`,
    `${explanation.state_label}, score ${explanation.score} en ${explanation.month}. ${drivers}`,
    `Acción: ${explanation.action}`,
  ].join("\n");
}

export async function chat(
  model: LanguageModel,
  store: Store,
  request: ChatRequest,
  report: ReportTool,
): Promise<Response> {
  const tools = createTools(store);
  const messages = await validateUIMessages({ messages: request.messages });
  const result = streamText({
    model,
    system: `${SYSTEM}\n\nRol seleccionado: ${request.role ?? "tesorero"}. Para exportar un informe llama a report con company y este rol; devuelve el enlace de la herramienta sin inventarlo. Nunca presentes el informe como solvencia, crédito, previsión o prueba de causas.\n\n${await context(tools, request.company_id)}`,
    messages: await convertToModelMessages(messages),
    tools: {
      report: tool({
        description: reportDescription,
        inputSchema: reportInput,
        execute: async (input) => {
          const { url, filename, sizeBytes } = await report(input);
          return { url, filename, sizeBytes };
        },
      }),
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
