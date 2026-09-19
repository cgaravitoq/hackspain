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
  it("emits the clicked company id through select", async () => {
    const wrapper = mount(AlertList, {
      props: { alerts, selected: "" },
    });
    await wrapper.findAll("button")[1]?.trigger("click");
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
