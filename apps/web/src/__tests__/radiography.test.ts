import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Radiography from "../components/Radiography.vue";
import { alerts, company, explain, fakeApi, group } from "./fixtures.ts";

const detail = company("COMP_A", "GROUP_1");
const ACTION = "Reclamar las 2 facturas vencidas desde Cuentas por cobrar";

function mountRadiography(
  overrides: Partial<typeof detail> = {},
  withGroup = true,
) {
  const current = { ...detail, ...overrides };
  return mount(Radiography, {
    props: {
      company: current,
      explanation: explain("COMP_A", "GROUP_1"),
      comparison: [current],
      alerts,
      group: withGroup ? group : null,
      selected: "COMP_A",
      role: "financiero",
    },
  });
}

function tabs(wrapper: ReturnType<typeof mountRadiography>) {
  return wrapper.findAll('[role="tablist"] [role="tab"]');
}

async function openTab(
  wrapper: ReturnType<typeof mountRadiography>,
  label: string,
) {
  await tabs(wrapper)
    .find((tab) => tab.text() === label)
    ?.trigger("click");
  await flushPromises();
}

function kpi(wrapper: ReturnType<typeof mountRadiography>, label: string) {
  const card = wrapper
    .findAll(".kpi")
    .find((item) => item.find(".kpi-label").text() === label);
  if (!card) {
    throw new Error(`no KPI card labelled ${label}`);
  }
  return card;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("fetch", fakeApi([]));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Radiography", () => {
  it("shows score, three and six month deltas and the month's alerts as four KPI cards", () => {
    const wrapper = mountRadiography({
      latest: { ...detail.latest, delta_3: 4.25, delta_6: -10.5 },
    });
    expect(wrapper.findAll(".kpi")).toHaveLength(4);
    const score = kpi(wrapper, "Score");
    expect(score.find(".score").text()).toBe("12.3");
    expect(score.find(".chip").text()).toBe("cayendo");
    expect(score.find(".kpi-trend").text()).toBe("▼ -27,9 vs mes anterior");
    expect(kpi(wrapper, "Δ 3 meses").find(".kpi-value").text()).toBe("+4,3");
    expect(kpi(wrapper, "Δ 3 meses").find(".pill").classes()).toContain("up");
    expect(kpi(wrapper, "Δ 6 meses").find(".kpi-value").text()).toBe("-10,5");
    expect(kpi(wrapper, "Δ 6 meses").find(".pill").classes()).toContain("down");
    const monthAlerts = kpi(wrapper, "Alertas del mes");
    expect(monthAlerts.find(".kpi-value").text()).toBe("2");
    expect(monthAlerts.find(".kpi-trend").text()).toBe("▼ 1 empeoran");
  });

  it("shows a dash where a delta or the previous month is missing", () => {
    const wrapper = mountRadiography({ series: detail.series.slice(-1) });
    expect(kpi(wrapper, "Score").find(".kpi-trend").text()).toBe(
      "– vs mes anterior",
    );
    expect(kpi(wrapper, "Δ 3 meses").find(".kpi-value").text()).toBe("–");
    expect(kpi(wrapper, "Δ 6 meses").find(".kpi-value").text()).toBe("–");
  });

  it("opens on the Acción tab with the single action sentence", () => {
    const wrapper = mountRadiography();
    expect(tabs(wrapper).map((tab) => tab.text())).toEqual([
      "Acción",
      "Por qué",
      "Qué cambió",
      "Informe",
      "Grupo",
    ]);
    expect(tabs(wrapper).map((tab) => tab.attributes("aria-selected"))).toEqual(
      ["true", "false", "false", "false", "false"],
    );
    expect(wrapper.find('[role="tabpanel"] .action').text()).toBe(ACTION);
    expect(wrapper.find(".drivers").exists()).toBe(false);
    expect(wrapper.find(".report").exists()).toBe(false);
    expect(wrapper.find(".group").exists()).toBe(false);
  });

  it("shows drivers and evidence under Por qué and component deltas under Qué cambió", async () => {
    const wrapper = mountRadiography();
    await openTab(wrapper, "Por qué");
    expect(wrapper.find(".drivers").text()).toContain("cobertura 0.40");
    expect(wrapper.find(".evidence").text()).toContain("2026-06 a 2026-08");
    expect(wrapper.find(".action").exists()).toBe(false);
    await openTab(wrapper, "Qué cambió");
    expect(wrapper.find(".changed").text()).toContain("Cobros frente a pagos");
    expect(wrapper.find(".drivers").exists()).toBe(false);
  });

  it("mounts the report under Informe and hides the action", async () => {
    const wrapper = mountRadiography();
    await openTab(wrapper, "Informe");
    expect(wrapper.find(".report .report-summary").text()).toBe(
      "La tesorería necesita atención inmediata.",
    );
    expect(wrapper.find(".action").exists()).toBe(false);
    expect(
      tabs(wrapper)
        .find((tab) => tab.text() === "Informe")
        ?.attributes("aria-selected"),
    ).toBe("true");
  });

  it("mounts the group strip under Grupo and hides the tab without a group", async () => {
    const wrapper = mountRadiography();
    await openTab(wrapper, "Grupo");
    expect(wrapper.find(".group").text()).toContain("grupo en tensión");
    await wrapper.findAll(".group button")[1]?.trigger("click");
    expect(wrapper.emitted("select")).toEqual([["COMP_B"]]);
    const alone = mountRadiography({}, false);
    expect(tabs(alone).map((tab) => tab.text())).not.toContain("Grupo");
  });
});
