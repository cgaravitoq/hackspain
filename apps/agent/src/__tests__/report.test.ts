import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { reportSchema } from "@hackspain/shared";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../app.ts";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));
beforeEach(() => env.DB.prepare("DELETE FROM reports").run());

const narrative = {
  summary: "Revisar los hechos observados con las personas autorizadas.",
  sections: [
    { code: "resumen", title: "Situación" },
    { code: "por_que", title: "Qué cambió" },
    { code: "por_que", title: "Qué mueve el índice" },
    { code: "que_hacer", title: "Qué revisar" },
    { code: "grupo", title: "Mi grupo" },
    { code: "datos_y_limites", title: "Calidad del análisis" },
    { code: "que_hacer", title: "Acciones posibles" },
  ].map((section) => ({
    ...section,
    body: "Contrastar los datos disponibles antes de actuar.",
  })),
};

function reply(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  };
}

const pdfRequest = z.strictObject({
  html: z.string(),
  pdfOptions: z.object({
    format: z.literal("a4"),
    printBackground: z.literal(true),
    displayHeaderFooter: z.literal(true),
    headerTemplate: z.string(),
    footerTemplate: z.string(),
    margin: z.object({
      top: z.string(),
      bottom: z.string(),
      left: z.string(),
      right: z.string(),
    }),
  }),
  rejectRequestPattern: z.array(z.string()),
});

const pdfBytes = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

describe("GET /companies/:id/report.pdf", () => {
  it("renders the role sections and disclaimer once and caches PDF bytes in D1", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      const request = pdfRequest.parse(input);
      expect(request.html).toContain("Indicadores históricos de tesorería");
      expect(request.html).toContain(
        "No constituye una calificación crediticia, una certificación de solvencia",
      );
      expect(request.html).toContain(
        "El índice mensual, de 0 a 100, combina nivel y momentum acotado.",
      );
      for (const section of narrative.sections) {
        expect(request.html).toContain(section.title);
      }
      expect(request.html).toContain("debt_repayment_break");
      expect(request.html).toContain("No disponible");
      expect(request.html).toContain("12000");
      expect(request.pdfOptions.headerTemplate).toContain("COMP_A");
      expect(request.pdfOptions.footerTemplate).toContain('class="pageNumber"');
      expect(request.pdfOptions.footerTemplate).toContain('class="totalPages"');
      expect(request.rejectRequestPattern).toEqual([".*"]);
      return Promise.resolve(
        new Response(pdfBytes, {
          headers: { "content-type": "application/pdf" },
        }),
      );
    });
    const app = createApp({ model: () => model, browser: { quickAction } });
    for (let request = 0; request < 2; request++) {
      const response = await app.request(
        "/companies/COMP_A/report.pdf?role=tesorero",
        undefined,
        env,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toContain("COMP_A");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdfBytes);
    }
    expect(quickAction).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(1);
    const cached = await env.DB.prepare(
      "SELECT length(pdf) AS size FROM reports WHERE company_id = ? AND role = ?",
    )
      .bind("COMP_A", "tesorero")
      .first<{ size: number }>();
    expect(cached?.size).toBe(pdfBytes.byteLength);
  });
});

function stream(parts: LanguageModelV4StreamPart[]) {
  return {
    stream: simulateReadableStream<LanguageModelV4StreamPart>({
      chunks: [{ type: "stream-start", warnings: [] }, ...parts],
    }),
  };
}

