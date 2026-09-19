import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { ALERTS_LIMIT } from "../api.ts";
import AlertList from "../components/AlertList.vue";
import { alert, alerts } from "./fixtures.ts";

function cappedAlerts() {
  return Array.from({ length: ALERTS_LIMIT }, (_, index) =>
    alert(`COMP_${index}`),
  );
}

describe("AlertList", () => {
  it("renders one alert pill per alert and emits the clicked company id", async () => {
    const wrapper = mount(AlertList, {
      props: { alerts, selected: "" },
    });
    const pills = wrapper.findAll(".alert-pill");
    expect(pills).toHaveLength(alerts.length);
    await pills[1]?.trigger("click");
    expect(wrapper.emitted("select")).toEqual([["COMP_C"]]);
  });

  it("marks the count as truncated when the list reaches the fetch limit", () => {
    const wrapper = mount(AlertList, {
      props: { alerts: cappedAlerts(), selected: "" },
    });
    expect(wrapper.find(".panel-title").text()).toBe(
      `Alertas del mes · ${ALERTS_LIMIT}+`,
    );
  });
});
