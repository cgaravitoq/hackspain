<script setup lang="ts">
import {
  type Graph,
  type RelationConfidence,
  type RelationEdge,
  type RelationNode,
  type RelationScope,
  type RelationType,
  STATE_LABELS,
  type State,
} from "@hackspain/shared";
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../api.ts";
import { money, STATE_COLORS } from "../format.ts";
import {
  edgeAt,
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  layoutGraph,
  type NodePosition,
  nodeAt,
  visibleEdges,
  visibleNodes,
} from "../graph-layout.ts";

const TYPE_LABELS: Record<RelationType, string> = {
  INFERRED_PAYMENT_TO: "pago inferido",
  OPEN_OBLIGATION_TO: "obligación abierta",
  SHARES_COUNTERPARTY_WITH: "contraparte compartida",
};

const SUBTYPE_LABELS: Record<RelationEdge["subtype"], string> = {
  cash_pooling: "caja común",
  credit_line_financing: "financiación de línea de crédito",
  payroll_on_behalf: "nóminas por cuenta de otra",
  taxes_on_behalf: "impuestos por cuenta de otra",
  funds_transfer: "transferencia de fondos",
  commercial_payment: "pago comercial",
  other_flows: "otros flujos",
  sale_to_purchase_invoice: "factura de venta y compra",
  in_house_bank_line: "línea de banco interno",
  client_portfolio_transfer: "traspaso de cartera de clientes",
  shared_supplier_or_client: "proveedor o cliente compartido",
};

const CONFIDENCE_LABELS: Record<RelationConfidence, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

const SCOPE_LABELS: Record<RelationScope, string> = {
  intragroup: "intragrupo",
  intergroup: "intergrupo",
};

const EVIDENCE_LABELS: Record<RelationEdge["evidence_level"], string> = {
  bank_mirror: "espejo bancario",
  invoice_mirror: "espejo de facturas",
  debt_balance_mirror: "espejo de deuda",
  shared_counterparty_id: "contraparte compartida",
};

const CLAIM_LABELS: Record<RelationEdge["claim_status"], string> = {
  inferred: "inferida",
};

const TYPE_COLORS: Record<RelationType, string> = {
  INFERRED_PAYMENT_TO: "#1d4ed8",
  OPEN_OBLIGATION_TO: "#b45309",
  SHARES_COUNTERPARTY_WITH: "#0f766e",
};

const STATE_VARIABLES: Record<State, [string, string]> = {
  healthy: ["--healthy", "#1f7a4d"],
  improving: ["--improving", "#0f766e"],
  stable: ["--stable", "#475569"],
  slipping: ["--slipping", "#b45309"],
  falling: ["--falling", "#b91c1c"],
  not_evaluable: ["--muted", "#94a3b8"],
};

const GROUP_VARIABLES: [string, string][] = [
  ["--group-1", "#5b7cfa"],
  ["--group-2", "#e0a33e"],
  ["--group-3", "#3fa87a"],
  ["--group-4", "#c264a0"],
  ["--group-5", "#7a86d8"],
];

const HUB_LABEL_DEGREE = 25;
const ISOLATED_ALPHA = 0.45;
const LABEL_HEIGHT = 16;
const LABEL_PADDING = 4;

type Palette = {
  card: string;
  ink: string;
  inkSoft: string;
  states: Map<State, string>;
  groups: string[];
};

type Box = { left: number; top: number; right: number; bottom: number };

const types: RelationType[] = [
  "INFERRED_PAYMENT_TO",
  "OPEN_OBLIGATION_TO",
  "SHARES_COUNTERPARTY_WITH",
];
const states: State[] = [
  "healthy",
  "improving",
  "stable",
  "slipping",
  "falling",
  "not_evaluable",
];
const confidences: RelationConfidence[] = ["low", "medium", "high"];
const scopes: RelationScope[] = ["intragroup", "intergroup"];

const graph = ref<Graph | null>(null);
const error = ref("");
const relationType = ref<RelationType | "all">("all");
const minConfidence = ref<RelationConfidence>("low");
const scope = ref<RelationScope | "all">("all");
const groupId = ref<string>("all");
const state = ref<State | "all">("all");
const query = ref("");
const includeIsolated = ref(false);
const knownGroups = ref<string[]>([]);
const hover = ref<
  | { kind: "node"; node: RelationNode }
  | { kind: "edge"; edge: RelationEdge }
  | null
