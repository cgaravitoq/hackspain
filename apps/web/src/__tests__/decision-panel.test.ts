import type { Simulate } from "@hackspain/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DecisionPanel from "../components/DecisionPanel.vue";
import DetailTabs from "../components/DetailTabs.vue";
import { company, explain, group } from "./fixtures.ts";

const simulation: Simulate = {
  company_id: "COMP_A",
  label: "escenario",
  horizon: 6,
  inputs: {
    starting_cash: 150_000,
    pending_receivables: 33_333.33,
    credit_line_limit: 73_333.33,
    credit_line_drawn: 40_000,
    net_flow_monthly: -60_000,
  },
  baseline: {
    cash: [150_000, 90_000, 30_000, -30_000, -90_000, -150_000, -210_000],
    final_cash: -210_000,
    minimum_cash: -210_000,
    minimum_cash_month: 6,
    score: 28.6,
  },
  scenarios: [
    {
      kind: "receivable_advance",
      requested: 50_000,
      applied: 33_333.33,
      capped: true,
      cost: 666.67,
      cash: [
        150_000, 122_666.66, 62_666.66, 2_666.66, -57_333.34, -117_333.34,
        -177_333.34,
      ],
      final_cash: -177_333.34,
      minimum_cash: -177_333.34,
      minimum_cash_month: 6,
      score: 34.2,
      score_delta: 5.6,
      debt_outstanding_after: 40_000,
      decision_figures: [
        { label: "Caja mínima", value: -177_333.34, unit: "EUR" },
        { label: "Caja final", value: -177_333.34, unit: "EUR" },
        { label: "Coste", value: 666.67, unit: "EUR" },
        { label: "Delta score", value: 5.6, unit: "pts" },
      ],
    },
    {
      kind: "credit_line_draw",
      requested: 33_000,
      applied: 33_000,
      capped: false,
      cost: 990,
      cash: [150_000, 122_835, 62_670, 2_505, -57_660, -117_825, -177_990],
      final_cash: -177_990,
      minimum_cash: -177_990,
      minimum_cash_month: 6,
      score: 28.3,
      score_delta: -0.3,
      debt_outstanding_after: 73_000,
      decision_figures: [
        { label: "Caja mínima", value: -177_990, unit: "EUR" },
        { label: "Caja final", value: -177_990, unit: "EUR" },
        { label: "Coste", value: 990, unit: "EUR" },
        { label: "Delta score", value: -0.3, unit: "pts" },
      ],
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DecisionPanel", () => {
  it("is hidden from the company detail tabs", () => {
    const wrapper = mount(DetailTabs, {
      props: {
        company: company("COMP_A", "GROUP_1"),
        explanation: explain("COMP_A", "GROUP_1"),
        group,
        selected: "COMP_A",
        role: "financiero",
      },
    });
    expect(
      wrapper.findAll('[role="tab"]').map((tab) => tab.text()),
    ).not.toContain("Decisión");
    expect(wrapper.find(".decision-panel").exists()).toBe(false);
  });

  it("sends treasury defaults in the first scenario request", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://web.test");
      seen.push(`${url.pathname}${url.search}`);
      return Promise.resolve(
        Response.json(
          url.pathname.endsWith("/simulate")
            ? simulation
            : company("COMP_A", "GROUP_1"),
        ),
      );
    });
    const wrapper = mount(DecisionPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(wrapper.find(".decision-panel").exists()).toBe(true);
    expect(seen).toContain(
      "/api/companies/COMP_A/simulate?horizon=6&advance=33000&draw=33000&fee=0.02&apr=0.06",
    );
  });

  it("renders scenario paths, literal figures and a cap returned by the API", async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://web.test");
      seen.push(`${url.pathname}${url.search}`);
      return Promise.resolve(
        Response.json(
          url.pathname.endsWith("/simulate")
            ? simulation
            : company("COMP_A", "GROUP_1"),
        ),
      );
    });
    const wrapper = mount(DecisionPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    const paths = wrapper.findAll("svg .decision-series");
    expect(paths).toHaveLength(3);
    expect(paths.map((item) => item.classes())).toEqual([
      ["decision-series", "baseline"],
      ["decision-series", "receivable_advance"],
      ["decision-series", "credit_line_draw"],
    ]);
    const figures = wrapper
      .findAll(".decision-figure")
      .map((item) => item.text());
    expect(figures).toEqual([
      "Caja mínima-177.333 €",
      "Caja final-177.333 €",
      "Coste667 €",
      "Delta score+5,6 pts",
      "Caja mínima-177.990 €",
      "Caja final-177.990 €",
      "Coste990 €",
      "Delta score-0,3 pts",
    ]);
    await wrapper.find('input[name="advance"]').setValue("50000");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(seen).toContain(
      "/api/companies/COMP_A/simulate?horizon=6&advance=50000&draw=33000&fee=0.02&apr=0.06",
    );
    expect(wrapper.text()).toContain("tope: pendiente de cobro");
    expect(wrapper.findAll(".decision-scenario")[1]?.text()).not.toContain(
      "tope: línea disponible",
    );
  });

  it("strokes the scenario cash paths without filling them", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://web.test");
      return Promise.resolve(
        Response.json(
          url.pathname.endsWith("/simulate")
            ? simulation
            : company("COMP_A", "GROUP_1"),
        ),
      );
    });
    const wrapper = mount(DecisionPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(wrapper.findAll("svg path.decision-series")).toHaveLength(3);
    const rules = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .filter((rule) => rule.selectorText.includes(".decision-series"));
    const [base, ...kinds] = rules;
    expect(base?.style.fill).toBe("none");
    expect(kinds.map((rule) => rule.style.cssText)).toEqual([
      "stroke: var(--stable);",
      "stroke: var(--accent);",
      "stroke: var(--improving);",
    ]);
  });

  it("explains when three observed months are unavailable", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://web.test");
      return Promise.resolve(
        url.pathname.endsWith("/simulate")
          ? Response.json({ error: "No months observed" }, { status: 404 })
          : Response.json(company("COMP_A", "GROUP_1")),
      );
    });
    const wrapper = mount(DecisionPanel, {
      props: { companyId: "COMP_A", role: "tesorero" },
    });
    await flushPromises();
    expect(wrapper.find(".error").text()).toBe(
      "Sin tres meses observados: no se puede simular",
    );
  });
});