describe("report tools", () => {
  it("streams a report tool result with a same-origin download link", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
      doStream: [
        stream([
          {
            type: "tool-call",
            toolCallId: "report-call",
            toolName: "report",
            input: JSON.stringify({ company: "COMP_A", role: "tesorero" }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: reply("").usage,
          },
        ]),
        stream([
          { type: "text-start", id: "t" },
          {
            type: "text-delta",
            id: "t",
            delta: "Informe listo para descargar.",
          },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: reply("").usage,
          },
        ]),
      ],
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      pdfRequest.parse(input);
      return Promise.resolve(
        new Response(pdfBytes, {
          headers: { "content-type": "application/pdf" },
        }),
      );
    });
    const response = await createApp({
      model: () => model,
      browser: { quickAction },
    }).request(
      "/chat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_id: "COMP_A",
          role: "tesorero",
          messages: [
            {
              id: "m1",
              role: "user",
              parts: [{ type: "text", text: "Exporta el informe." }],
            },
          ],
        }),
      },
      env,
    );
    const text = await response.text();
    expect(text).toContain('"type":"tool-output-available"');
    expect(text).toContain('"toolName":"report"');
    expect(text).toContain("/api/companies/COMP_A/report.pdf?role=tesorero");
    expect(quickAction).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doStreamCalls).toHaveLength(2);
    const result = model.doStreamCalls[1]?.prompt
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content)
      .find((part) => part.type === "tool-result");
    expect(result?.toolName).toBe("report");
    const output = z
      .object({
        type: z.literal("json"),
        value: z.strictObject({
          url: z.string(),
          filename: z.string(),
          sizeBytes: z.number(),
        }),
      })
      .parse(result?.output);
    expect(output.value).toEqual({
      url: "/api/companies/COMP_A/report.pdf?role=tesorero",
      filename: "xray-COMP_A-2026-08-tesorero.pdf",
      sizeBytes: pdfBytes.byteLength,
    });
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(
      "Rol seleccionado: tesorero",
    );
  });

  it("exports a named company through MCP as a text URL and structured metadata", async () => {
    await env.DB.prepare(
      "INSERT INTO companies SELECT 'COMP_0176', group_id, scorable, month, score, state, json_set(summary, '$.company_id', 'COMP_0176'), json_set(detail, '$.company_id', 'COMP_0176') FROM companies WHERE company_id = 'COMP_A'",
    ).run();
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      expect(pdfRequest.parse(input).html).toContain("Talleres Ribera");
      return Promise.resolve(
        new Response(pdfBytes, {
          headers: { "content-type": "application/pdf" },
        }),
      );
    });
    const app = createApp({ model: () => model, browser: { quickAction } });
    for (const company of ["Talleres Ribera", "COMP_0176"]) {
      const response = await app.request(
        "https://agent.test/mcp",
        {
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
              name: "report",
              arguments: { company, role: "tesorero" },
            },
          }),
        },
        env,
      );
      expect(response.status).toBe(200);
      const result = z
        .object({
          result: z.object({
            content: z.array(
              z.object({ type: z.literal("text"), text: z.string() }),
            ),
            structuredContent: z.strictObject({
              url: z.url(),
              filename: z.string(),
              mimeType: z.literal("application/pdf"),
              sizeBytes: z.number(),
              generatedAt: z.iso.datetime(),
            }),
          }),
        })
        .parse(await response.json()).result;
      expect(result.structuredContent).toMatchObject({
        url: "https://agent.test/companies/COMP_0176/report.pdf?role=tesorero",
        filename: "xray-COMP_0176-2026-08-tesorero.pdf",
        sizeBytes: pdfBytes.byteLength,
      });
      expect(result.content).toEqual([
        {
          type: "text",
          text: `Informe listo (PDF, ${pdfBytes.byteLength} bytes): ${result.structuredContent.url}`,
        },
      ]);
      const downloaded = await app.request(
        result.structuredContent.url,
        undefined,
        env,
      );
      expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(pdfBytes);
    }
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(quickAction).toHaveBeenCalledTimes(1);
  });
});

describe("GET /companies/:id/report", () => {
  it("grounds the role sections and figures in D1 and reuses the stored report", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const app = createApp({ model: () => model });
    const response = await app.request(
      "/companies/COMP_A/report?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report.sections.map((section) => section.title)).toEqual(
      narrative.sections.map((section) => section.title),
    );
    expect(report.sections[0]?.figures).toContainEqual({
      label: "score · 2026-08 · explain",
      value: 12.3,
      unit: "points",
    });
    expect(report.sections[1]?.figures).toContainEqual({
      label: "delta · 2026-07 → 2026-08 · what_changed",
      value: -27.9,
      unit: "points",
    });
    expect(report.sections[4]?.figures).toContainEqual({
      label: "n_companies · 2026-08 · group_map",
      value: 2,
      unit: "companies",
    });
    expect(report.sections.some((section) => section.code === "decision")).toBe(
      false,
    );
    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("tesorero");
    for (const section of narrative.sections) {
      expect(prompt).toContain(section.title);
    }
    expect(prompt).toContain("12.3");
    expect(prompt).toContain("-27.9");
    const repeated = await app.request(
      "/companies/COMP_A/report?role=tesorero",
      undefined,
      env,
    );
    expect(await repeated.json()).toEqual(report);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