>(null);
const pointer = ref({ x: 0, y: 0 });
const canvas = ref<HTMLCanvasElement | null>(null);
let graphRequest = 0;

const visible = computed<{ nodes: RelationNode[]; edges: RelationEdge[] }>(
  () => {
    if (!graph.value) {
      return { nodes: [], edges: [] };
    }
    const nodes = visibleNodes(graph.value.nodes, {
      state: state.value,
      query: query.value,
    });
    return { nodes, edges: visibleEdges(graph.value.edges, nodes) };
  },
);

const layout = computed(() =>
  layoutGraph(visible.value.nodes, visible.value.edges),
);

const counter = computed(() => {
  const { nodes, edges } = visible.value;
  const companies = nodes.length === 1 ? "empresa" : "empresas";
  const relations = edges.length === 1 ? "relación" : "relaciones";
  return `${nodes.length} ${companies}, ${edges.length} ${relations}`;
});

const tooltip = computed(() => {
  if (!hover.value) {
    return null;
  }
  if (hover.value.kind === "node") {
    const { node } = hover.value;
    return {
      title: node.company_id,
      lines: [
        `Grupo ${node.group_id ?? "sin grupo"} · ${node.degree} ${node.degree === 1 ? "relación" : "relaciones"}`,
        `Score ${node.score === null ? "–" : node.score} · ${STATE_LABELS[node.state]}`,
      ],
    };
  }
  const { edge } = hover.value;
  return {
    title: `${edge.source} → ${edge.target}`,
    lines: [
      `${TYPE_LABELS[edge.relation_type]} · ${SUBTYPE_LABELS[edge.subtype]}`,
      `confianza ${CONFIDENCE_LABELS[edge.confidence]} · ${edge.matches} coincidencias · ${SCOPE_LABELS[edge.scope]}`,
      `${money(edge.amount_minor / 100, edge.currency)} · ${edge.first_date} a ${edge.last_date}`,
      `evidencia ${EVIDENCE_LABELS[edge.evidence_level]} · ${CLAIM_LABELS[edge.claim_status]}, identidad del proveedor ${edge.provider_identity_confirmed ? "confirmada" : "sin confirmar"}`,
    ],
  };
});

const tooltipStyle = computed(() => ({
  left: `${(pointer.value.x / LAYOUT_WIDTH) * 100}%`,
  top: `${(pointer.value.y / LAYOUT_HEIGHT) * 100}%`,
}));

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = ([variable, fallback]: [string, string]) =>
    style.getPropertyValue(variable).trim() || fallback;
  return {
    card: read(["--card", "#ffffff"]),
    ink: read(["--ink", "#16202a"]),
    inkSoft: read(["--ink-soft", "#4b5865"]),
    states: new Map(states.map((item) => [item, read(STATE_VARIABLES[item])])),
    groups: GROUP_VARIABLES.map(read),
  };
}

function overlaps(box: Box, other: Box): boolean {
  return (
    box.left < other.right &&
    box.right > other.left &&
    box.top < other.bottom &&
    box.bottom > other.top
  );
}

function paintLabels(
  context: CanvasRenderingContext2D,
  palette: Palette,
  hubs: NodePosition[],
) {
  const drawn: Box[] = [];
  context.font = "11px 'IBM Plex Sans', system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const { node, x, y, radius } of hubs) {
    const width =
      context.measureText(node.company_id).width + LABEL_PADDING * 2;
    const box = {
      left: x - width / 2,
      right: x + width / 2,
      top: y - radius - LABEL_PADDING - LABEL_HEIGHT,
      bottom: y - radius - LABEL_PADDING,
    };
    if (drawn.some((other) => overlaps(box, other))) {
      continue;
    }
    drawn.push(box);
    context.globalAlpha = 0.85;
    context.fillStyle = palette.card;
    context.fillRect(box.left, box.top, width, LABEL_HEIGHT);
    context.globalAlpha = 1;
    context.fillStyle = palette.inkSoft;
    context.fillText(node.company_id, x, (box.top + box.bottom) / 2);
  }
}

