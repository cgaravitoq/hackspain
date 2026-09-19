import { env } from "cloudflare:test";
import { roleSchema } from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { reportSources } from "../xray/report.ts";
import {
  type Narrative,
  reportFacts,
  templateNarrative,
  validateNarrative,
} from "../xray/report-narrative.ts";
import { seed } from "./fixtures.ts";

beforeAll(() => seed(env.DB));

const valid: Narrative = {
  headline: "Los pagos superan a los cobros y la tesorería se debilita",
  summary:
    "COMP_A ingresó 40.000 € y pagó 100.000 € en agosto de 2026, así que los cobros cubrieron el 40 % de los pagos.",
  score_explanation:
    "La lectura empeora porque las salidas pesan más que las entradas.",
  outlook:
    "Si esta relación no cambia, la lectura seguirá débil en los próximos meses.",
  caveat: "",
  next_steps: ["Revisar qué pagos explican la diferencia con los cobros."],
};

async function facts(companyId = "COMP_A") {
  return reportFacts(await reportSources(env.DB, companyId), companyId);
}

describe("report narrative", () => {
  it("builds a template that passes its own validator for every role and state", async () => {
    for (const companyId of ["COMP_A", "COMP_B", "COMP_0909", "COMP_D"]) {
      const current = await facts(companyId);
      for (const role of roleSchema.options) {
        const narrative = templateNarrative(role, current);
        expect(validateNarrative(narrative, role, current)).toEqual([]);
        expect(narrative.next_steps.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("accepts sourced amounts and Spanish month names", async () => {
    expect(validateNarrative(valid, "tesorero", await facts())).toEqual([]);
  });

  it("rejects model vocabulary in the visible text", async () => {
    const violations = validateNarrative(
      { ...valid, outlook: "El momentum sigue negativo." },
      "tesorero",
      await facts(),
    );
    expect(violations).toEqual(["forbidden word: momentum"]);
  });

  it("rejects an amount that does not appear in the data", async () => {
    const violations = validateNarrative(
      { ...valid, summary: "Pagó 999.999 € en agosto de 2026." },
      "tesorero",
      await facts(),
    );
    expect(violations).toEqual(["unsourced number: 999.999"]);
  });

  it("rejects text beyond the role's word ceiling", async () => {
    const long = Array.from({ length: 301 }, () => "palabra").join(" ");
    const violations = validateNarrative(
      { ...valid, score_explanation: long },
      "tesorero",
      await facts(),
    );
    expect(violations).toEqual([
      expect.stringMatching(/^too long: \d+ words, limit 300$/),
    ]);
  });

  it("requires sales steps to be addressed to the company", async () => {
    const violations = validateNarrative(
      {
        ...valid,
        next_steps: [
          "Conciliar cobros y pagos por categoría.",
          "¿Qué pagos importantes tiene previstos?",
        ],
      },
      "ventas",
      await facts(),
    );
    expect(violations).toEqual([
      "sales step is not addressed to the company: Conciliar cobros y pagos por categoría.",
    ]);
  });

  it("keeps internal risk language out of the sales report", async () => {
    const violations = validateNarrative(
      { ...valid, caveat: "Existe riesgo de impago.", next_steps: [] },
      "ventas",
      await facts(),
    );
    expect(violations).toEqual([
      "forbidden word: impago",
      "forbidden word: riesgo",
    ]);
  });

  it("states the window amounts and coverage computed from the monthly flows", async () => {
    const current = await facts();
    expect(current.period).toBe("agosto de 2026");
    expect(current.period_inflow).toBe("40.000 €");
    expect(current.period_outflow).toBe("100.000 €");
    expect(current.period_inflow_as_pct_of_outflow).toBe(40);
  });
});
