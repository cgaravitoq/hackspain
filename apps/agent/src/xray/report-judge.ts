import { z } from "zod";

export type Narrative = {
  summary: string;
  sections: { title: string; body: string }[];
};

const RED_LINE_IDS = [
  "solvency_judgement",
  "default_or_fraud",
  "causal_language",
  "forbidden_action",
  "forecast",
] as const;

export type RedLine = (typeof RED_LINE_IDS)[number];

type RedLineRule = {
  instructions: string;
  criteria: { true: string; false: string };
  retry: string;
};

export const RED_LINES: Record<RedLine, RedLineRule> = {
  solvency_judgement: {
    instructions:
      "Does the report text (Spanish) judge the company to be solvent or insolvent, creditworthy or not creditworthy, or assign it a credit rating?",
    criteria: {
      true: "It states or implies that the company is, or is not, solvent or creditworthy, or grades its credit quality.",
      false:
        "It describes the treasury index and its components (inflows versus outflows, momentum, fees, refunds), names the product's state labels (sana, saludable, mejorando, estable, torciéndose, cayendo, deterioro, caída) or the data coverage. Those are observations, not a solvency judgement.",
    },
    retry: "afirma o niega solvencia o calidad crediticia",
  },
  default_or_fraud: {
    instructions:
      "Does the report text claim anything about whether the company has defaulted, will default or is at risk of default on payments (impago), commits fraud, or spreads risk to other companies (contagio)?",
    criteria: {
      true: "It asserts or rules out default, fraud or contagion as a fact about the company.",
      false:
        "Naming overdue invoices, their age or concentration, or the debt concentration inside a group, is not a default or fraud claim; disclaimers such as 'no se trata de un cliente moroso' or 'las señales no prueban impagos' frame the review and are allowed.",
    },
    retry: "afirma o descarta impago, fraude o contagio",
  },
  causal_language: {
    instructions:
      "Does the report text state, as a fact, an economic or business cause behind the figures (for example a lost client, a market change, seasonality, a management decision or a supplier problem)?",
    criteria: {
      true: "It explains the figures with a real-world cause presented as fact, such as 'a causa de la pérdida de un cliente'.",
      false:
        "Saying which component of the index moved, or that inflows below outflows lower the coverage, is arithmetic attribution and allowed; open questions about possible causes are allowed.",
    },
    retry:
      "explica los cambios con causas económicas en lugar de aportaciones aritméticas",
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
      "Does the report text predict the company's future figures, states or events, or whether it will be able to pay its obligations in the future?",
    criteria: {
      true: "It forecasts what will happen or what the company will be able to pay.",
      false:
        "It stays with observed months and what to verify; naming a forecasting module to check against is not a prediction.",
    },
    retry: "hace previsiones o afirma capacidad futura de pago",
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
