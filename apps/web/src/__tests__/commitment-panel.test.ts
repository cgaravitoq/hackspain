import {
  COMMITMENT_LABEL,
  type CommitmentEvaluation,
  type CommitmentRequest,
  commitmentEvaluationSchema,
  commitmentRequestSchema,
} from "@hackspain/shared";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommitmentPanel from "../components/CommitmentPanel.vue";
import { commitmentAssumptions, commitmentEvaluation } from "./fixtures.ts";

function evaluation(request: CommitmentRequest): CommitmentEvaluation {
  const alternatives: CommitmentEvaluation["alternatives"] = [
    {
      advance_bps: 0,
      advance_minor: 0,
      final_minor: request.revenue_minor,
      status: "INCOMPATIBLE",
      min_cash_minor: -100_000,
      closing_minor: 500_000,
      shortfall_minor: 100_000,
      first_breach: {
        date: "2026-09-10",
        phase: "DEBITS",
        cash_minor: -100_000,
      },
      path: [{ date: "2026-09-10", phase: "DEBITS", cash_minor: -100_000 }],
    },
    {
      advance_bps: 2000,
      advance_minor: 2_000_000,
      final_minor: 8_000_000,
      status: "INSUFFICIENT_EVIDENCE",
      min_cash_minor: null,
      closing_minor: null,
      shortfall_minor: null,
      first_breach: null,
      path: [],
    },
    {
      advance_bps: 4000,
      advance_minor: 4_000_000,
      final_minor: 6_000_000,
      status: "COMPATIBLE_UNDER_ASSUMPTIONS",
      min_cash_minor: 123_456,
      closing_minor: 6_123_456,
      shortfall_minor: 0,
      first_breach: null,
      path: [{ date: "2026-09-10", phase: "DEBITS", cash_minor: 123_456 }],
    },
    {
      advance_bps: 6000,
      advance_minor: 6_000_000,
      final_minor: 4_000_000,
      status: "OUTSIDE_HORIZON",
      min_cash_minor: null,
      closing_minor: null,
      shortfall_minor: null,
      first_breach: null,
      path: [],
    },
  ];
  return {
    company_id: "COMP_A",
    currency: "EUR",
    as_of: "2026-09-01",
    horizon_end: "2027-03-01",
    observed_months: 24,
    basis: "USER_ASSUMPTION",
    readiness: "SIMULATION_ONLY",
    opening_verified: false,
    coverage_verified: false,
    is_financial_authorization: false,
    label: COMMITMENT_LABEL,
    search_kind: "ENUMERATED_GRID",
    minimum_tested_feasible_bps: 4000,
    assumptions: request,
    alternatives,
  };
}

async function fillValidForm(wrapper: VueWrapper, opening = "1.234,56") {
  await wrapper.find('input[name="opening"]').setValue(opening);
  await wrapper.find('input[name="floor"]').setValue("200,00");
  await wrapper.find('input[name="revenue"]').setValue("100000,00");
  await wrapper.find('input[name="advance-date"]').setValue("2026-09-02");
  await wrapper.find('input[name="final-date"]').setValue("2026-10-30");
  await wrapper.find('input[name="advance-percents"]').setValue("0,20,40,60");
  await wrapper.find('input[name^="cost-label-"]').setValue("Producción");
  await wrapper.find('input[name^="cost-date-"]').setValue("2026-09-10");
  await wrapper.find('input[name^="cost-amount-"]').setValue("60000,00");
}

afterEach(() => vi.unstubAllGlobals());

describe("CommitmentPanel", () => {
  it("sends exact integer cents and basis points through the shared request contract", async () => {
    let posted: CommitmentRequest | undefined;
    vi.stubGlobal(
      "fetch",
      (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        posted = commitmentRequestSchema.parse(JSON.parse(String(init?.body)));
        return Promise.resolve(Response.json(evaluation(posted)));
      },
    );
    const wrapper = mount(CommitmentPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await fillValidForm(wrapper);
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(posted).toMatchObject({
      opening_minor: 123_456,
      floor_minor: 20_000,
      revenue_minor: 10_000_000,
      advance_bps: [0, 2000, 4000, 6000],
      costs: [{ amount_minor: 6_000_000 }],
    });
  });

  it("renders the fixed label, every Spanish status and the minimum feasible row", async () => {
    const request = commitmentRequestSchema.parse({
      opening_minor: 123_456,
      floor_minor: 20_000,
      revenue_minor: 10_000_000,
      advance_date: "2026-09-02",
      final_date: "2026-10-30",
      advance_bps: [0, 2000, 4000, 6000],
      costs: [
        {
          label: "Producción",
          date: "2026-09-10",
          amount_minor: 6_000_000,
        },
      ],
      other_flows: [],
    });
    const fixture = evaluation(request);
    expect(commitmentEvaluationSchema.safeParse(fixture).success).toBe(true);
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json(fixture)));
    const wrapper = mount(CommitmentPanel, {
      props: { companyId: "COMP_A", role: "tesorero" },
    });
    await fillValidForm(wrapper);
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find(".commitment-label").text()).toBe(COMMITMENT_LABEL);
    expect(wrapper.findAll(".commitment-table tbody tr")).toHaveLength(4);
    expect(wrapper.text()).toContain("Compatible bajo supuestos");
    expect(wrapper.text()).toContain("Incompatible");
    expect(wrapper.text()).toContain("Evidencia insuficiente");
    expect(wrapper.text()).toContain("Fuera de horizonte");
    expect(wrapper.find(".minimum-feasible").text()).toContain("40 %");
    expect(wrapper.text()).toContain("Anticipo mínimo probado");
  });

  it("shows the server Spanish error without an alternatives table", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json(
          { error: "Solicitud de simulación no válida" },
          { status: 400 },
        ),
      ),
    );
    const wrapper = mount(CommitmentPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await fillValidForm(wrapper);
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe(
      "Solicitud de simulación no válida",
    );
    expect(wrapper.find(".commitment-table").exists()).toBe(false);
  });

  it("refuses money with three decimals before making a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(CommitmentPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await fillValidForm(wrapper, "1.234,567");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe(
      "Revisa el saldo inicial supuesto: valor no válido",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hydrates seeded assumptions and posts them through the shared request contract", async () => {
    const posts: CommitmentRequest[] = [];
    const seededAssumptions = {
      ...commitmentAssumptions,
      advance_bps: [0, 1234, 10_000],
    };
    vi.stubGlobal(
      "fetch",
      (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const posted = commitmentRequestSchema.parse(
          JSON.parse(String(init?.body)),
        );
        posts.push(posted);
        return Promise.resolve(
          Response.json(commitmentEvaluation(posted, "COMP_A")),
        );
      },
    );
    const wrapper = mount(CommitmentPanel, {
      props: {
        companyId: "COMP_A",
        role: "financiero",
        seedToken: 1,
        seedAssumptions: seededAssumptions,
      },
    });
    await flushPromises();
    expect(posts).toEqual([seededAssumptions]);
    expect(wrapper.find(".commitment-label").text()).toBe(COMMITMENT_LABEL);
    await wrapper.setProps({ seedToken: 2 });
    await flushPromises();
    expect(posts).toEqual([seededAssumptions, seededAssumptions]);
  });
});