function bandColor(palette: Palette, group: string | null): string {
  const index = [...(group ?? "")].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return palette.groups[index % palette.groups.length] ?? palette.ink;
}

function paint() {
  const element = canvas.value;
  if (!element) {
    return;
  }
  const context = element.getContext("2d");
  if (!context) {
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  if (element.width !== LAYOUT_WIDTH * ratio) {
    element.width = LAYOUT_WIDTH * ratio;
    element.height = LAYOUT_HEIGHT * ratio;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const palette = readPalette();
  context.clearRect(0, 0, LAYOUT_WIDTH, LAYOUT_HEIGHT);
  context.fillStyle = palette.card;
  context.fillRect(0, 0, LAYOUT_WIDTH, LAYOUT_HEIGHT);
  context.lineWidth = 1.2;
  for (const link of layout.value.links) {
    const hovered =
      hover.value?.kind === "edge" && hover.value.edge === link.edge;
    context.strokeStyle = TYPE_COLORS[link.edge.relation_type];
    context.globalAlpha = hovered ? 1 : 0.7;
    context.lineWidth = hovered ? 2.4 : 1.2;
    context.beginPath();
    context.moveTo(link.source.x, link.source.y);
    context.lineTo(link.target.x, link.target.y);
    context.stroke();
  }
  context.globalAlpha = 1;
  const hubs: NodePosition[] = [];
  for (const position of layout.value.positions.values()) {
    const { node, x, y, radius } = position;
    context.beginPath();
    context.arc(x, y, radius + 1.5, 0, Math.PI * 2);
    context.strokeStyle = bandColor(palette, node.group_id);
    context.lineWidth = node.role === "group_treasury_hub" ? 2 : 1;
    context.stroke();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    const hovered = hover.value?.kind === "node" && hover.value.node === node;
    context.globalAlpha = node.role === "isolated" ? ISOLATED_ALPHA : 1;
    const fill = palette.states.get(node.state) ?? palette.ink;
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = hovered ? palette.ink : fill;
    context.lineWidth = hovered ? 2 : 1.4;
    context.stroke();
    context.globalAlpha = 1;
    if (node.degree >= HUB_LABEL_DEGREE) {
      hubs.push(position);
    }
  }
  hubs.sort((left, right) => right.node.degree - left.node.degree);
  paintLabels(context, palette, hubs);
}

function canvasPoint(event: MouseEvent) {
  const element = canvas.value;
  if (!element) {
    return { x: 0, y: 0 };
  }
  const rect = element.getBoundingClientRect();
  return {
    x:
      ((event.clientX - rect.left) / (rect.width || LAYOUT_WIDTH)) *
      LAYOUT_WIDTH,
    y:
      ((event.clientY - rect.top) / (rect.height || LAYOUT_HEIGHT)) *
      LAYOUT_HEIGHT,
  };
}

function onMove(event: MouseEvent) {
  const point = canvasPoint(event);
  pointer.value = point;
  const node = nodeAt(layout.value, point.x, point.y);
  if (node) {
    hover.value = { kind: "node", node };
    return;
  }
  const edge = edgeAt(layout.value, point.x, point.y);
  hover.value = edge ? { kind: "edge", edge } : null;
}

function onClick(event: MouseEvent) {
  const point = canvasPoint(event);
  const node = nodeAt(layout.value, point.x, point.y);
  if (node) {
    window.location.hash = node.company_id;
  }
}

async function load() {
  const request = ++graphRequest;
  error.value = "";
  try {
    const result = await api.graph({
      type: relationType.value === "all" ? undefined : relationType.value,
      confidence: minConfidence.value,
      scope: scope.value === "all" ? undefined : scope.value,
      group_id: groupId.value === "all" ? undefined : groupId.value,
      include_isolated: includeIsolated.value,
    });
    if (request !== graphRequest) {
      return;
    }
    graph.value = result;
    knownGroups.value = [
      ...new Set([
        ...knownGroups.value,
        ...result.nodes.flatMap((node) => node.group_id ?? []),
      ]),
    ].sort();
  } catch (cause) {
    if (request === graphRequest) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    }
  }
}

watch([relationType, minConfidence, scope, groupId, includeIsolated], () =>
  load(),
);

watch([layout, hover], paint, { flush: "post" });

onMounted(load);
</script>

<template>
  <section class="graph-screen">
    <div class="graph-toolbar panel">
      <label>
        Tipo
        <select id="graph-type" v-model="relationType">
          <option value="all">Todos</option>
          <option v-for="item in types" :key="item" :value="item">
            {{ TYPE_LABELS[item] }}
          </option>
        </select>
      </label>
      <label>
        Confianza mínima
        <select id="graph-confidence" v-model="minConfidence">
          <option v-for="item in confidences" :key="item" :value="item">
            {{ CONFIDENCE_LABELS[item] }}
          </option>
        </select>
      </label>
      <label>
        Ámbito
        <select id="graph-scope" v-model="scope">
          <option value="all">Todos</option>
          <option v-for="item in scopes" :key="item" :value="item">
            {{ SCOPE_LABELS[item] }}
          </option>
        </select>
      </label>
      <label>
        Grupo
        <select id="graph-group" v-model="groupId">
          <option value="all">Todos</option>
          <option v-for="item in knownGroups" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>
      <label>
        Estado
        <select id="graph-state" v-model="state">
          <option value="all">Todos</option>
          <option v-for="item in states" :key="item" :value="item">
            {{ STATE_LABELS[item] }}
          </option>
        </select>
      </label>
      <label>
        Empresa
        <input
          id="graph-search"
          v-model="query"
          type="text"
          placeholder="COMP_0077"
        />
      </label>
      <label class="graph-toggle">
        <input id="graph-isolated" v-model="includeIsolated" type="checkbox" />
        Ver aisladas
      </label>
      <p class="graph-counter">{{ counter }}</p>
    </div>
    <p v-if="error" class="error panel">{{ error }}</p>
    <div class="graph-stage panel">
      <canvas
        ref="canvas"
        class="graph-canvas"
        :width="LAYOUT_WIDTH"
        :height="LAYOUT_HEIGHT"
        @mousemove="onMove"
        @mouseleave="hover = null"
        @click="onClick"
      />
      <div v-if="tooltip" class="graph-tooltip" role="tooltip" :style="tooltipStyle">
        <strong>{{ tooltip.title }}</strong>
        <span v-for="line in tooltip.lines" :key="line">{{ line }}</span>
      </div>
    </div>
    <div class="graph-legend">
      <span v-for="item in states" :key="item">
        <i :style="{ background: STATE_COLORS[item] }" />
        {{ STATE_LABELS[item] }}
      </span>
      <span v-for="item in types" :key="item">
        <i class="line" :style="{ background: TYPE_COLORS[item] }" />
        {{ TYPE_LABELS[item] }}
      </span>
      <span>el halo marca el grupo</span>
    </div>
  </section>
</template>

<style scoped>
.graph-screen {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.graph-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 16px;
  padding: 12px 16px;
}

.graph-toolbar label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
}

.graph-toolbar select,
.graph-toolbar input[type="text"] {
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
}

.graph-toolbar input[type="text"] {
  width: 130px;
}

.graph-toggle {
  flex-direction: row !important;
  align-items: center;
  gap: 6px !important;
  padding-bottom: 6px;
  font-weight: 600;
}

.graph-toggle input {
  margin: 0;
}

.graph-counter {
  margin: 0 0 6px auto;
  font-weight: 600;
}

.graph-stage {
  position: relative;
  min-height: 0;
  padding: 8px;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  cursor: pointer;
}

.graph-tooltip {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  max-width: 340px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 6px 18px rgb(15 23 42 / 16%);
  font-size: 12px;
  color: var(--ink-soft);
  pointer-events: none;
  transform: translate(12px, 12px);
}

.graph-tooltip strong {
  color: var(--ink);
}

.graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  color: var(--ink-soft);
  font-size: 12px;
}

.graph-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.graph-legend i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.graph-legend i.line {
  width: 16px;
  height: 3px;
  border-radius: 999px;
}
</style>
