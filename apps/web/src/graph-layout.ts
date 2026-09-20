import type { RelationEdge, RelationNode, State } from "@hackspain/shared";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export const LAYOUT_WIDTH = 1000;
export const LAYOUT_HEIGHT = 640;
export const LAYOUT_SEED = 20260919;

export const PADDING = 30;
export const LINK_GAP = 24;
export const NODE_GAP = 8;
export const MAX_RADIUS = 22;

const TICKS = 300;
const MANY_BODY_STRENGTH = -40;
const MANY_BODY_REACH = 80;
const ANCHOR_STRENGTH = 0.08;
const JITTER = 28;
const MAX_SCALE = 8;
// Collisions swell the rim by about the same amount on both axes, so the
// anchors leave proportionally more of the shorter axis free for it.
const VERTICAL_REACH = 0.9;
const EDGE_TOLERANCE = 5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HUB_LABEL_DEGREE = 25;
const SMALL_GRAPH_LABEL_LIMIT = 40;

export type NodePosition = {
  node: RelationNode;
  x: number;
  y: number;
  radius: number;
};

export type GraphLink = {
  edge: RelationEdge;
  source: NodePosition;
  target: NodePosition;
};

export type GraphLayout = {
  positions: Map<string, NodePosition>;
  links: GraphLink[];
};

export type GraphFilters = {
  state: State | "all";
  query: string;
};

export function selectLabelPositions(
  positions: NodePosition[],
): NodePosition[] {
  const ordered = [...positions].sort(
    (left, right) => right.node.degree - left.node.degree,
  );
  return positions.length <= SMALL_GRAPH_LABEL_LIMIT
    ? ordered
    : ordered.filter(({ node }) => node.degree >= HUB_LABEL_DEGREE);
}

type SimNode = SimulationNodeDatum & { node: RelationNode; radius: number };
type SimLink = SimulationLinkDatum<SimNode> & { edge: RelationEdge };
type Point = { x: number; y: number };

