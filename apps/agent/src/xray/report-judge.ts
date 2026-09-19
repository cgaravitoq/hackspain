import { z } from "zod";

export type Narrative = {
  summary: string;
  sections: { title: string; body: string }[];
};

const RED_LINE_IDS = [
  "asserts_solvency",
  "causal_language",
  "forbidden_action",
  "forecast",
  "amount_in_words",
] as const;

export type RedLine = (typeof RED_LINE_IDS)[number];

type RedLineRule = {
  instructions: string;
  criteria: { true: string; false: string };
  retry: string;
};

export const RED_LINES: Record<RedLine, RedLineRule> = {
  asserts_solvency: {
    instructions:
      "Does the report text (Spanish) assert or deny the company's solvency, creditworthiness, risk of default (impago), fraud, contagion to other companies, or its future capacity to pay?",
    criteria: {
      true: "It states or implies such a judgement about the company, positively or negatively.",
      false:
        "It only describes observed treasury figures, their coverage and the checks to perform.",
    },
    retry:
      "afirma o niega solvencia, crédito, impago, fraude, contagio o capacidad futura de pago",
  },
  causal_language: {
    instructions:
      "Does the report text attribute a change in the figures to a cause (for example 'se debe a', 'a causa de', 'provocado por', 'porque') instead of describing what changed?",
    criteria: {
      true: "It explains why a figure moved.",
      false:
        "It describes what moved and when, or names arithmetic contributions, without a cause.",
    },
    retry: "explica causas en lugar de describir cambios",
  },
  forbidden_action: {
    instructions:
      "Does the report text propose or recommend a credit limit, a commercial sanction, financing, an employment decision, or an automatic payment?",
    criteria: {
      true: "It recommends one of those actions.",
      false:
        "It only proposes checks, reviews and conversations that authorised people validate.",
    },
    retry:
      "propone límites de crédito, sanciones comerciales, financiación, decisiones laborales o pagos automáticos",
  },
  forecast: {
    instructions:
      "Does the report text predict the company's future figures, states or events?",
    criteria: {
      true: "It forecasts what will happen.",
      false:
        "It stays with observed months and what to verify; naming a forecasting module to check against is not a prediction.",
    },
    retry: "hace previsiones",
  },
  amount_in_words: {
    instructions:
      "Does the report text spell out a money amount, percentage, ratio, score or invoice count in words (for example 'veinte por ciento', 'tres millones de euros')? Durations such as 'tres meses' do not count.",
    criteria: {
      true: "A quantity is written out in words.",
      false: "Quantities are only referred to the figure tables.",
    },
    retry:
      "escribe cantidades con palabras en lugar de remitir al cuadro de cifras",
  },
};

export type Verdict =
  | { verdict: "accepted" }
  | { verdict: "unavailable" }
  | { verdict: "rejected"; failed: RedLine[] };

export type Judge = (narrative: Narrative) => Promise<Verdict>;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const JUDGE_URL = "https://api.typesafe.ai/v1/systemone";
const JUDGE_MODEL = "jev-latest";
const JUDGE_THRESHOLD = 0.5;

const answersSchema = z.object({
  answers: z.record(
    z.enum(RED_LINE_IDS),
    z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  ),
});

export function createJudge(apiKey: string, fetcher: Fetcher = fetch): Judge {
  return async (narrative) => {
    if (!apiKey) {
      return { verdict: "unavailable" };
    }
    try {
      const response = await fetcher(JUDGE_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          state: {
            summary: narrative.summary,
            sections: narrative.sections.map(({ title, body }) => ({
              title,
              body,
            })),
          },
          questions: Object.fromEntries(
            RED_LINE_IDS.map((id) => [
              id,
              {
                type: "noul",
                instructions: RED_LINES[id].instructions,
                criteria: RED_LINES[id].criteria,
              },
            ]),
          ),
        }),
      });
      if (!response.ok) {
        return { verdict: "unavailable" };
      }
      const { answers } = answersSchema.parse(await response.json());
      const failed = RED_LINE_IDS.filter(
        (id) => answers[id].noul > JUDGE_THRESHOLD,
      );
      return failed.length > 0
        ? { verdict: "rejected", failed }
        : { verdict: "accepted" };
    } catch {
      return { verdict: "unavailable" };
    }
  };
}
