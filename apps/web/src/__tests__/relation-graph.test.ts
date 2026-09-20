import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RelationGraph from "../components/RelationGraph.vue";
import { euro, money } from "../format.ts";
import { layoutGraph, type NodePosition } from "../graph-layout.ts";
import {
  fakeApi,
  filterGraph,
  graph,
  graphEdge,
  graphNode,
} from "./fixtures.ts";

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

  it("keeps only the relations at or above the minimum confidence", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    await wrapper.find("#graph-confidence").setValue("medium");
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("confidence=medium");
    expect(relations(wrapper)).toBe("3 relaciones");
  });

  it("asks for high confidence when the option labelled alta is chosen", async () => {
    const requests: string[] = [];
    const wrapper = await mountGraph(requests);
    const option = wrapper
      .find("#graph-confidence")
      .findAll("option")
      .find((candidate) => candidate.text() === "alta");
    await wrapper
      .find("#graph-confidence")
      .setValue(option?.attributes("value") ?? "");
    await flushPromises();
    await flushPromises();
    expect(requests.at(-1)).toContain("confidence=high");
    expect(relations(wrapper)).toBe("1 relación");
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
    await wrapper.find("#graph-search").setValue("mp_c");
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

  it("formats the amount of a relation in its own currency", async () => {
    const wrapper = await mountGraph();
    const { edge, x, y } = edgeMidpoint("COMP_D", "COMP_A");
    expect(edge.currency).toBe("GBP");
    await wrapper
      .find("canvas")
      .trigger("mousemove", { clientX: x, clientY: y });
    const tooltip = text(wrapper, ".graph-tooltip");
    expect(tooltip).toContain("COMP_D → COMP_A");
    expect(tooltip).toContain(money(edge.amount_minor / 100, "GBP"));
    expect(tooltip).not.toContain("€");
    expect(tooltip).toContain(
      "inferida, identidad del proveedor sin confirmar",
    );
  });

  it("drops the tooltip when a filter reloads the graph", async () => {
    const wrapper = await mountGraph();
    const { x, y } = edgeMidpoint("COMP_A", "COMP_B");
    await wrapper
      .find("canvas")
      .trigger("mousemove", { clientX: x, clientY: y });
    expect(wrapper.find(".graph-tooltip").exists()).toBe(true);
    await wrapper.find("#graph-scope").setValue("intergroup");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".graph-tooltip").exists()).toBe(false);
  });

  it("reads one relación on a company with a single relation", async () => {
    const pair = {
      ...graph,
      nodes: [
        graphNode("COMP_S", "GROUP_1", "healthy", 1),
        graphNode("COMP_T", "GROUP_1", "stable", 1),
      ],
      edges: [
        graphEdge(
          "COMP_S",
          "COMP_T",
          "INFERRED_PAYMENT_TO",
          "intragroup",
          "high",
        ),
      ],
    };
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json(pair)));
    mounted = mount(RelationGraph);
    await flushPromises();
    await flushPromises();
    const position = layoutGraph(pair.nodes, pair.edges).positions.get(
      "COMP_S",
    );
    await mounted.find("canvas").trigger("mousemove", {
      clientX: position?.x ?? 0,
      clientY: position?.y ?? 0,
    });
    expect(text(mounted, ".graph-tooltip")).toContain(
      "Grupo GROUP_1 · 1 relación",
    );
  });

  it("maps the pointer through the canvas box on screen", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_C");
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 50, width: 2000, height: 1280 }),
    );
    await wrapper.find("canvas").trigger("mousemove", {
      clientX: 100 + position.x * 2,
      clientY: 50 + position.y * 2,
    });
    expect(text(wrapper, ".graph-tooltip")).toContain("COMP_C");
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

  it("opens a detail panel with the company's relations instead of navigating", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_D");
    await wrapper.find("canvas").trigger("click", {
      clientX: position.x,
      clientY: position.y,
    });
    expect(window.location.hash).toBe("");
    const panel = text(wrapper, ".graph-panel");
    expect(panel).toContain("COMP_D");
    expect(panel).toContain("Ver gráfico");
    expect(panel).not.toContain("Comparar");
  });

  it("closes the detail panel and opens a different node's panel on click", async () => {
    const wrapper = await mountGraph();
    const first = drawn("COMP_D");
    await wrapper
      .find("canvas")
      .trigger("click", { clientX: first.x, clientY: first.y });
    const second = drawn("COMP_C");
    await wrapper
      .find("canvas")
      .trigger("click", { clientX: second.x, clientY: second.y });
    expect(text(wrapper, ".graph-panel")).toContain("COMP_C");
    await wrapper.find(".graph-panel-close").trigger("click");
    expect(wrapper.find(".graph-panel").exists()).toBe(false);
  });

  it("emits analyze with the selected company when Ver gráfico is clicked", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_D");
    await wrapper
      .find("canvas")
      .trigger("click", { clientX: position.x, clientY: position.y });
    await wrapper.find(".graph-panel-primary").trigger("click");
    expect(wrapper.emitted("analyze")).toEqual([["COMP_D"]]);
  });

  it("pans the graph so nodes track the drag distance", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_C");
    const canvasElement = wrapper.find("canvas");
    await canvasElement.trigger("mousedown", { clientX: 0, clientY: 0 });
    await canvasElement.trigger("mousemove", { clientX: 40, clientY: 15 });
    await canvasElement.trigger("mouseup");
    await canvasElement.trigger("mousemove", {
      clientX: position.x + 40,
      clientY: position.y + 15,
    });
    expect(text(wrapper, ".graph-tooltip")).toContain("COMP_C");
  });

  it("does not open the detail panel when the pointer dragged before release", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_D");
    const canvasElement = wrapper.find("canvas");
    await canvasElement.trigger("mousedown", { clientX: 0, clientY: 0 });
    await canvasElement.trigger("mousemove", { clientX: 50, clientY: 50 });
    await canvasElement.trigger("mouseup");
    await canvasElement.trigger("click", {
      clientX: position.x + 50,
      clientY: position.y + 50,
    });
    expect(wrapper.find(".graph-panel").exists()).toBe(false);
  });

  it("zooms toward the pointer on wheel, growing a node's hit area on screen", async () => {
    const wrapper = await mountGraph();
    const position = drawn("COMP_C");
    const canvasElement = wrapper.find("canvas");
    const nearMiss = {
      clientX: position.x + position.radius + 2,
      clientY: position.y,
    };
    await canvasElement.trigger("mousemove", nearMiss);
    expect(wrapper.find(".graph-tooltip").exists()).toBe(false);
    canvasElement.element.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: position.x,
        clientY: position.y,
        deltaY: -1000,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    await canvasElement.trigger("mousemove", nearMiss);
    expect(text(wrapper, ".graph-tooltip")).toContain("COMP_C");
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
