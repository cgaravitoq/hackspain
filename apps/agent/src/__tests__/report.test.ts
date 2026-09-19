import { env } from "cloudflare:test";
import { reportSchema } from "@hackspain/shared";
import { MockLanguageModelV4 } from "ai/test";
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
