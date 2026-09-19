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

  it("renders list lines as items and never shows emphasis markers", async () => {
    const section = { ...report.sections[0], body: "- uno\n\n**dos**" };
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ...report, sections: [section] })),
    );
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(
      wrapper.findAll(".report-body li").map((item) => item.text()),
    ).toEqual(["uno"]);
    expect(
      wrapper.findAll(".report-body p").map((item) => item.text()),
    ).toEqual(["dos"]);
    expect(wrapper.text()).not.toContain("**");
    expect(wrapper.text()).not.toContain("- uno");
  });

  it("tells the reader in Spanish that the report could not be generated", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("down", { status: 500 })),
    );
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    const failure = wrapper.find(".error");
    expect(failure.find("p").text()).toBe("No se pudo generar el informe");
    expect(failure.find("small").text()).toBe(
      "/companies/COMP_A/report?role=financiero answered 500",
    );
    expect(wrapper.find(".report-summary").exists()).toBe(false);
  });
});
