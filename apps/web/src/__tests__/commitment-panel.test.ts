import {
  commitmentContextSchema,
  commitmentRequestSchema,
  commitmentResponseSchema,
} from "@hackspain/shared";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommitmentPanel from "../components/CommitmentPanel.vue";

const context = commitmentContextSchema.parse({
  company_id: "COMP_A",
  currency: "EUR",
  as_of: "2026-09-01",
  history_months: 18,
  max_horizon_months: 6,
  baseline_months: ["2026-06", "2026-07", "2026-08"],
  monthly_inflow_minor: 10_000,
  monthly_outflow_minor: 10_000,
  basis: "LEDGER_SCENARIO_ONLY",
  limitations: ["El saldo contable no acredita caja libre."],
  snapshot: {
    as_of: "2026-09-01",
    currency: "EUR",
    ledger_minor: 4_000_000,
    available_minor: null,
    availability_verified: false,
    source: "balances.csv",
    account_ids: ["P1"],
    accounts_expected: 1,
    accounts_observed: 1,
    limitations: [],
  },
});

const cash = {
  status: "COMPATIBLE_UNDER_ASSUMPTIONS",
  min_cash_minor: 2_000_000,
  closing_minor: 8_000_000,
  shortfall_minor: 0,
  first_breach: null,
  path: [],
  is_financial_authorization: false,
};
const result = commitmentResponseSchema.parse({
  evaluation: {
    company_id: "COMP_A",
    context,
    calculation_version: "xray-commitment/1",
    status: "EVALUATED",
    label: "Simulación, no reservable, requiere revisión humana",
    reservable: false,
    opportunity: {
      title: "Order",
      revenue_minor: 10_000_000,
      advance_date: "2026-09-02",
      final_payment_date: "2026-10-30",
      permitted_advance_bps: [0, 4000],
      costs: [{ id: "cost-1", date: "2026-09-10", amount_minor: 6_000_000 }],
    },
    horizon_end: "2026-11-01",
    reserve_floor_minor: 2_000_000,
    search_kind: "ENUMERATED_GRID",
    minimum_tested_feasible_bps: 4000,
    baseline: cash,
    alternatives: [{ advance_bps: 4000, advance_minor: 4_000_000, cash }],
    assumptions: ["Supuesto, no previsión validada"],
  },
  report_section: {
    code: "decision",
    title: "Evaluación",
    body: "Simulación, no reservable, requiere revisión humana",
    figures: [],
  },
});

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

function setup() {
  const posted: string[] = [];
  vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      posted.push(String(init.body));
      return Promise.resolve(Response.json(result));
    }
    return Promise.resolve(Response.json(context));
  });
  wrapper = mount(CommitmentPanel, { props: { companyId: "COMP_A" } });
  return { view: wrapper, posted };
}

async function fill(view: VueWrapper) {
  await flushPromises();
  await view.find("#commitment-title").setValue("Order");
  await view.find("#commitment-revenue").setValue("100000");
  await view.find("#commitment-floor").setValue("20000");
  await view.find("#commitment-horizon").setValue("2");
  await view.find("#commitment-advance-date").setValue("2026-09-02");
  await view.find("#commitment-final-date").setValue("2026-10-30");
  await view.find("[data-cost-amount]").setValue("60000");
  await view.find("[data-cost-date]").setValue("2026-09-10");
}

describe("CommitmentPanel", () => {
  it("pre-fills what TellMe drafted and leaves the rest for the user", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json(context)));
    wrapper = mount(CommitmentPanel, {
      props: {
        companyId: "COMP_A",
        draft: {
          opportunity: {
            title: "Pedido de Bodegas",
            revenue_minor: 5_000_050,
            permitted_advance_bps: [0, 3000],
            costs: [{ id: "c1", date: "2026-09-12", amount_minor: 3_500_000 }],
          },
        },
      },
    });
    await flushPromises();
    const value = (selector: string) =>
      wrapper?.get<HTMLInputElement>(selector).element.value;
    expect(value("#commitment-title")).toBe("Pedido de Bodegas");
    expect(value("#commitment-revenue")).toBe("50000,50");
    expect(value("#commitment-maximum")).toBe("30");
    expect(value("[data-cost-amount]")).toBe("35000");
    expect(value("[data-cost-date]")).toBe("2026-09-12");
    expect(
      wrapper.get<HTMLInputElement>("#commitment-confirm").element.checked,
    ).toBe(false);
    expect(wrapper.text()).toContain("TellMe ha rellenado el formulario");
  });

  it("shows the server ledger as read-only context and requires confirmation", async () => {
    const { view, posted } = setup();
    await fill(view);
    expect(view.text()).toContain("COMP_A");
    expect(view.text()).toContain("Saldo contable");
    expect(view.find('input[name="opening_minor"]').exists()).toBe(false);
    await view.find("form").trigger("submit");
    expect(posted).toEqual([]);
    expect(view.find('[role="alert"]').text()).toContain("confirma");
  });

  it("submits only validated opportunity fields and displays a non-reservable result", async () => {
    const { view, posted } = setup();
    await fill(view);
    await view.find("#commitment-confirm").setValue(true);
    await view.find("form").trigger("submit");
    await flushPromises();
    const body = JSON.parse(posted[0] ?? "{}");
    expect(commitmentRequestSchema.safeParse(body).success).toBe(true);
    expect(body.opportunity.revenue_minor).toBe(10_000_000);
    expect(body.opening_verified).toBeUndefined();
    expect(view.text()).toContain(
      "Simulación, no reservable, requiere revisión humana",
    );
    expect(view.find(".commitment-results").exists()).toBe(true);
    expect(view.emitted("evaluated")).toHaveLength(1);
    expect(
      view.findAll("button").some((button) => button.text() === "Reservar"),
    ).toBe(false);
  });

  it("invalidates the reviewed result and confirmation when a field changes", async () => {
    const { view } = setup();
    await fill(view);
    await view.find("#commitment-confirm").setValue(true);
    await view.find("form").trigger("submit");
    await flushPromises();
    expect(view.find(".commitment-results").exists()).toBe(true);
    await view.find("#commitment-revenue").setValue("110000");
    expect(view.find(".commitment-results").exists()).toBe(false);
    expect(
      view.get<HTMLInputElement>("#commitment-confirm").element.checked,
    ).toBe(false);
    expect(view.emitted("invalidated")?.length).toBeGreaterThan(0);
  });

  it("rejects ambiguous money rather than rounding it silently", async () => {
    const { view, posted } = setup();
    await fill(view);
    await view.find("#commitment-revenue").setValue("100.001");
    await view.find("#commitment-confirm").setValue(true);
    await view.find("form").trigger("submit");
    expect(posted).toHaveLength(0);
    expect(view.find('[role="alert"]').exists()).toBe(true);
  });

  it("ignores a simulation that finishes after its company has changed", async () => {
    let finish: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(
            Response.json({
              ...context,
              company_id: String(_input).includes("COMP_B")
                ? "COMP_B"
                : "COMP_A",
            }),
          ),
    );
    wrapper = mount(CommitmentPanel, { props: { companyId: "COMP_A" } });
    await fill(wrapper);
    await wrapper.find("#commitment-confirm").setValue(true);
    await wrapper.find("form").trigger("submit");
    await wrapper.setProps({ companyId: "COMP_B" });
    await flushPromises();
    finish?.(Response.json(result));
    await flushPromises();
    expect(wrapper.find(".commitment-results").exists()).toBe(false);
    expect(wrapper.emitted("evaluated")).toBeUndefined();
  });
});
