import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import { company, fakeApi } from "./fixtures.ts";

const ChatPanelStub = {
  props: ["companyId", "alerts", "role"],
  emits: ["close", "compare", "report"],
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
    .findAll('[aria-label="Perfil"] button')
    .find((button) => button.text() === label);
  await tab?.trigger("click");
  await flushPromises();
  await flushPromises();
}

async function openRoute(wrapper: VueWrapper, label: string) {
  const tab = wrapper
    .findAll('[aria-label="Pantalla"] button')
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

async function openSelector(wrapper: VueWrapper) {
  const trigger = wrapper.find('button[aria-label="Seleccionar empresa"]');
  if (trigger.attributes("aria-expanded") !== "true") {
    await trigger.trigger("click");
    await flushPromises();
  }
}

function companyOption(wrapper: VueWrapper, companyId: string) {
  const option = wrapper
    .findAll(".company-option")
    .find((item) => item.find(".company-id").text() === companyId);
  if (!option) {
    throw new Error(`Missing selector option ${companyId}`);
  }
  return option;
}

async function openCompanyFromSelector(wrapper: VueWrapper, companyId: string) {
  await openSelector(wrapper);
  await companyOption(wrapper, companyId).trigger("click");
  await flushPromises();
  await flushPromises();
}

async function compareCompany(wrapper: VueWrapper, companyId: string) {
  await openSelector(wrapper);
  await companyOption(wrapper, companyId)
    .find(".compare-toggle")
    .trigger("click");
  await flushPromises();
  await flushPromises();
}

beforeEach(() => {
  installStorage();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
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
    expect(wrapper.find(".chat-sheet-body").isVisible()).toBe(false);
    expect(wrapper.find(".topbar").attributes("aria-hidden")).toBeUndefined();
    expect(wrapper.find("main").attributes("aria-hidden")).toBeUndefined();
    await wrapper
      .find('button[aria-label="Abrir el asistente"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.find(".chat-sheet-body").isVisible()).toBe(true);
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
    expect(wrapper.find(".chat-sheet-body").isVisible()).toBe(false);
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
    expect(wrapper.find(".chat-sheet-body").isVisible()).toBe(true);
  });

  it("renders the financiero selector without legacy header metadata", async () => {
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
    expect(wrapper.find(".company-selector").exists()).toBe(true);
    expect(wrapper.findAll(".company-selector .compare-chip")).toHaveLength(1);
    expect(wrapper.find(".alerts").exists()).toBe(false);
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
    expect(
      wrapper.find('.details [role="tab"][aria-selected="true"]').text(),
    ).toBe("Acción");
    expect(wrapper.find('[role="tabpanel"]').text()).toBe(
      "Reclamar las 2 facturas vencidas desde Cuentas por cobrar",
    );
    await openTab(wrapper, "Grupo");
    expect(wrapper.text()).toContain("grupo en tensión");
    expect(wrapper.text()).toContain("1 de 2 empresas cayendo o torciéndose");
    expect(wrapper.findAll(".chart-card svg circle")).toHaveLength(1);
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
    expect(wrapper.find(".company-selector").exists()).toBe(false);
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
    expect(wrapper.findAll("section.group button")).toHaveLength(2);
    await wrapper.findAll("section.group button")[1]?.trigger("click");
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
    await compareCompany(wrapper, "COMP_C");
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
    await compareCompany(wrapper, "COMP_B");
    await compareCompany(wrapper, "COMP_C");
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
    await compareCompany(wrapper, "COMP_B");
    await compareCompany(wrapper, "COMP_C");
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
    await compareCompany(wrapper, "COMP_B");
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

  it("opens a selected company as the only comparison", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openCompanyFromSelector(wrapper, "COMP_B");
    expect(wrapper.find("h1").text()).toBe("COMP_B");
    expect(chips(wrapper)).toEqual(["COMP_B"]);
    expect(wrapper.findAll(".series-line")).toHaveLength(1);
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

  it("adds companies from the selector and removes their chart series", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await compareCompany(wrapper, "COMP_B");
    await compareCompany(wrapper, "COMP_C");
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
      .findAll('[aria-label="Perfil"] button')
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

  it("filters selector companies by a typed id", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openSelector(wrapper);
    await wrapper.find("#company-search").setValue("COMP_B");
    await flushPromises();
    expect(wrapper.findAll(".company-id").map((item) => item.text())).toEqual([
      "COMP_B",
    ]);
    expect(seen).not.toContain("/api/companies/COMP_B");
  });

  it("keeps the company on screen while the selector search is empty", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("COMP_A");
    await openSelector(wrapper);
    await wrapper.find("#company-search").setValue("  ");
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

  it("tracks the active view and role in the sidebar", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    expect(
      wrapper.find('[aria-label="Pantalla"] [data-active="true"]').text(),
    ).toBe("Radiografía");
    expect(
      wrapper.find('[aria-label="Perfil"] [data-active="true"]').text(),
    ).toBe("Financiero");
    await openRoute(wrapper, "Grafo");
    await selectRole(wrapper, "Ventas");
    expect(
      wrapper.find('[aria-label="Pantalla"] [data-active="true"]').text(),
    ).toBe("Grafo");
    expect(
      wrapper.find('[aria-label="Perfil"] [data-active="true"]').text(),
    ).toBe("Ventas");
  });

  it("leaves the current view and role untouched for placeholder items", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    const hash = window.location.hash;
    const role = wrapper
      .find('[aria-label="Perfil"] [data-active="true"]')
      .text();
    const alertItem = wrapper
      .findAll('[aria-label="Pantalla"] button')
      .find((button) => button.text() === "Alertas");
    expect(alertItem?.attributes("aria-disabled")).toBe("true");
    expect(alertItem?.attributes("title")).toBe("Próximamente");
    await alertItem?.trigger("click");
    expect(window.location.hash).toBe(hash);
    expect(
      wrapper.find('[aria-label="Perfil"] [data-active="true"]').text(),
    ).toBe(role);
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

  it("loads another company when its alert row is selected", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", fakeApi(seen));
    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();
    await openTab(wrapper, "Informe");
    await openCompanyFromSelector(wrapper, "COMP_C");
    expect(seen).toContain("/api/companies/COMP_C");
    expect(seen).toContain("/api/companies/COMP_C/report");
    expect(wrapper.find("h1").text()).toBe("COMP_C");
    expect(window.location.hash).toBe("#COMP_C");
  });
});
