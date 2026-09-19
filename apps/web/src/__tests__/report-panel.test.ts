import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportPanel from "../components/ReportPanel.vue";
import { report } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());

describe("ReportPanel", () => {
  it("says the report is being generated until it arrives", async () => {
    let answer: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(wrapper.find(".loading").text()).toBe("Generando informe…");
    expect(wrapper.find(".report-summary").exists()).toBe(false);
    answer?.(Response.json(report));
    await flushPromises();
    expect(wrapper.find(".loading").exists()).toBe(false);
    expect(wrapper.find(".report-summary").text()).toBe(report.summary);
  });
});
