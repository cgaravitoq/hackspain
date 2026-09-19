import { describe, expect, it } from "vitest";
import {
  edgeAt,
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  LINK_GAP,
  layoutGraph,
  NODE_GAP,
  nodeAt,
  nodeRadius,
  PADDING,
} from "../graph-layout.ts";
import { filterGraph, starGraph } from "./fixtures.ts";

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

  it("hits the company drawn under the pointer and nothing in the margin", () => {
    const layout = layoutGraph(connected.nodes, connected.edges);
    const position = layout.positions.get("COMP_A");
    expect(position).toBeDefined();
    expect(nodeAt(layout, position?.x ?? 0, position?.y ?? 0)?.company_id).toBe(
      "COMP_A",
    );
    expect(nodeAt(layout, 0, 0)).toBeUndefined();
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
