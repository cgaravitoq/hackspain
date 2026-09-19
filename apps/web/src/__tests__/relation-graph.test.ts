import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RelationGraph from "../components/RelationGraph.vue";
import { euro } from "../format.ts";
import { layoutGraph, type NodePosition } from "../graph-layout.ts";
import { fakeApi, filterGraph } from "./fixtures.ts";

let mounted: VueWrapper | undefined;
let lastGraphRequest = "/api/graph?";

function trace(requests: string[]) {
  const base = fakeApi([]);
  return (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input), "https://web.test");
    requests.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/api/graph") {
      lastGraphRequest = `${url.pathname}${url.search}`;
    }
    return base(input);
  };
}

async function mountGraph(requests: string[] = []) {
  vi.stubGlobal("fetch", trace(requests));
  mounted = mount(RelationGraph);
  await flushPromises();
  await flushPromises();
  return mounted;
}

function text(wrapper: VueWrapper, selector: string) {
  return wrapper.find(selector).text();
}

function relations(wrapper: VueWrapper) {
  return text(wrapper, ".graph-counter").split(", ")[1];
}

function graphOnScreen() {
  return filterGraph(new URL(`https://web.test${lastGraphRequest}`));
}

function drawn(companyId: string): NodePosition {
  const { nodes, edges } = graphOnScreen();
  const position = layoutGraph(nodes, edges).positions.get(companyId);
  if (!position) {
    throw new Error(`${companyId} is not drawn`);
  }
  return position;
}

function edgeMidpoint(source: string, target: string) {
  const { nodes, edges } = graphOnScreen();
  const link = layoutGraph(nodes, edges).links.find(
    (candidate) =>
      candidate.edge.source === source && candidate.edge.target === target,
  );
  if (!link) {
    throw new Error(`${source} -> ${target} is not drawn`);
  }
  return {
    edge: link.edge,
    x: (link.source.x + link.target.x) / 2,
    y: (link.source.y + link.target.y) / 2,
  };
}

beforeEach(() => {
  lastGraphRequest = "/api/graph?";
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  mounted?.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("RelationGraph", () => {
  it("asks the agent for the graph and counts what it answers", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    expect(requests.some((request) => request.startsWith("/api/graph?"))).toBe(
      true,
    );
    expect(relations(wrapper)).toBe("5 relaciones");
  });

  it("keeps only the relations of the chosen type", async () => {
    const wrapper = await mountGraph();
    await wrapper.find("#graph-type").setValue("OPEN_OBLIGATION_TO");
    await flushPromises();
    await flushPromises();
    expect(relations(wrapper)).toBe("1 relación");
    await wrapper.find("#graph-type").setValue("all");
    await flushPromises();
    await flushPromises();
    expect(relations(wrapper)).toBe("5 relaciones");
  });

  it("keeps only the relations at or above the minimum confidence", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    await wrapper.find("#graph-confidence").setValue("medium");
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("confidence=medium");
    expect(relations(wrapper)).toBe("3 relaciones");
  });

  it("keeps only the relations of the chosen scope", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    await wrapper.find("#graph-scope").setValue("intergroup");
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("scope=intergroup");
    expect(relations(wrapper)).toBe("3 relaciones");
  });

  it("keeps only the companies of the chosen group", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    await wrapper.find("#graph-group").setValue("GROUP_1");
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("group_id=GROUP_1");
    expect(text(wrapper, ".graph-counter")).toBe("3 empresas, 2 relaciones");
  });

  it("hides the isolated companies until the toggle asks for them", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    expect(text(wrapper, ".graph-counter")).toBe("4 empresas, 5 relaciones");
    await wrapper.find("#graph-isolated").setValue(true);
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("include_isolated=true");
    expect(text(wrapper, ".graph-counter")).toBe("6 empresas, 5 relaciones");
  });

  it("keeps only the companies of the chosen state", async () => {
    const wrapper = await mountGraph();
    await wrapper.find("#graph-state").setValue("stable");
    await flushPromises();
    expect(text(wrapper, ".graph-counter")).toBe("2 empresas, 1 relación");
  });

  it("keeps only the company whose id is typed, without asking the agent again", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    const before = requests.length;
    await wrapper.find("#graph-search").setValue("COMP_C");
    await flushPromises();
    expect(text(wrapper, ".graph-counter")).toBe("1 empresa, 0 relaciones");
    expect(requests).toHaveLength(before);
    await wrapper.find("#graph-search").setValue("");
    await flushPromises();
    expect(relations(wrapper)).toBe("5 relaciones");
  });

  it("shows the evidence of the relation under the pointer", async () => {
    const wrapper = await mountGraph();
    const { edge, x, y } = edgeMidpoint("COMP_A", "COMP_B");
    await wrapper
      .find("canvas")
      .trigger("mousemove", { clientX: x, clientY: y });
    const tooltip = text(wrapper, ".graph-tooltip");
    expect(tooltip).toContain("COMP_A → COMP_B");
    expect(tooltip).toContain("pago inferido");
    expect(tooltip).toContain("transferencia de fondos");
    expect(tooltip).toContain("confianza alta");
    expect(tooltip).toContain(`${edge.matches} coincidencias`);
    expect(tooltip).toContain(euro(edge.amount_minor / 100));
    expect(tooltip).toContain(edge.first_date);
    expect(tooltip).toContain(edge.last_date);
    expect(tooltip).toContain("inferida");
    await wrapper.find("canvas").trigger("mouseleave");
    expect(wrapper.find(".graph-tooltip").exists()).toBe(false);
  });

  it("shows the id, group, score and state of the company under the pointer", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_C");
    await wrapper.find("canvas").trigger("mousemove", {
      clientX: position.x,
      clientY: position.y,
    });
    const tooltip = text(wrapper, ".graph-tooltip");
    expect(tooltip).toContain("COMP_C");
    expect(tooltip).toContain("Grupo GROUP_1 · 2 relaciones");
    expect(tooltip).toContain("Score 50");
    expect(tooltip).toContain("estable");
  });

  it("navigates to the company of the clicked node", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_D");
    await wrapper.find("canvas").trigger("click", {
      clientX: position.x,
      clientY: position.y,
    });
    expect(window.location.hash).toBe("#COMP_D");
  });

  it("reports the endpoint that failed instead of the graph", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("No relations loaded", { status: 404 })),
    );
    mounted = mount(RelationGraph);
    await flushPromises();
    const message = text(mounted, ".error");
    expect(message).toContain("/graph?");
    expect(message).toContain("answered 404");
  });
});
