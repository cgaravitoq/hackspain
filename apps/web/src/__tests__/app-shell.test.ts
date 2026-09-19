import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppShell from "../AppShell.vue";

const AppStub = {
  props: ["initialRole"],
  template: "<div class='app-stub'>{{ initialRole ?? 'none' }}</div>",
};

let mounted: VueWrapper | undefined;

function mountShell() {
  mounted = mount(AppShell, {
    attachTo: document.body,
    global: { stubs: { App: AppStub } },
  });
  return mounted;
}

async function click(wrapper: VueWrapper, text: string) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text().startsWith(text));
  await button?.trigger("click");
  await flushPromises();
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  mounted?.unmount();
  document.body.replaceChildren();
});

describe("AppShell", () => {
  it("opens on the landing and moves to the role selection from Empezar", async () => {
    const wrapper = mountShell();
    expect(wrapper.find("h1").text()).toContain("inteligencia artificial");
    await click(wrapper, "Empezar");
    expect(window.location.pathname).toBe("/start");
    expect(wrapper.find("h1").text()).toBe("¿Con qué rol quieres entrar?");
    expect(wrapper.findAll(".role-card").map((card) => card.text())).toEqual([
      expect.stringContaining("Tesorero"),
      expect.stringContaining("Financiero"),
      expect.stringContaining("Ventas"),
    ]);
  });

  it("paints Financiero and Ventas as the Embat team and Tesorero as the client", async () => {
    const wrapper = mountShell();
    await click(wrapper, "Empezar");
    const cards = wrapper.findAll(".role-card");
    expect(cards.map((card) => card.classes("embat"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(cards.map((card) => card.find(".role-team").text())).toEqual([
      "Cliente",
      "Equipo Embat",
      "Equipo Embat",
    ]);
  });

  it("enters the dashboard with the chosen role in the path", async () => {
    const wrapper = mountShell();
    await click(wrapper, "Empezar");
    await click(wrapper, "Tesorero");
    expect(window.location.pathname).toBe("/app/tesorero");
    expect(wrapper.find(".app-stub").text()).toBe("tesorero");
  });

  it("reads the dashboard role from the path on a direct load", () => {
    window.history.replaceState(null, "", "/app/ventas#COMP_0001");
    const wrapper = mountShell();
    expect(wrapper.find(".app-stub").text()).toBe("ventas");
  });

  it("opens the dashboard without a role when the path names none it knows", () => {
    window.history.replaceState(null, "", "/app/admin");
    const wrapper = mountShell();
    expect(wrapper.find(".app-stub").text()).toBe("none");
  });

  it("returns to the landing from the role page logo", async () => {
    const wrapper = mountShell();
    await click(wrapper, "Empezar");
    await wrapper
      .find('button[aria-label="Volver a la portada"]')
      .trigger("click");
    await flushPromises();
    expect(window.location.pathname).toBe("/");
    expect(wrapper.find("h1").text()).toContain("inteligencia artificial");
  });

  it("goes back to the role selection when the browser navigates back", async () => {
    const wrapper = mountShell();
    await click(wrapper, "Empezar");
    await click(wrapper, "Financiero");
    window.history.replaceState(null, "", "/start");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("¿Con qué rol quieres entrar?");
    expect(wrapper.find(".app-stub").exists()).toBe(false);
  });
});
