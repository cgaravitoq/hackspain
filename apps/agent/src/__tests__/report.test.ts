import { env } from "cloudflare:test";
import { reportSchema } from "@hackspain/shared";
import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

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
