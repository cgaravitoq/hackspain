import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createJudge } from "../xray/report-judge.ts";

const narrative = {
  summary: "Revisar los hechos observados con las personas autorizadas.",
  sections: [
    {
      code: "resumen",
      title: "Situación",
      body: "Contrastar los datos disponibles antes de actuar.",
    },
    {
      code: "que_hacer",
      title: "Qué revisar",
      body: "Verificar con las personas autorizadas.",
    },
  ],
};

const redLines = [
  "solvency_judgement",
  "default_or_fraud",
  "causal_language",
  "forbidden_action",
  "forecast",
] as const;

const wireRequest = z.strictObject({
  model: z.literal("jev-latest"),
  state: z.strictObject({
    summary: z.string(),
    sections: z.array(z.strictObject({ title: z.string(), body: z.string() })),
  }),
  questions: z.record(
    z.enum(redLines),
    z.strictObject({
      type: z.literal("noul"),
      instructions: z.string().min(1),
      criteria: z.strictObject({
        true: z.string().min(1),
        false: z.string().min(1),
      }),
    }),
  ),
});

function answers(noul: Partial<Record<(typeof redLines)[number], number>>) {
  return Response.json({
    model: "jev-1.13.0",
    answers: Object.fromEntries(
      redLines.map((id) => [id, { type: "noul", noul: noul[id] ?? 0 }]),
    ),
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

function fetcher(respond: (request: Request) => Promise<Response>) {
  return vi.fn((url: string, init: RequestInit) =>
    respond(new Request(url, init)),
  );
}

describe("report judge", () => {
  it("sends the narrative and one noul question per red line in TypeSafe's wire shape", async () => {
    const fetch = fetcher(async (request) => {
      expect(request.url).toBe("https://api.typesafe.ai/v1/systemone");
      expect(request.method).toBe("POST");
      expect(request.headers.get("authorization")).toBe("Bearer test-key");
      expect(request.headers.get("content-type")).toBe("application/json");
      const body = wireRequest.parse(await request.json());
      expect(body.state).toEqual({
        summary: narrative.summary,
        sections: narrative.sections.map(({ title, body: text }) => ({
          title,
          body: text,
        })),
      });
      expect(Object.keys(body.questions).sort()).toEqual([...redLines].sort());
      return answers({});
    });
    const verdict = await createJudge("test-key", fetch)(narrative);
    expect(verdict).toEqual({ verdict: "accepted" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects the narrative once a red line passes one half and names only that line", async () => {
    const judge = createJudge(
      "test-key",
      fetcher(async (request) => {
        const { state } = wireRequest.parse(await request.json());
        return state.summary.includes("solvente")
          ? answers({ solvency_judgement: 0.51, forecast: 0.5 })
          : answers({ forecast: 0.5, default_or_fraud: 0.5 });
      }),
    );
    expect(
      await judge({ ...narrative, summary: "La empresa es solvente." }),
    ).toEqual({ verdict: "rejected", failed: ["solvency_judgement"] });
    expect(await judge(narrative)).toEqual({ verdict: "accepted" });
  });

  it("leaves the narrative unjudged when TypeSafe fails, answers off contract or times out", async () => {
    for (const respond of [
      async () =>
        new Response(await answers({ forecast: 0.9 }).text(), {
          status: 529,
          headers: { "content-type": "application/json" },
        }),
      () => Promise.reject(new Error("network down")),
      () =>
        Promise.resolve(
          Response.json({
            answers: { solvency_judgement: { type: "noul", noul: 0.99 } },
          }),
        ),
      () => Promise.resolve(new Response("not json")),
    ]) {
      const fetch = fetcher(respond);
      expect(await createJudge("test-key", fetch)(narrative)).toEqual({
        verdict: "unavailable",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("never calls TypeSafe without an API key", async () => {
    const fetch = fetcher(() => Promise.resolve(answers({})));
    expect(await createJudge("", fetch)(narrative)).toEqual({
      verdict: "unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
