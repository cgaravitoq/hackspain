import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { reportSchema } from "@hackspain/shared";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../app.ts";
import type { Narrative, Verdict } from "../xray/report-judge.ts";
import { company, seed } from "./fixtures.ts";

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
  it("keeps renderer errors out of the cache and provides printable HTML without another model call", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const quickAction = vi.fn(() =>
      Promise.resolve(new Response("quota exhausted", { status: 429 })),
    );
    const app = createApp({ model: () => model, browser: { quickAction } });
    const response = await app.request(
      "/companies/COMP_A/report.pdf?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(502);
    const row = await env.DB.prepare(
      "SELECT pdf FROM reports WHERE company_id = 'COMP_A'",
    ).first<{ pdf: number[] | null }>();
    expect(row?.pdf).toBeNull();
    const fallback = await app.request(
      "/companies/COMP_A/report.html?role=tesorero",
      undefined,
      env,
    );
    expect(fallback.status).toBe(200);
    expect(fallback.headers.get("content-type")).toContain("text/html");
    expect(await fallback.text()).toContain("@media print");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(quickAction).toHaveBeenCalledTimes(1);
  });

  it("escapes model HTML and removes executable links and external images before rendering", async () => {
    const unsafe = {
      ...narrative,
      summary: '<script>alert("unsafe")</script>',
      sections: narrative.sections.map((section) => ({
        ...section,
        title: "<img src=x onerror=alert()>",
        body: '[click](javascript:alert()) ![image](https://untrusted.example/image.png) <iframe src="https://untrusted.example"></iframe>',
      })),
    };
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(unsafe)),
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      const { html } = pdfRequest.parse(input);
      expect(html).not.toMatch(/<script|<img|<iframe|href="javascript:/);
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("default-src 'none'");
      return Promise.resolve(
        new Response(pdfBytes, {
          headers: { "content-type": "application/pdf" },
        }),
      );
    });
    const response = await createApp({
      model: () => model,
      browser: { quickAction },
    }).request("/companies/COMP_A/report.pdf?role=tesorero", undefined, env);
    expect(response.status).toBe(200);
    expect(quickAction).toHaveBeenCalledTimes(1);
  });

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
        value: reportSchema.pick({
          company_id: true,
          role: true,
          export_url: true,
        }),
      })
      .parse(result?.output);
    expect(output.value).toEqual({
      company_id: "COMP_A",
      role: "tesorero",
      export_url: "/api/companies/COMP_A/report.pdf?role=tesorero",
    });
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(
      "Hablas con el tesorero sobre su propia empresa",
    );
  });

  it("exports a named company through MCP as a text URL and structured metadata", async () => {
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
  it("reserves the output budget for narrative rather than model reasoning", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async (options) =>
        options.reasoning === "none"
          ? reply(JSON.stringify(narrative))
          : {
              ...reply(""),
              finishReason: { unified: "length", raw: "length" },
            },
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_A/report?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]?.reasoning).toBe("none");
  });

  it.each([
    {
      role: "financiero",
      titles: [
        "Cartera a revisar",
        "Trayectoria del cliente",
        "Atribución verificable",
        "Hechos pendientes de contraste",
        "Contexto del grupo",
        "Cobertura y reproducibilidad",
        "Seguimiento humano",
      ],
      codes: [
        "resumen",
        "por_que",
        "por_que",
        "que_hacer",
        "grupo",
        "datos_y_limites",
        "que_hacer",
      ],
    },
    {
      role: "ventas",
      titles: [
        "Contexto de conversación",
        "Hechos relevantes",
        "Preguntas de descubrimiento",
        "Alcance del grupo",
        "Capacidades pertinentes",
        "Qué sabemos y qué falta",
      ],
      codes: [
        "resumen",
        "por_que",
        "que_hacer",
        "grupo",
        "que_hacer",
        "datos_y_limites",
      ],
    },
  ])(
    "uses the $role editorial structure without accepting model figures",
    async ({ role, titles, codes }) => {
      const output = {
        summary: narrative.summary,
        sections: titles.map((title, index) => ({
          code: codes[index],
          title,
          body: "Verificar con las personas autorizadas.",
        })),
      };
      const model = new MockLanguageModelV4({
        doGenerate: reply(JSON.stringify(output)),
      });
      const response = await createApp({ model: () => model }).request(
        `/companies/COMP_A/report?role=${role}`,
        undefined,
        env,
      );
      expect(response.status).toBe(200);
      const report = reportSchema.parse(await response.json());
      expect(report.role).toBe(role);
      expect(report.sections.map((section) => section.code)).toEqual(codes);
      const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
      for (const title of titles) {
        expect(prompt).toContain(title);
      }
      expect(prompt).toContain(role);
      expect(
        report.sections.flatMap((section) => section.figures),
      ).toContainEqual({
        label: "balance.value · 2026-08 a 2026-08 · explain.drivers",
        value: 0.4,
        unit: "ratio",
      });
    },
  );

  it.each(["report", "report.pdf", "report.html"])(
    "rejects invalid roles and unknown companies at the %s boundary without remote calls",
    async (route) => {
      const model = new MockLanguageModelV4();
      const quickAction = vi.fn(() => Promise.resolve(new Response(pdfBytes)));
      const app = createApp({ model: () => model, browser: { quickAction } });
      for (const query of ["", "?role=ceo"]) {
        const response = await app.request(
          `/companies/COMP_A/${route}${query}`,
          undefined,
          env,
        );
        expect(response.status).toBe(400);
      }
      const response = await app.request(
        `/companies/MISSING/${route}?role=tesorero`,
        undefined,
        env,
      );
      expect(response.status).toBe(404);
      expect(model.doGenerateCalls).toHaveLength(0);
      expect(quickAction).not.toHaveBeenCalled();
    },
  );

  it("retries invalid model figures once and stores only deterministic figures", async () => {
    const invented = {
      ...narrative,
      sections: narrative.sections.map((section) => ({
        ...section,
        figures: [{ label: "invented", value: 999999, unit: "EUR" }],
      })),
    };
    const model = new MockLanguageModelV4({
      doGenerate: [
        reply(JSON.stringify(invented)),
        reply(JSON.stringify(narrative)),
      ],
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_A/report?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(JSON.stringify(report)).not.toContain("999999");
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "respuesta anterior",
    );
    const cached = await env.DB.prepare(
      "SELECT body FROM reports WHERE company_id = 'COMP_A'",
    ).first<{ body: string }>();
    expect(JSON.parse(cached?.body ?? "null")).toEqual(report);
  });

  it.each([
    JSON.stringify({ ...narrative, summary: "El índice es 999999." }),
    JSON.stringify({ ...narrative, sections: narrative.sections.slice(0, 2) }),
    JSON.stringify({
      ...narrative,
      sections: [
        ...narrative.sections,
        { code: "decision", title: "Decisión", body: "Comparar escenarios." },
      ],
    }),
    "not JSON",
  ])(
    "returns 502 after two invalid outputs and leaves no cached report",
    async (text) => {
      const model = new MockLanguageModelV4({ doGenerate: reply(text) });
      const judge = vi.fn(() =>
        Promise.resolve<Verdict>({ verdict: "accepted" }),
      );
      const response = await createApp({
        model: () => model,
        judge: () => judge,
      }).request("/companies/COMP_A/report?role=tesorero", undefined, env);
      expect(response.status).toBe(502);
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(judge).not.toHaveBeenCalled();
      const row = await env.DB.prepare(
        "SELECT count(*) AS count FROM reports",
      ).first<{ count: number }>();
      expect(row?.count).toBe(0);
    },
  );

  it("rewrites a narrative the judge rejects once, naming the red line, and stores the rewrite", async () => {
    const solvent = {
      ...narrative,
      summary:
        "La empresa es solvente y su capacidad de pago está garantizada.",
    };
    const model = new MockLanguageModelV4({
      doGenerate: [
        reply(JSON.stringify(solvent)),
        reply(JSON.stringify(narrative)),
      ],
    });
    const judge = vi.fn((text: Narrative) =>
      Promise.resolve<Verdict>(
        text.summary === solvent.summary
          ? { verdict: "rejected", failed: ["solvency_judgement"] }
          : { verdict: "accepted" },
      ),
    );
    const response = await createApp({
      model: () => model,
      judge: () => judge,
    }).request("/companies/COMP_A/report?role=tesorero", undefined, env);
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report.summary).toBe(narrative.summary);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge.mock.calls[0]?.[0]).toMatchObject({
      summary: solvent.summary,
      sections: solvent.sections.map(({ title, body }) => ({ title, body })),
    });
    expect(model.doGenerateCalls).toHaveLength(2);
    const retry = JSON.stringify(model.doGenerateCalls[1]?.prompt);
    expect(retry).toContain("líneas rojas");
    expect(retry).toContain("solvencia");
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).not.toContain(
      "líneas rojas",
    );
    const cached = await env.DB.prepare(
      "SELECT body FROM reports WHERE company_id = 'COMP_A'",
    ).first<{ body: string }>();
    expect(JSON.parse(cached?.body ?? "null")).toEqual(report);
    expect(cached?.body).not.toContain("solvente");
  });

  it("returns 502 after two rejected narratives and leaves no cached report", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const judge = vi.fn(() =>
      Promise.resolve<Verdict>({ verdict: "rejected", failed: ["forecast"] }),
    );
    const response = await createApp({
      model: () => model,
      judge: () => judge,
    }).request("/companies/COMP_A/report?role=tesorero", undefined, env);
    expect(response.status).toBe(502);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "previsiones",
    );
    const row = await env.DB.prepare(
      "SELECT count(*) AS count FROM reports",
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("keeps unavailable values absent instead of reusing an older score or inventing zeros", async () => {
    const detail = company("COMP_GAP", "GROUP_1", [
      { month: "2026-07", score: 60, state: "healthy" },
      { month: "2026-08", score: null, state: "not_evaluable" },
    ]);
    detail.invoice_facts = {};
    detail.group_id = null;
    await env.DB.prepare(
      "INSERT INTO companies SELECT ?, NULL, 0, '2026-08', NULL, 'not_evaluable', ?, ? FROM companies WHERE company_id = 'COMP_A'",
    )
      .bind(detail.company_id, JSON.stringify(detail), JSON.stringify(detail))
      .run();
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_GAP/report?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report.month).toBe("2026-08");
    expect(report.sections[0]?.figures).toEqual([]);
    expect(report.sections[3]?.figures).toEqual([]);
    expect(report.sections[4]?.figures).toEqual([]);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("not_evaluable");
    expect(prompt).toContain("none");
    expect(prompt).toContain("insuficiencia de datos");
  });

  it("separates cached reports by role, rule version and month", async () => {
    await env.DB.prepare(
      "INSERT INTO companies SELECT 'COMP_CACHE', group_id, scorable, month, score, state, json_set(summary, '$.company_id', 'COMP_CACHE'), json_set(detail, '$.company_id', 'COMP_CACHE') FROM companies WHERE company_id = 'COMP_A'",
    ).run();
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const app = createApp({ model: () => model });
    for (const role of ["tesorero", "financiero"]) {
      const response = await app.request(
        `/companies/COMP_CACHE/report?role=${role}`,
        undefined,
        env,
      );
      expect(response.status).toBe(200);
      expect(reportSchema.parse(await response.json()).role).toBe(role);
    }
    await env.DB.prepare(
      "UPDATE companies SET detail = json_set(detail, '$.series[#-1].evidence.rule_version', 'xray-score/0.2') WHERE company_id = 'COMP_CACHE'",
    ).run();
    const updatedRules = await app.request(
      "/companies/COMP_CACHE/report?role=tesorero",
      undefined,
      env,
    );
    expect(reportSchema.parse(await updatedRules.json()).rule_version).toBe(
      "xray-score/0.2",
    );
    await env.DB.prepare(
      "UPDATE companies SET detail = json_set(detail, '$.series[#-1].month', '2026-09') WHERE company_id = 'COMP_CACHE'",
    ).run();
    const updatedMonth = await app.request(
      "/companies/COMP_CACHE/report?role=tesorero",
      undefined,
      env,
    );
    expect(reportSchema.parse(await updatedMonth.json()).month).toBe("2026-09");
    expect(model.doGenerateCalls).toHaveLength(4);
    const row = await env.DB.prepare(
      "SELECT count(*) AS count FROM reports WHERE company_id = 'COMP_CACHE'",
    ).first<{ count: number }>();
    expect(row?.count).toBe(4);
  });

  it("grounds the role sections and figures in D1 and reuses the stored report", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const judge = vi.fn((_narrative: Narrative) =>
      Promise.resolve<Verdict>({ verdict: "accepted" }),
    );
    const app = createApp({ model: () => model, judge: () => judge });
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
    expect(report.sections.at(-1)?.code).not.toBe("decision");
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
    expect(judge).toHaveBeenCalledTimes(1);
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
