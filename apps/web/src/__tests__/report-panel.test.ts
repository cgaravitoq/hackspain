import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportPanel from "../components/ReportPanel.vue";
import { report } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());

function answer(body = report) {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json(body)));
}

describe("ReportPanel", () => {
  it("says the report is being generated until it arrives", async () => {
    let resolve: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(wrapper.find(".loading").text()).toBe("Generando resumen…");
    expect(wrapper.find(".report-headline").exists()).toBe(false);
    resolve?.(Response.json(report));
    await flushPromises();
    expect(wrapper.find(".loading").exists()).toBe(false);
    expect(wrapper.find(".report-headline").text()).toBe(report.headline);
  });

  it("keeps the dashboard report concise and leaves detail to the export", async () => {
    answer();
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "financiero" },
    });
    await flushPromises();
    expect(wrapper.find(".report-score strong").text()).toBe("12");
    expect(wrapper.find(".report-score span").text()).toBe("cayendo");
    expect(wrapper.find(".report-summary").text()).toBe(report.summary);
    expect(wrapper.get(".report-export").text()).toBe(
      "Exportar informe completo",
    );
    expect(wrapper.find(".report-section").exists()).toBe(false);
  });

  it("appends the decision outcome and folds its assumptions", async () => {
    answer();
    const decision = {
      code: "decision" as const,
      title: "Operación evaluada",
      body: "Sin anticipo, la caja mínima estimada es 1.200 €.\n\nSimulación no reservable.\n\n- Supuesto conservador.\n- **Sin** reservas.",
      figures: [{ label: "Caja mínima", value: 1200, unit: "EUR" }],
    };
    const wrapper = mount(ReportPanel, {
      props: {
        companyId: "COMP_A",
        role: "financiero",
        decisionSection: decision,
      },
    });
    await flushPromises();
    expect(wrapper.findAll("h3").at(-1)?.text()).toBe(decision.title);
    const section = wrapper.find(".report-decision");
    expect(section.find(".report-body > p").text()).toBe(
      "Sin anticipo, la caja mínima estimada es 1.200 €.",
    );
    expect(section.findAll("details li").map((item) => item.text())).toEqual([
      "Supuesto conservador.",
      "Sin reservas.",
    ]);
    expect(section.find("details summary").text()).toBe(
      "Supuestos y límites de la simulación",
    );
    expect(section.find("td").text()).toBe("1200");
  });

  it("colours the score by state and keeps the internal state label from sales", async () => {
    answer({ ...report, role: "ventas" });
    const wrapper = mount(ReportPanel, {
      props: { companyId: "COMP_A", role: "ventas" },
    });
    await flushPromises();
    expect(wrapper.find(".report-score strong").attributes("style")).toContain(
      "color",
    );
    expect(wrapper.find(".report-score span").exists()).toBe(false);
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
    expect(failure.find("p").text()).toBe("No se pudo generar el resumen");
    expect(failure.find("small").text()).toBe(
      "/companies/COMP_A/report?role=financiero answered 500",
    );
    expect(wrapper.find(".report-headline").exists()).toBe(false);
  });
});
