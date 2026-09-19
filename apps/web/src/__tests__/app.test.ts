import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import { fakeApi } from "./fixtures.ts";

const ChatPanelStub = {
  props: ["companyId", "alerts"],
  template: "<div class='chat-stub'>{{ companyId }}</div>",
};

function mountApp() {
  return mount(App, { global: { stubs: { ChatPanel: ChatPanelStub } } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("App", () => {
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
    expect(wrapper.text()).toContain(
      "Reclamar las 2 facturas vencidas desde Cuentas por cobrar",
    );
    expect(wrapper.text()).toContain("grupo en tensión");
    expect(wrapper.text()).toContain("1 de 2 empresas cayendo o torciéndose");
    expect(wrapper.findAll("svg circle")).toHaveLength(3);
    expect(wrapper.find(".chat-stub").text()).toBe("COMP_A");
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

  it("keeps the radiography when only the group request fails", async () => {
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
    expect(wrapper.find(".error").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("grupo en tensión");
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
    await wrapper.findAll(".alerts button")[1]?.trigger("click");
    await flushPromises();
    await flushPromises();
    expect(seen).toContain("/api/companies/COMP_C");
    expect(wrapper.find("h1").text()).toBe("COMP_C");
    expect(window.location.hash).toBe("#COMP_C");
  });
});
