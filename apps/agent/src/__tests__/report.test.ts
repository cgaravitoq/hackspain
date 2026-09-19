import { env } from "cloudflare:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { reportSchema } from "@hackspain/shared";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../app.ts";
import { company, falling, seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));
beforeEach(() => env.DB.prepare("DELETE FROM reports").run());

const narrative = {
  headline: "Los pagos de agosto casi triplican a los cobros de COMP_A",
  summary:
    "COMP_A tiene una salud de tesorería de 12 sobre 100 en agosto de 2026: entraron 40.000 € y salieron 100.000 €.",
  score_explanation:
    "Los cobros cubrieron el 40 % de los pagos, y esa diferencia es lo que más pesa en la lectura.",
  outlook:
    "Mientras los pagos sigan por encima de los cobros, la lectura seguirá débil.",
  caveat: "",
  next_steps: ["Revisar qué pagos explican la diferencia con los cobros."],
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
    const html = await fallback.text();
    expect(html).toContain("@media print");
    expect(html).toContain("Escenario de tendencia no disponible");
    expect(html).toContain("Faltan 2 meses observados");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(quickAction).toHaveBeenCalledTimes(1);
  });

  it("renders the deterministic server trend scenario in printable HTML", async () => {
    const trendProjection = {
      rule_version: "xray-trend-projection/0.1",
      status: "available" as const,
      reason: null,
      semantics: "scenario_range_not_confidence_interval" as const,
      observed_months: 8,
      min_months_required: 6,
      months_missing: 0,
      points: [
        { month: "2026-09", base: 31, favorable: 42, adverse: 20 },
        { month: "2026-10", base: 29, favorable: 45, adverse: 13 },
        { month: "2026-11", base: 27, favorable: 47, adverse: 7 },
      ],
      evidence: {
        latest_score: 33,
        momentum: -6,
        volatility: 11,
        source_months: [
          "2026-03",
          "2026-04",
          "2026-05",
          "2026-06",
          "2026-07",
          "2026-08",
        ],
      },
    };
    const detail = {
      ...falling,
      company_id: "COMP_TREND",
      months_observed: 8,
      trend_projection: trendProjection,
    };
    const { series: _series, ...summary } = detail;
    await env.DB.prepare(
      "INSERT INTO companies (company_id, group_id, scorable, month, score, state, summary, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
      .bind(
        detail.company_id,
        detail.group_id,
        1,
        detail.latest.month,
        detail.latest.score,
        detail.latest.state,
        JSON.stringify(summary),
        JSON.stringify(detail),
      )
      .run();
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_TREND/report.html?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Escenario de tendencia a tres meses");
    expect(html).toContain("2026-09</td><td>31</td><td>42</td><td>20");
    expect(html).toContain("no un intervalo de confianza ni una previsión");
  });

  it("escapes model HTML and removes executable links and external images before rendering", async () => {
    const unsafe = {
      ...narrative,
      headline: '<script>alert("unsafe")</script>',
      summary:
        '<img src=x onerror=alert()> <iframe src="https://untrusted.example"></iframe>',
    };
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(unsafe)),
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      const { html } = pdfRequest.parse(input);
      expect(html).not.toMatch(/<script|<img|<iframe/);
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

  it("renders the full role report with its trend scenario and caches PDF bytes in D1", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: reply(JSON.stringify(narrative)),
    });
    const quickAction = vi.fn((action: "pdf", input: BrowserRunPDFOptions) => {
      expect(action).toBe("pdf");
      const request = pdfRequest.parse(input);
      expect(request.html).toContain(narrative.headline);
      expect(request.html).toContain(narrative.summary);
      expect(request.html).toContain(narrative.next_steps[0]);
      for (const heading of [
        "Qué ha cambiado",
        "Qué podemos esperar",
        "Qué conviene revisar",
      ]) {
        expect(request.html).toContain(heading);
      }
      expect(request.html).toContain(
        "Índice orientativo de salud de tesorería; no constituye una evaluación crediticia.",
      );
      expect(request.html).toContain("Escenario de tendencia no disponible");
      for (const technical of [
        "Anexo",
        "Metodología",
        "Glosario",
        "rule_version",
        "Ten en cuenta",
      ]) {
        expect(request.html).not.toContain(technical);
      }
      expect(request.pdfOptions.headerTemplate).toContain("Industrias Ebro");
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
      heading: "Por qué tiene esta puntuación",
      steps: narrative.next_steps,
    },
    {
      role: "ventas",
      heading: "Cómo abordar la conversación",
      steps: ["¿Cómo prevén equilibrar cobros y pagos este trimestre?"],
    },
  ])(
    "returns the $role human-v2 report written by the model",
    async ({ role, heading, steps }) => {
      const model = new MockLanguageModelV4({
        doGenerate: reply(JSON.stringify({ ...narrative, next_steps: steps })),
      });
      const response = await createApp({ model: () => model }).request(
        `/companies/COMP_A/report?role=${role}`,
        undefined,
        env,
      );
      expect(response.status).toBe(200);
      const report = reportSchema.parse(await response.json());
      expect(report).toMatchObject({
        schema_version: "human-v2",
        role,
        score: 12,
        source: "llm",
        headline: narrative.headline,
        export_url: `/api/companies/COMP_A/report.pdf?role=${role}`,
      });
      expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain(
        heading,
      );
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

  it("sends the violations back once and caches the corrected model report", async () => {
    const invented = { ...narrative, outlook: "Cerrará el año con 999.999 €." };
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
    expect(report.source).toBe("llm");
    expect(JSON.stringify(report)).not.toContain("999.999");
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "unsourced number: 999.999",
    );
    const cached = await env.DB.prepare(
      "SELECT body FROM reports WHERE company_id = 'COMP_A'",
    ).first<{ body: string }>();
    expect(JSON.parse(cached?.body ?? "null")).toEqual(report);
  });

  it.each([
    JSON.stringify({ ...narrative, outlook: "El momentum sigue cayendo." }),
    JSON.stringify({ ...narrative, next_steps: ["uno", "dos", "tres"] }),
    JSON.stringify({ ...narrative, summary: "El índice es 999999." }),
    JSON.stringify({
      ...narrative,
      sections: [{ code: "decision", title: "Forbidden", body: "Forbidden" }],
    }),
    "not JSON",
  ])(
    "falls back to the deterministic template after two invalid outputs and caches nothing",
    async (text) => {
      const model = new MockLanguageModelV4({ doGenerate: reply(text) });
      const response = await createApp({ model: () => model }).request(
        "/companies/COMP_A/report?role=tesorero",
        undefined,
        env,
      );
      expect(response.status).toBe(200);
      const report = reportSchema.parse(await response.json());
      expect(report.source).toBe("template");
      expect(report.summary).toContain("12 sobre 100");
      expect(
        [
          report.headline,
          report.summary,
          report.score_explanation,
          report.outlook,
          report.caveat,
          ...report.next_steps,
        ].join(" "),
      ).not.toContain("momentum");
      expect(model.doGenerateCalls).toHaveLength(2);
      const row = await env.DB.prepare(
        "SELECT count(*) AS count FROM reports",
      ).first<{ count: number }>();
      expect(row?.count).toBe(0);
    },
  );

  it("falls back to the template when the model is unavailable", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(new Error("5035: not on this plan")),
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_A/report?role=ventas",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report.source).toBe("template");
    expect(report.next_steps.join(" ")).not.toMatch(/riesgo/i);
  });

  it("explains that a company has no valid reading instead of inventing a score", async () => {
    const detail = company("COMP_GAP", "GROUP_1", [
      { month: "2026-07", score: 60, state: "healthy" },
      { month: "2026-08", score: null, state: "not_evaluable" },
    ]);
    detail.invoice_facts = {};
    detail.group_id = null;
    await env.DB.prepare(
      "INSERT INTO companies SELECT ?, NULL, 0, '2026-08', NULL, 'not_evaluable', ?, ?, ? FROM companies WHERE company_id = 'COMP_A'",
    )
      .bind(
        detail.company_id,
        JSON.stringify(detail),
        JSON.stringify(detail),
        detail.name,
      )
      .run();
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(new Error("offline")),
    });
    const response = await createApp({ model: () => model }).request(
      "/companies/COMP_GAP/report?role=tesorero",
      undefined,
      env,
    );
    expect(response.status).toBe(200);
    const report = reportSchema.parse(await response.json());
    expect(report.month).toBe("2026-08");
    expect(report.score).toBeNull();
    expect(report.headline).toBe(
      "No hay datos suficientes para valorar la tesorería este mes",
    );
  });

  it("separates cached reports by role, rule version and month", async () => {
    await env.DB.prepare(
      "INSERT INTO companies SELECT 'COMP_CACHE', group_id, scorable, month, score, state, json_set(summary, '$.company_id', 'COMP_CACHE'), json_set(detail, '$.company_id', 'COMP_CACHE'), 'Cache Company' FROM companies WHERE company_id = 'COMP_A'",
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
      "UPDATE companies SET detail = json_set(detail, '$.trend_projection.rule_version', 'xray-trend-projection/0.2') WHERE company_id = 'COMP_CACHE'",
    ).run();
    const updatedProjection = await app.request(
      "/companies/COMP_CACHE/report?role=tesorero",
      undefined,
      env,
    );
    expect(
      reportSchema.parse(await updatedProjection.json()).trend_projection
        .rule_version,
    ).toBe("xray-trend-projection/0.2");
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
      "UPDATE companies SET detail = json_set(detail, '$.series[#-1].month', '2026-09', '$.series[#-1].evidence.window', '2026-09 a 2026-09') WHERE company_id = 'COMP_CACHE'",
    ).run();
    const updatedMonth = await app.request(
      "/companies/COMP_CACHE/report?role=tesorero",
      undefined,
      env,
    );
    expect(reportSchema.parse(await updatedMonth.json()).month).toBe("2026-09");
    expect(model.doGenerateCalls).toHaveLength(5);
    const row = await env.DB.prepare(
      "SELECT count(*) AS count FROM reports WHERE company_id = 'COMP_CACHE'",
    ).first<{ count: number }>();
    expect(row?.count).toBe(5);
  });

  it("grounds the prompt in plain-language facts from D1 and reuses the stored report", async () => {
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
    expect(report.trend_projection).toEqual(falling.trend_projection);
    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    for (const fact of [
      "40.000 €",
      "100.000 €",
      "agosto de 2026",
      "Qué ha cambiado",
    ]) {
      expect(prompt).toContain(fact);
    }
    expect(prompt).not.toContain("xray-score");
    const repeated = await app.request(
      "/companies/COMP_A/report?role=tesorero",
      undefined,
      env,
    );
    expect(await repeated.json()).toEqual(report);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
