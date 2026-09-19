import {
  COMMITMENT_LABEL,
  type CommitmentRequest,
  commitmentRequestSchema,
} from "@hackspain/shared";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import {
  commitmentAssumptions,
  commitmentEvaluation,
  compactCommitmentOutput,
  company,
  fakeApi,
} from "./fixtures.ts";

const ChatPanelStub = {
  props: ["companyId", "alerts", "role"],
  emits: ["close", "compare", "report", "commitment"],
  template:
    "<div class='chat-stub'>{{ companyId }} {{ role }}<input id='chat-input' /></div>",
};

function sse(chunks: object[]): Response {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`),
    "data: [DONE]",
  ].join("\n\n");
  return new Response(`${body}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

let mounted: VueWrapper | undefined;

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

function mountApp() {
  mounted = mount(App, {
    attachTo: document.body,
    global: { stubs: { ChatPanel: ChatPanelStub } },
  });
  return mounted;
}

async function selectRole(wrapper: VueWrapper, label: string) {
  const tab = wrapper
    .findAll(".role-tabs button")
    .find((button) => button.text() === label);
  await tab?.trigger("click");
  await flushPromises();
  await flushPromises();
}

async function openRoute(wrapper: VueWrapper, label: string) {
  const tab = wrapper
    .findAll(".route-tabs button")
    .find((button) => button.text() === label);
  await tab?.trigger("click");
  await flushPromises();
  await flushPromises();
}

async function openTab(wrapper: VueWrapper, label: string) {
  const tab = wrapper
    .findAll('[role="tab"]')
    .find((button) => button.text() === label);
  await tab?.trigger("click");
  await flushPromises();
  await flushPromises();
}

function chips(wrapper: VueWrapper) {
  return wrapper
    .findAll(".compare-chip")
    .map((chip) => chip.text().replace("×", "").trim());
}

beforeEach(() => {
  installStorage();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  mounted?.unmount();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("App", () => {
  it("shows a first-load notice until the assistant is opened", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    const button = wrapper.find('button[aria-label="Abrir el asistente"]');
    expect(button.exists()).toBe(true);
    expect(wrapper.find('[aria-label="1 aviso"]').text()).toBe("1");
    await button.trigger("click");
    expect(wrapper.find('[aria-label="1 aviso"]').exists()).toBe(false);
    expect(window.localStorage.getItem("xray.chat.seen")).toBe("true");
  });

  it("hides the assistant until its bubble is clicked and focuses the chat", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".chat-popover").isVisible()).toBe(false);
    await wrapper
      .find('button[aria-label="Abrir el asistente"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.find(".chat-popover").isVisible()).toBe(true);
    expect(wrapper.find(".chat-stub").text()).toContain("COMP_A financiero");
    expect(document.activeElement).toBe(wrapper.find("#chat-input").element);
  });

  it("keeps the assistant mounted when Escape closes it", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    const button = wrapper.find('button[aria-label="Abrir el asistente"]');
    await button.trigger("click");
    await wrapper.find("#chat-input").setValue("Compara A y B");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find(".chat-popover").isVisible()).toBe(false);
    await button.trigger("click");
    expect(wrapper.find<HTMLInputElement>("#chat-input").element.value).toBe(
      "Compara A y B",
    );
  });

  it("keeps the first-load notice when browser storage is blocked", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[aria-label="1 aviso"]').text()).toBe("1");
    await wrapper
      .find('button[aria-label="Abrir el asistente"]')
      .trigger("click");
    expect(wrapper.find(".chat-popover").isVisible()).toBe(true);
  });

  it("renders the financiero toolbar without legacy header metadata", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/meta");
    expect(wrapper.find(".topbar").text()).not.toContain(
      "salud financiera de cada empresa, cada mes",
    );
    expect(wrapper.find(".topbar").text()).not.toContain("datos hasta");
    expect(wrapper.find(".toolbar .search").exists()).toBe(true);
    expect(wrapper.findAll(".toolbar .compare-chip")).toHaveLength(1);
    expect(wrapper.find(".toolbar").text()).toContain("hasta 3");
  });

  it("opens on the worst alert and shows its radiography, action and group", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(seen).toEqual(
      expect.arrayContaining([
        "/api/alerts",
        "/api/companies/COMP_A",
        "/api/companies/COMP_A/explain",
        "/api/groups/GROUP_1",
      ]),
    );
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    expect(wrapper.find(".score").text()).toBe("12.3");
    expect(wrapper.find(".chip").text()).toBe("cayendo");
    expect(wrapper.text()).toContain("▼ -27,9 vs mes anterior");
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe(
      "Acción",
    );
    expect(wrapper.find('[role="tabpanel"]').text()).toBe(
      "Reclamar las 2 facturas vencidas desde Cuentas por cobrar",
    );
    await openTab(wrapper, "Grupo");
    expect(wrapper.text()).toContain("grupo en tensión");
    expect(wrapper.text()).toContain("1 de 2 empresas cayendo o torciéndose");
    expect(wrapper.findAll("svg circle")).toHaveLength(1);
    expect(wrapper.find(".chat-stub").text()).toBe("COMP_A financiero");
  });

  it("pins the treasurer to its company without search, alerts or comparison", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    const before = seen.length;
    await selectRole(wrapper, "Tesorero");
    expect(seen).toContain("/api/companies/COMP_0176");
    expect(seen.slice(before)).not.toContain("/api/compare");
    expect(wrapper.find("h1").text()).toBe("COMP_0176");
    expect(wrapper.find(".toolbar").exists()).toBe(false);
    expect(wrapper.find(".alerts").exists()).toBe(false);
    expect(wrapper.find(".compare-chip").exists()).toBe(false);
  });

  it("keeps the treasurer on its company when the hash changes", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await selectRole(wrapper, "Tesorero");
    window.location.hash = "COMP_B";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_0176");
    expect(window.location.hash).toBe("#COMP_0176");
  });

  it("keeps the treasurer on its company when a group member is clicked", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await selectRole(wrapper, "Tesorero");
    await openTab(wrapper, "Grupo");
    expect(wrapper.findAll(".group button")).toHaveLength(2);
    await wrapper.findAll(".group button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_0176");
    expect(window.location.hash).toBe("#COMP_0176");
    expect(seen).not.toContain("/api/companies/COMP_B");
    await selectRole(wrapper, "Financiero");
    expect(chips(wrapper)).toEqual(["COMP_0176"]);
  });

  it("draws one series when the treasurer takes over the company already on screen", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    window.location.hash = "COMP_0176";
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    window.location.hash = "COMP_0176";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flushPromises();
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_0176", "COMP_C"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(2);
    await selectRole(wrapper, "Tesorero");
    expect(wrapper.find("h1").text()).toBe("COMP_0176");
    expect(wrapper.findAll(".series-line")).toHaveLength(1);
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "Talleres Ribera",
      "proyección por tendencia (3 meses)",
      "rango por tendencia",
    ]);
  });

  it("draws only the treasurer's series after comparing three companies", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("COMP_B");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_B", "COMP_C"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(3);
    await selectRole(wrapper, "Tesorero");
    expect(wrapper.find("h1").text()).toBe("COMP_0176");
    expect(wrapper.findAll(".series-line")).toHaveLength(1);
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "Talleres Ribera",
      "proyección por tendencia (3 meses)",
      "rango por tendencia",
    ]);
  });

  it("replaces the oldest chip when a fourth company is opened", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("COMP_B");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_B", "COMP_C"]);
    window.location.hash = "COMP_D";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_D");
    expect(chips(wrapper)).toEqual(["COMP_B", "COMP_C", "COMP_D"]);
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "COMP_B",
      "COMP_C",
      "COMP_D",
      "proyección por tendencia (3 meses)",
      "rango por tendencia",
    ]);
  });

  it("replaces the comparison with the companies returned by chat", async () => {
    const base = fakeApi([]);
    vi.stubGlobal("fetch", (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(String(input), "https://web.test");
      return url.pathname === "/api/chat"
        ? Promise.resolve(
            sse([
              { type: "start" },
              {
                type: "tool-input-available",
                toolCallId: "compare-1",
                toolName: "compare",
                input: { company_ids: ["COMP_B", "COMP_C"] },
              },
              {
                type: "tool-output-available",
                toolCallId: "compare-1",
                output: {
                  months: ["2026-05", "2026-06", "2026-07", "2026-08"],
                  companies: [
                    company("COMP_B", "GROUP_1"),
                    company("COMP_C", "GROUP_2"),
                  ],
                },
              },
              { type: "finish" },
            ]),
          )
        : base(input);
    });
    mounted = mount(App);
    const wrapper = mounted;
    await flushPromises();
    await flushPromises();
    await wrapper
      .find('button[aria-label="Abrir el asistente"]')
      .trigger("click");
    await wrapper.find("#chat-input").setValue("Compara B y C");
    await wrapper.find(".chat form").trigger("submit");
    await vi.waitFor(() =>
      expect(chips(wrapper)).toEqual(["COMP_B", "COMP_C"]),
    );
    expect(wrapper.find("h1").text()).toBe("COMP_B");
  });

  it("opens the company and role returned by a report in chat", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    wrapper.findComponent(ChatPanelStub).vm.$emit("report", {
      company_id: "COMP_B",
      role: "ventas",
      export_url: "/api/companies/COMP_B/report.pdf?role=ventas",
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_B");
    expect(wrapper.find(".chat-stub").text()).toBe("COMP_B ventas");
    await openTab(wrapper, "Informe");
    expect(wrapper.find(".report-export").attributes("href")).toBe(
      "/api/companies/COMP_B/report.pdf?role=ventas",
    );
  });

  it("keeps the newest comparison when an earlier response arrives late", async () => {
    const base = fakeApi([]);
    const pending: { ids: string[]; answer: (response: Response) => void }[] =
      [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(String(input), "https://web.test");
      if (url.pathname !== "/api/compare") {
        return base(input);
      }
      return new Promise((answer) => {
        pending.push({
          ids: url.searchParams.get("ids")?.split(",") ?? [],
          answer,
        });
      });
    });
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("COMP_B");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    expect(pending.map((request) => request.ids)).toEqual([
      ["COMP_A"],
      ["COMP_A", "COMP_B"],
    ]);
    for (const request of [...pending].reverse()) {
      request.answer(
        Response.json({
          months: ["2026-05", "2026-06", "2026-07", "2026-08"],
          companies: request.ids.map((id) => company(id, "GROUP_1")),
        }),
      );
      await flushPromises();
    }
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "COMP_A",
      "COMP_B",
      "proyección por tendencia (3 meses)",
      "rango por tendencia",
    ]);
  });

  it("does not duplicate a chip when the company on screen is opened again", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("COMP_B");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_B"]);
    await wrapper.findAll(".alerts button")[0]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_B"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(2);
  });

  it("opens the company named in the URL hash", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    window.location.hash = "COMP_B";
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/companies/COMP_B");
    expect(seen).not.toContain("/api/companies/COMP_A");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
  });

  it("shows the group error above the radiography when only the group request fails", async () => {
    const seen: string[] = [];
    const base = fakeApi(seen);
    vi.stubGlobal("fetch", (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input), "https://web.test").pathname;
      return path.startsWith("/api/groups/")
        ? Promise.resolve(new Response("down", { status: 500 }))
        : base(input);
    });
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    expect(wrapper.find(".score").text()).toBe("12.3");
    expect(wrapper.find(".error").text()).toBe("/groups/GROUP_1 answered 500");
    expect(wrapper.text()).not.toContain("grupo en tensión");
  });

  it("adds companies from search and alerts and removes their chart series", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("COMP_B");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_B", "COMP_C"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(3);
    await wrapper.find('button[aria-label="Quitar COMP_B"]').trigger("click");
    await flushPromises();
    expect(chips(wrapper)).toEqual(["COMP_A", "COMP_C"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(2);
    expect(seen).toContain("/api/compare");
  });

  it("renders the role report with figures and a PDF export", async () => {
    const requested: string[] = [];
    const base = fakeApi([]);
    vi.stubGlobal("fetch", (input: RequestInfo | URL): Promise<Response> => {
      requested.push(String(input));
      return base(input);
    });
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(requested).not.toContain(
      "/api/companies/COMP_A/report?role=financiero",
    );
    await openTab(wrapper, "Informe");
    expect(wrapper.find(".report-summary").text()).toBe(
      "La tesorería necesita atención inmediata.",
    );
    expect(wrapper.find(".report-section h3").text()).toBe("Situación actual");
    expect(
      wrapper.findAll(".report-body p").map((item) => item.text()),
    ).toEqual([
      "Los cobros han caído.",
      "Las facturas vencidas presionan la caja.",
    ]);
    expect(wrapper.find(".report-section table").text()).toContain(
      "Cobros40.000EUR",
    );
    const exportLink = wrapper.find(".report-export");
    expect(exportLink.attributes("href")).toBe(
      "/api/companies/COMP_A/report.pdf?role=financiero",
    );
    expect(exportLink.attributes("target")).toBe("_blank");
    const salesTab = wrapper
      .findAll(".role-tabs button")
      .find((button) => button.text() === "Ventas");
    await salesTab?.trigger("click");
    await flushPromises();
    expect(requested).toContain("/api/companies/COMP_A/report?role=ventas");
    expect(wrapper.find(".report-export").attributes("href")).toBe(
      "/api/companies/COMP_A/report.pdf?role=ventas",
    );
    expect(wrapper.find(".chat-stub").text()).toBe("COMP_A ventas");
  });

  it("keeps the radiography visible when its report fails", async () => {
    const base = fakeApi([]);
    vi.stubGlobal("fetch", (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(String(input), "https://web.test");
      return url.pathname.endsWith("/report")
        ? Promise.resolve(new Response("down", { status: 500 }))
        : base(input);
    });
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openTab(wrapper, "Informe");
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    expect(wrapper.find(".report .error p").text()).toBe(
      "No se pudo generar el informe",
    );
    expect(wrapper.find(".report .error small").text()).toBe(
      "/companies/COMP_A/report?role=financiero answered 500",
    );
  });

  it("opens the first company matching a typed id prefix", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await wrapper.find("#company-search").setValue("comp_");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/companies/COMP_B");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
    expect(window.location.hash).toBe("#COMP_B");
  });

  it("keeps the company on screen when the search is submitted empty", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    await wrapper.find("#company-search").setValue("  ");
    await wrapper.find("form.search").trigger("submit");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    expect(seen).not.toContain("/api/companies/COMP_B");
    expect(window.location.hash).toBe("#COMP_A");
  });

  it("opens the relation graph on the graph route and the radiography on a company route", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    window.location.hash = "graph";
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".graph-screen").exists()).toBe(true);
    expect(wrapper.find(".layout").exists()).toBe(false);
    expect(seen).toContain("/api/graph");
    expect(seen).not.toContain("/api/companies/COMP_A");
    window.location.hash = "COMP_B";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".graph-screen").exists()).toBe(false);
    expect(wrapper.find("h1").text()).toBe("COMP_B");
  });

  it("points the browser at the graph route from the header", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openRoute(wrapper, "Grafo");
    expect(window.location.hash).toBe("#graph");
  });

  it("returns from the graph to the company that was on screen", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    window.location.hash = "COMP_B";
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openRoute(wrapper, "Grafo");
    expect(wrapper.find(".graph-screen").exists()).toBe(true);
    await openRoute(wrapper, "Radiografía");
    expect(window.location.hash).toBe("#COMP_B");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
  });

  it("shows the failing endpoint when the bootstrap requests fail", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("down", { status: 500 })),
    );
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".error").text()).toBe("/meta answered 500");
  });

  it("follows a hash change to another company", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    window.location.hash = "COMP_B";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/companies/COMP_B");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
  });

  it("loads another company when an alert is clicked", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openTab(wrapper, "Informe");
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/companies/COMP_C");
    expect(seen).toContain("/api/companies/COMP_C/report");
    expect(wrapper.find("h1").text()).toBe("COMP_C");
    expect(window.location.hash).toBe("#COMP_C");
  });

  it("shows the Compromiso tab only to treasury and finance roles", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toContain(
      "Compromiso",
    );
    await openTab(wrapper, "Compromiso");
    expect(wrapper.find(".commitment").exists()).toBe(true);
    await selectRole(wrapper, "Tesorero");
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toContain(
      "Compromiso",
    );
    await selectRole(wrapper, "Ventas");
    expect(
      wrapper.findAll('[role="tab"]').map((tab) => tab.text()),
    ).not.toContain("Compromiso");
    expect(wrapper.find(".commitment").exists()).toBe(false);
  });

  it("opens Compromiso from a streamed simulate_commitment tool through the assistant", async () => {
    const posts: { path: string; body: CommitmentRequest }[] = [];
    const base = fakeApi([]);
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input), "https://web.test");
        if (url.pathname === "/api/chat") {
          return Promise.resolve(
            sse([
              { type: "start" },
              {
                type: "tool-input-available",
                toolCallId: "commitment-1",
                toolName: "simulate_commitment",
                input: { company: "COMP_B", ...commitmentAssumptions },
              },
              {
                type: "tool-output-available",
                toolCallId: "commitment-1",
                output: compactCommitmentOutput("COMP_B"),
              },
              { type: "finish" },
            ]),
          );
        }
        if (url.pathname === "/api/companies/COMP_B/commitment") {
          const body = commitmentRequestSchema.parse(
            JSON.parse(String(init?.body)),
          );
          posts.push({ path: url.pathname, body });
          return Promise.resolve(
            Response.json(commitmentEvaluation(body, "COMP_B")),
          );
        }
        return base(input);
      },
    );
    mounted = mount(App, { attachTo: document.body });
    const wrapper = mounted;
    await flushPromises();
    await flushPromises();
    await selectRole(wrapper, "Ventas");
    await openRoute(wrapper, "Grafo");
    expect(wrapper.find(".graph-screen").exists()).toBe(true);
    await wrapper
      .find('button[aria-label="Abrir el asistente"]')
      .trigger("click");
    await wrapper.find("#chat-input").setValue("Simula el compromiso");
    await wrapper.find(".chat form").trigger("submit");
    await vi.waitFor(() =>
      expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe(
        "Compromiso",
      ),
    );
    expect(wrapper.find(".graph-screen").exists()).toBe(false);
    expect(wrapper.find("h1").text()).toBe("COMP_B");
    expect(wrapper.find(".role-tabs .active").text()).toBe("Financiero");
    expect(posts).toEqual([
      { path: "/api/companies/COMP_B/commitment", body: commitmentAssumptions },
    ]);
    expect(wrapper.find(".commitment-label").text()).toBe(COMMITMENT_LABEL);
  });

  it("keeps treasury selected when chat opens a commitment simulation", async () => {
    const posts: string[] = [];
    const base = fakeApi([]);
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input), "https://web.test");
        if (url.pathname.endsWith("/commitment")) {
          posts.push(url.pathname);
          const body = commitmentRequestSchema.parse(
            JSON.parse(String(init?.body)),
          );
          return Promise.resolve(
            Response.json(commitmentEvaluation(body, "COMP_B")),
          );
        }
        return base(input);
      },
    );
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await selectRole(wrapper, "Tesorero");
    wrapper.findComponent(ChatPanelStub).vm.$emit("commitment", {
      company_id: "COMP_B",
      assumptions: commitmentAssumptions,
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".role-tabs .active").text()).toBe("Tesorero");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe(
      "Compromiso",
    );
    expect(posts).toEqual(["/api/companies/COMP_B/commitment"]);
  });

  it("refreshes Compromiso when chat repeats the same commitment assumptions", async () => {
    const posts: CommitmentRequest[] = [];
    const base = fakeApi([]);
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input), "https://web.test");
        if (!url.pathname.endsWith("/commitment")) {
          return base(input);
        }
        const body = commitmentRequestSchema.parse(
          JSON.parse(String(init?.body)),
        );
        posts.push(body);
        return Promise.resolve(
          Response.json(commitmentEvaluation(body, "COMP_A")),
        );
      },
    );
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    const payload = {
      company_id: "COMP_A",
      assumptions: commitmentAssumptions,
    };
    wrapper.findComponent(ChatPanelStub).vm.$emit("commitment", payload);
    await flushPromises();
    await flushPromises();
    wrapper.findComponent(ChatPanelStub).vm.$emit("commitment", payload);
    await flushPromises();
    await flushPromises();
    expect(posts).toEqual([commitmentAssumptions, commitmentAssumptions]);
    expect(wrapper.find(".commitment-label").text()).toBe(COMMITMENT_LABEL);
  });
});