export function nodeRadius(degree: number): number {
  return Math.min(2.5 + Math.sqrt(degree), 8);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function connectedComponents(
  nodes: RelationNode[],
  edges: RelationEdge[],
): RelationNode[][] {
  const known = new Set(nodes.map((node) => node.company_id));
  const neighbours = new Map<string, string[]>();
  for (const edge of edges) {
    if (!(known.has(edge.source) && known.has(edge.target))) {
      continue;
    }
    neighbours.set(edge.source, [
      ...(neighbours.get(edge.source) ?? []),
      edge.target,
    ]);
    neighbours.set(edge.target, [
      ...(neighbours.get(edge.target) ?? []),
      edge.source,
    ]);
  }
  const byId = new Map(nodes.map((node) => [node.company_id, node]));
  const visited = new Set<string>();
  const components: RelationNode[][] = [];
  for (const node of nodes) {
    if (visited.has(node.company_id)) {
      continue;
    }
    const component: RelationNode[] = [];
    const queue = [node.company_id];
    visited.add(node.company_id);
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) {
        break;
      }
      const member = byId.get(current);
      if (member) {
        component.push(member);
      }
      for (const neighbour of neighbours.get(current) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function footprint(component: RelationNode[]): number {
  return component.reduce(
    (total, node) => total + (nodeRadius(node.degree) + LINK_GAP / 2) ** 2,
    0,
  );
}

function componentAnchors(components: RelationNode[][]): Map<string, Point> {
  const ordered = [...components].sort(
    (left, right) =>
      right.length - left.length ||
      (left[0]?.company_id ?? "").localeCompare(right[0]?.company_id ?? ""),
  );
  const reach = {
    x: LAYOUT_WIDTH / 2 - PADDING,
    y: (LAYOUT_HEIGHT / 2 - PADDING) * VERTICAL_REACH,
  };
  const total = ordered.reduce(
    (sum, component) => sum + footprint(component),
    0,
  );
  const spread = Math.min(1, Math.sqrt(total / (reach.x * reach.y)));
  const anchors = new Map<string, Point>();
  let covered = 0;
  ordered.forEach((component, index) => {
    const area = footprint(component);
    const distance =
      ordered.length === 1 ? 0 : Math.sqrt((covered + area / 2) / total);
    covered += area;
    const angle = index * GOLDEN_ANGLE;
    const anchor = {
      x: LAYOUT_WIDTH / 2 + Math.cos(angle) * reach.x * spread * distance,
      y: LAYOUT_HEIGHT / 2 + Math.sin(angle) * reach.y * spread * distance,
    };
    for (const node of component) {
      anchors.set(node.company_id, anchor);
    }
  });
  return anchors;
}

function fitToCanvas(simulated: SimNode[]): Map<string, NodePosition> {
  const bounds = simulated.reduce(
    (accumulator, node) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      return {
        minX: Math.min(accumulator.minX, x - node.radius),
        maxX: Math.max(accumulator.maxX, x + node.radius),
        minY: Math.min(accumulator.minY, y - node.radius),
        maxY: Math.max(accumulator.maxY, y + node.radius),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const room = {
    x: LAYOUT_WIDTH - PADDING * 2,
    y: LAYOUT_HEIGHT - PADDING * 2,
  };
  const scale = Math.min(room.x / spanX, room.y / spanY, MAX_SCALE);
  const offsetX = PADDING + (room.x - spanX * scale) / 2 - bounds.minX * scale;
  const offsetY = PADDING + (room.y - spanY * scale) / 2 - bounds.minY * scale;
  return new Map(
    simulated.map((simulatedNode) => {
      const position: NodePosition = {
        node: simulatedNode.node,
        x: offsetX + (simulatedNode.x ?? 0) * scale,
        y: offsetY + (simulatedNode.y ?? 0) * scale,
        radius: Math.min(simulatedNode.radius * scale, MAX_RADIUS),
      };
      return [simulatedNode.node.company_id, position];
    }),
  );
}

export function layoutGraph(
  nodes: RelationNode[],
  edges: RelationEdge[],
): GraphLayout {
  const ordered = [...nodes].sort((left, right) =>
    left.company_id.localeCompare(right.company_id),
  );
  const known = new Set(ordered.map((node) => node.company_id));
  const visibleEdges = edges.filter(
    (edge) => known.has(edge.source) && known.has(edge.target),
  );
  const anchorOf = componentAnchors(connectedComponents(ordered, visibleEdges));
  const centre: Point = { x: LAYOUT_WIDTH / 2, y: LAYOUT_HEIGHT / 2 };
  const random = seededRandom(LAYOUT_SEED);
  const simulated: SimNode[] = ordered.map((node) => {
    const anchor = anchorOf.get(node.company_id) ?? centre;
    return {
      node,
      radius: nodeRadius(node.degree),
      x: anchor.x + (random() - 0.5) * JITTER,
      y: anchor.y + (random() - 0.5) * JITTER,
    };
  });
  const radiusOf = new Map(
    simulated.map((simulatedNode) => [
      simulatedNode.node.company_id,
      simulatedNode.radius,
    ]),
  );
  const links: SimLink[] = visibleEdges.map((edge) => ({
    edge,
    source: edge.source,
    target: edge.target,
  }));
  const simulation = forceSimulation(simulated)
    .randomSource(random)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.node.company_id)
        .distance(
          (link) =>
            (radiusOf.get(link.edge.source) ?? 0) +
            (radiusOf.get(link.edge.target) ?? 0) +
            LINK_GAP,
        )
        .strength(0.9),
    )
    .force(
      "charge",
      forceManyBody().strength(MANY_BODY_STRENGTH).distanceMax(MANY_BODY_REACH),
    )
    .force(
      "collide",
      forceCollide<SimNode>().radius((node) => node.radius + NODE_GAP),
    )
    .force(
      "x",
      forceX<SimNode>(
        (node) => (anchorOf.get(node.node.company_id) ?? centre).x,
      ).strength(ANCHOR_STRENGTH),
    )
    .force(
      "y",
      forceY<SimNode>(
        (node) => (anchorOf.get(node.node.company_id) ?? centre).y,
      ).strength(ANCHOR_STRENGTH),
    )
    .stop();
  simulation.tick(TICKS);
  const positions = fitToCanvas(simulated);
  const placed: GraphLink[] = visibleEdges.flatMap((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    return source && target ? [{ edge, source, target }] : [];
  });
  return { positions, links: placed };
}

export function matchesQuery(node: RelationNode, query: string): boolean {
  const text = query.trim().toUpperCase();
  return (
    text === "" ||
    node.name.toUpperCase().includes(text) ||
    node.company_id.toUpperCase().includes(text)
  );
}

export function visibleNodes(
  nodes: RelationNode[],
  filters: GraphFilters,
): RelationNode[] {
  return nodes.filter(
    (node) =>
      (filters.state === "all" || node.state === filters.state) &&
      matchesQuery(node, filters.query),
  );
}

export function visibleEdges(
  edges: RelationEdge[],
  nodes: RelationNode[],
): RelationEdge[] {
  const known = new Set(nodes.map((node) => node.company_id));
  return edges.filter(
    (edge) => known.has(edge.source) && known.has(edge.target),
  );
}

export function nodeAt(
  layout: GraphLayout,
  x: number,
  y: number,
): RelationNode | undefined {
  let hit: { node: RelationNode; distance: number } | undefined;
  for (const position of layout.positions.values()) {
    const distance = Math.hypot(position.x - x, position.y - y);
    if (distance > position.radius) {
      continue;
    }
    if (!hit || distance < hit.distance) {
      hit = { node: position.node, distance };
    }
  }
  return hit?.node;
}

function segmentDistance(
  x: number,
  y: number,
  source: NodePosition,
  target: NodePosition,
): number {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - source.x) * dx + (y - source.y) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(x - (source.x + ratio * dx), y - (source.y + ratio * dy));
}

export function edgeAt(
  layout: GraphLayout,
  x: number,
  y: number,
): RelationEdge | undefined {
  let hit: { edge: RelationEdge; distance: number } | undefined;
  for (const link of layout.links) {
    const distance = segmentDistance(x, y, link.source, link.target);
    if (distance > EDGE_TOLERANCE) {
      continue;
    }
    if (!hit || distance < hit.distance) {
      hit = { edge: link.edge, distance };
    }
  }
  return hit?.edge;
}
