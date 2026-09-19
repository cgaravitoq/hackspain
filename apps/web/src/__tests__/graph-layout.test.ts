import { describe, expect, it } from "vitest";
import {
  edgeAt,
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  layoutGraph,
  nodeAt,
} from "../graph-layout.ts";
import { filterGraph } from "./fixtures.ts";

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
