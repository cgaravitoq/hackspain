import { describe, expect, it } from "vitest";
import {
  edgeAt,
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  LINK_GAP,
  layoutGraph,
  MAX_RADIUS,
  NODE_GAP,
  nodeAt,
  nodeRadius,
  PADDING,
} from "../graph-layout.ts";
import { filterGraph, graphEdge, graphNode, starGraph } from "./fixtures.ts";

const connected = filterGraph(
  new URL("https://web.test/api/graph?include_isolated=false"),
);

function positions() {
  const layout = layoutGraph(connected.nodes, connected.edges);
  return [...layout.positions.entries()].map(([id, position]) => [
    id,
    position.x,
    position.y,
  ]);
}

function crowded() {
  const { nodes, edges } = starGraph(60, 4);
  const layout = layoutGraph(nodes, edges);
  const leaf = layout.positions.get("HUB_000_0");
  return { layout, scale: (leaf?.radius ?? 0) / nodeRadius(1) };
}

describe("graph layout", () => {
  it("lays the same graph out at the same positions twice", () => {
    expect(positions()).toEqual(positions());
    for (const [, x, y] of positions()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(LAYOUT_WIDTH);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(LAYOUT_HEIGHT);
    }
  });

  it("leaves a visible gap on every relation between its two companies", () => {
    const { layout, scale } = crowded();
    expect(layout.links).toHaveLength(240);
    for (const link of layout.links) {
      const distance = Math.hypot(
        link.target.x - link.source.x,
        link.target.y - link.source.y,
      );
      const gap = distance - link.source.radius - link.target.radius;
      expect(gap).toBeGreaterThanOrEqual((LINK_GAP - 6) * scale);
      expect(gap).toBeGreaterThan(2 * NODE_GAP * scale);
    }
  });

  it("brings a graph wider than the canvas back inside the padding", () => {
    const { layout, scale } = crowded();
    expect(scale).toBeLessThan(1);
    for (const { x, y, radius } of layout.positions.values()) {
      expect(Math.round(x - radius)).toBeGreaterThanOrEqual(PADDING);
      expect(Math.round(x + radius)).toBeLessThanOrEqual(
        LAYOUT_WIDTH - PADDING,
      );
      expect(Math.round(y - radius)).toBeGreaterThanOrEqual(PADDING);
      expect(Math.round(y + radius)).toBeLessThanOrEqual(
        LAYOUT_HEIGHT - PADDING,
      );
    }
  });

  it("draws a company with more relations as a bigger circle", () => {
    expect(nodeRadius(4)).toBeGreaterThan(nodeRadius(1));
    const { layout } = crowded();
    const hub = layout.positions.get("HUB_000")?.radius ?? 0;
    const leaf = layout.positions.get("HUB_000_0")?.radius ?? 0;
    expect(hub).toBeGreaterThan(leaf);
  });

  it("draws two disconnected components apart", () => {
    const { nodes, edges } = starGraph(2, 3);
    const layout = layoutGraph(nodes, edges);
    const box = (hub: string) => {
      const members = [...layout.positions.values()].filter((position) =>
        position.node.company_id.startsWith(hub),
      );
      expect(members).toHaveLength(4);
      return {
        left: Math.min(...members.map((member) => member.x - member.radius)),
        right: Math.max(...members.map((member) => member.x + member.radius)),
        top: Math.min(...members.map((member) => member.y - member.radius)),
        bottom: Math.max(...members.map((member) => member.y + member.radius)),
      };
    };
    const first = box("HUB_000");
    const second = box("HUB_001");
    const apart =
      first.right < second.left ||
      second.right < first.left ||
      first.bottom < second.top ||
      second.bottom < first.top;
    expect(apart).toBe(true);
  });

  it("spreads a two-company graph across the canvas", () => {
    const nodes = [
      graphNode("COMP_X", "GROUP_1", "healthy", 1),
      graphNode("COMP_Y", "GROUP_1", "falling", 1),
    ];
    const edges = [
      graphEdge(
        "COMP_X",
        "COMP_Y",
        "INFERRED_PAYMENT_TO",
        "intragroup",
        "high",
      ),
    ];
    const layout = layoutGraph(nodes, edges);
    const [first, second] = [...layout.positions.values()];
    expect(
      Math.hypot(
        (first?.x ?? 0) - (second?.x ?? 0),
        (first?.y ?? 0) - (second?.y ?? 0),
      ),
    ).toBeGreaterThan(LAYOUT_WIDTH / 5);
    expect(first?.radius).toBe(MAX_RADIUS);
    expect(second?.radius).toBe(MAX_RADIUS);
  });

  it("hits the company drawn under the pointer and nothing in the margin", () => {
    const layout = layoutGraph(connected.nodes, connected.edges);
    const position = layout.positions.get("COMP_A");
    expect(position).toBeDefined();
    expect(nodeAt(layout, position?.x ?? 0, position?.y ?? 0)?.company_id).toBe(
      "COMP_A",
    );
    expect(nodeAt(layout, 0, 0)).toBeUndefined();
  });

  it("hits a company only inside its drawn circle", () => {
    const layout = layoutGraph(connected.nodes, connected.edges);
    const { x, y, radius } = layout.positions.get("COMP_A") ?? {
      x: 0,
      y: 0,
      radius: 0,
    };
    expect(radius).toBeGreaterThan(4);
    expect(nodeAt(layout, x + radius - 1, y)?.company_id).toBe("COMP_A");
    expect(nodeAt(layout, x + radius + 3, y)).toBeUndefined();
  });

  it("hits the relation drawn between two companies", () => {
    const layout = layoutGraph(connected.nodes, connected.edges);
    const link = layout.links.find(
      (candidate) =>
        candidate.edge.source === "COMP_A" &&
        candidate.edge.target === "COMP_B",
    );
    expect(link).toBeDefined();
    const x = ((link?.source.x ?? 0) + (link?.target.x ?? 0)) / 2;
    const y = ((link?.source.y ?? 0) + (link?.target.y ?? 0)) / 2;
    expect(edgeAt(layout, x, y)).toBe(link?.edge);
  });
});
