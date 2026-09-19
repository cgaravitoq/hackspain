import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Radiography from "../components/Radiography.vue";
import { alerts, company, explain } from "./fixtures.ts";

const detail = company("COMP_A", "GROUP_1");

function mountRadiography(overrides: Partial<typeof detail> = {}) {
  const current = { ...detail, ...overrides };
  return mount(Radiography, {
    props: {
      company: current,
      explanation: explain("COMP_A", "GROUP_1"),
      comparison: [current],
      alerts,
    },
  });
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
});
