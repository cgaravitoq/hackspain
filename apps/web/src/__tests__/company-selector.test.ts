import type { CompanySummary } from "@hackspain/shared";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import CompanySelector from "../components/CompanySelector.vue";
import { alerts, companies, company } from "./fixtures.ts";

function summary(companyId: string): CompanySummary {
  const { series: _series, ...item } = company(companyId, "GROUP_1");
  return item;
}

function mountSelector(comparison = ["COMP_A"]) {
  return mount(CompanySelector, {
    attachTo: document.body,
    props: {
      alerts,
      companies: [...companies, summary("COMP_D")],
      company: company("COMP_A", "GROUP_1"),
      selected: "COMP_A",
      comparison,
    },
  });
}

async function openSelector(wrapper: VueWrapper) {
  await wrapper
    .find('button[aria-label="Seleccionar empresa"]')
    .trigger("click");
  await flushPromises();
}

function option(wrapper: VueWrapper, companyId: string) {
  const item = wrapper
    .findAll(".company-option")
    .find((candidate) => candidate.find(".company-id").text() === companyId);
  if (!item) {
    throw new Error(`Missing selector option ${companyId}`);
  }
  return item;
}

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
});

describe("CompanySelector", () => {
  it("shows alert and company groups and filters them by typing", async () => {
    const wrapper = mountSelector();
    await openSelector(wrapper);
    expect(wrapper.text()).toContain("Alertas del mes");
    expect(wrapper.text()).toContain("Todas");
    await wrapper.find("#company-search").setValue("COMP_B");
    await flushPromises();
    expect(wrapper.findAll(".company-id").map((item) => item.text())).toEqual([
      "COMP_B",
    ]);
    wrapper.unmount();
  });

  it("opens one company while comparison toggles keep the menu open", async () => {
    const wrapper = mountSelector();
    await openSelector(wrapper);
    await option(wrapper, "COMP_B").find(".compare-toggle").trigger("click");
    expect(wrapper.emitted("compare")).toEqual([[["COMP_A", "COMP_B"]]]);
    expect(
      wrapper
        .find('button[aria-label="Seleccionar empresa"]')
        .attributes("aria-expanded"),
    ).toBe("true");
    await option(wrapper, "COMP_C").trigger("click");
    expect(wrapper.emitted("open")).toEqual([["COMP_C"]]);
    wrapper.unmount();
  });

  it("refuses a fourth company and clears the comparison", async () => {
    const wrapper = mountSelector(["COMP_A", "COMP_B", "COMP_C"]);
    await openSelector(wrapper);
    const fourth = option(wrapper, "COMP_D").find(".compare-toggle");
    expect(fourth.attributes("disabled")).toBeDefined();
    await fourth.trigger("click");
    expect(wrapper.emitted("compare")).toBeUndefined();
    expect(wrapper.find(".selector-footer").text()).toContain("Comparando 3");
    await wrapper.find(".selector-footer button").trigger("click");
    expect(wrapper.emitted("compare")).toEqual([[[]]]);
    wrapper.unmount();
  });
});
