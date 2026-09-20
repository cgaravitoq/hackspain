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
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "../api.ts";
import { money, STATE_COLORS } from "../format.ts";
import {
  edgeAt,
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  layoutGraph,
  type NodePosition,
  nodeAt,
  selectLabelPositions,
  visibleEdges,
  visibleNodes,
} from "../graph-layout.ts";

const props = defineProps<{
  focusGroup: string | null;
  focusName: string | null;
}>();

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

const TYPE_VARIABLES: Record<RelationType, [string, string]> = {
  INFERRED_PAYMENT_TO: ["--relation-payment", "#3878f6"],
  OPEN_OBLIGATION_TO: ["--relation-obligation", "#ff9900"],
  SHARES_COUNTERPARTY_WITH: ["--relation-counterparty", "#9d4bdd"],
};

const TYPE_COLORS: Record<RelationType, string> = {
  INFERRED_PAYMENT_TO: "var(--relation-payment)",
  OPEN_OBLIGATION_TO: "var(--relation-obligation)",
  SHARES_COUNTERPARTY_WITH: "var(--relation-counterparty)",
};

const STATE_VARIABLES: Record<State, [string, string]> = {
  healthy: ["--healthy", "#1f7a4d"],
  improving: ["--improving", "#0f8a7a"],
  stable: ["--stable", "#6e707c"],
  slipping: ["--slipping", "#c2410c"],
  falling: ["--falling", "#b91c1c"],
  not_evaluable: ["--muted", "#a6a9b8"],
};

const GROUP_VARIABLES: [string, string][] = [
  ["--group-1", "#3878f6"],
  ["--group-2", "#9d4bdd"],
  ["--group-3", "#ff9900"],
  ["--group-4", "#c357ec"],
  ["--group-5", "#14a38b"],
];

const ISOLATED_ALPHA = 0.45;
const LABEL_HEIGHT = 16;
const LABEL_PADDING = 4;
const VIEW_MIN_SCALE = 0.15;
const VIEW_MAX_SCALE = 8;
const ZOOM_SPEED = 0.0015;
const DRAG_THRESHOLD = 3;
// Kept in sync with the .graph-panel width below: the panel flips to the
// node's left once it would no longer fit on the right of the viewport.
const PANEL_WIDTH = 240;
const PANEL_GAP = 14;

type Palette = {
  card: string;
  ink: string;
  inkSoft: string;
  states: Map<State, string>;
  types: Map<RelationType, string>;
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
const minConfidence = ref<RelationConfidence>("high");
const scope = ref<RelationScope | "all">("all");
const focus = ref<"group" | "all">(props.focusGroup ? "group" : "all");
const state = ref<State | "all">("all");
const query = ref("");
const hover = ref<
  | { kind: "node"; node: RelationNode }
  | { kind: "edge"; edge: RelationEdge }
  | null
>(null);
const pointer = ref({ x: 0, y: 0 });
const canvas = ref<HTMLCanvasElement | null>(null);
const frame = ref<HTMLDivElement | null>(null);
const box = ref({ width: LAYOUT_WIDTH, height: LAYOUT_HEIGHT });
const view = ref({ scale: 1, x: 0, y: 0 });
const isPanning = ref(false);
const selectedNode = ref<RelationNode | null>(null);
let graphRequest = 0;
let dragMoved = false;
let hasMeasuredBox = false;
let resizeObserver: ResizeObserver | undefined;
let panStart = { clientX: 0, clientY: 0, viewX: 0, viewY: 0 };

const emit = defineEmits<{
  analyze: [companyId: string];
}>();

const cursorStyle = computed(() => {
  if (isPanning.value) {
    return "grabbing";
  }
  return hover.value?.kind === "node" ? "pointer" : "grab";
});

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

const nodeNames = computed(
  () =>
    new Map(
      (graph.value?.nodes ?? []).map((node) => [node.company_id, node.name]),
    ),
);

function nodeName(companyId: string): string {
  return nodeNames.value.get(companyId) ?? companyId;
}

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
      title: node.name,
      lines: [
        `Grupo ${node.group_id ?? "sin grupo"} · ${node.degree} ${node.degree === 1 ? "relación" : "relaciones"}`,
        `Score ${node.score === null ? "–" : node.score} · ${STATE_LABELS[node.state]}`,
      ],
    };
  }
  const { edge } = hover.value;
  return {
    title: `${nodeName(edge.source)} → ${nodeName(edge.target)}`,
    lines: [
      `${TYPE_LABELS[edge.relation_type]} · ${SUBTYPE_LABELS[edge.subtype]}`,
      `confianza ${CONFIDENCE_LABELS[edge.confidence]} · ${edge.matches} coincidencias · ${SCOPE_LABELS[edge.scope]}`,
      `${money(edge.amount_minor / 100, edge.currency)} · ${edge.first_date} a ${edge.last_date}`,
      `evidencia ${EVIDENCE_LABELS[edge.evidence_level]} · ${CLAIM_LABELS[edge.claim_status]}, identidad del proveedor ${edge.provider_identity_confirmed ? "confirmada" : "sin confirmar"}`,
    ],
  };
});

const selectedEdges = computed(() => {
  const node = selectedNode.value;
  if (!node) {
    return [];
  }
  return visible.value.edges.filter(
    (edge) =>
      edge.source === node.company_id || edge.target === node.company_id,
  );
});

const tooltipStyle = computed(() => ({
  left: `${(pointer.value.x / box.value.width) * 100}%`,
  top: `${(pointer.value.y / box.value.height) * 100}%`,
}));

const panelPlacement = computed(() => {
  const node = selectedNode.value;
  if (!node) {
    return null;
  }
  const position = layout.value.positions.get(node.company_id);
  if (!position) {
    return null;
  }
  const x = position.x * view.value.scale + view.value.x;
  const y = position.y * view.value.scale + view.value.y;
  const side: "left" | "right" =
    x + PANEL_GAP + PANEL_WIDTH > box.value.width ? "left" : "right";
  return { x, y, side };
});

const panelStyle = computed(() => {
  const placement = panelPlacement.value;
  if (!placement) {
    return {};
  }
  const top = Math.min(Math.max(placement.y, 12), box.value.height - 12);
  return placement.side === "right"
    ? {
        top: `${top}px`,
        left: `${placement.x + PANEL_GAP}px`,
        transform: "translateY(-50%)",
      }
    : {
        top: `${top}px`,
        left: `${placement.x - PANEL_GAP}px`,
        transform: "translate(-100%, -50%)",
      };
});

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = ([variable, fallback]: [string, string]) =>
    style.getPropertyValue(variable).trim() || fallback;
  return {
    card: read(["--card", "#ffffff"]),
    ink: read(["--ink", "#050b2c"]),
    inkSoft: read(["--ink-soft", "#6e707c"]),
    states: new Map(states.map((item) => [item, read(STATE_VARIABLES[item])])),
    types: new Map(types.map((item) => [item, read(TYPE_VARIABLES[item])])),
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
    const width = context.measureText(node.name).width + LABEL_PADDING * 2;
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
    context.fillText(node.name, x, (box.top + box.bottom) / 2);
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
  const { width, height } = box.value;
  if (element.width !== width * ratio || element.height !== height * ratio) {
    element.width = width * ratio;
    element.height = height * ratio;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const palette = readPalette();
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.card;
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(view.value.x, view.value.y);
  context.scale(view.value.scale, view.value.scale);
  context.lineWidth = 1.2;
  for (const link of layout.value.links) {
    const hovered =
      hover.value?.kind === "edge" && hover.value.edge === link.edge;
    context.strokeStyle =
      palette.types.get(link.edge.relation_type) ?? palette.inkSoft;
    context.globalAlpha = hovered ? 1 : 0.7;
    context.lineWidth = hovered ? 2.4 : 1.2;
    context.beginPath();
    context.moveTo(link.source.x, link.source.y);
    context.lineTo(link.target.x, link.target.y);
    context.stroke();
  }
  context.globalAlpha = 1;
  const positions: NodePosition[] = [];
  const groupColors = new Map<string | null, string>();
  const colorForGroup = (group: string | null) => {
    let color = groupColors.get(group);
    if (!color) {
      color = bandColor(palette, group);
      groupColors.set(group, color);
    }
    return color;
  };
  for (const position of layout.value.positions.values()) {
    const { node, x, y, radius } = position;
    const hovered = hover.value?.kind === "node" && hover.value.node === node;
    const isHub = node.role === "group_treasury_hub";
    const baseAlpha = node.role === "isolated" ? ISOLATED_ALPHA : 1;
    const fill = palette.states.get(node.state) ?? palette.ink;
    const drawRadius = hovered ? radius * 1.15 : radius;

    context.beginPath();
    context.arc(x, y, radius + 2.5, 0, Math.PI * 2);
    context.strokeStyle = colorForGroup(node.group_id);
    context.globalAlpha = baseAlpha * (isHub ? 0.9 : 0.45);
    context.lineWidth = isHub ? 2 : 1;
    context.stroke();
    context.globalAlpha = baseAlpha;

    context.beginPath();
    context.arc(x, y, drawRadius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = hovered ? palette.ink : fill;
    context.lineWidth = hovered ? 2.2 : 1.4;
    context.stroke();
    context.globalAlpha = 1;
    positions.push(position);
  }
  paintLabels(context, palette, selectLabelPositions(positions));
  context.restore();
}

function rawPoint(event: MouseEvent | WheelEvent) {
  const element = canvas.value;
  if (!element) {
    return { x: 0, y: 0 };
  }
  const rect = element.getBoundingClientRect();
  return {
    x:
      ((event.clientX - rect.left) / (rect.width || box.value.width)) *
      box.value.width,
    y:
      ((event.clientY - rect.top) / (rect.height || box.value.height)) *
      box.value.height,
  };
}

function toLayoutPoint(x: number, y: number) {
  return {
    x: (x - view.value.x) / view.value.scale,
    y: (y - view.value.y) / view.value.scale,
  };
}

function canvasPoint(event: MouseEvent) {
  const raw = rawPoint(event);
  return toLayoutPoint(raw.x, raw.y);
}

function clampScale(value: number) {
  return Math.min(VIEW_MAX_SCALE, Math.max(VIEW_MIN_SCALE, value));
}

function zoomAt(x: number, y: number, factor: number) {
  const nextScale = clampScale(view.value.scale * factor);
  const applied = nextScale / view.value.scale;
  view.value = {
    scale: nextScale,
    x: x - (x - view.value.x) * applied,
    y: y - (y - view.value.y) * applied,
  };
}

function resetView() {
  const scale = clampScale(
    Math.min(
      box.value.width / LAYOUT_WIDTH,
      box.value.height / LAYOUT_HEIGHT,
    ) || 1,
  );
  view.value = {
    scale,
    x: (box.value.width - LAYOUT_WIDTH * scale) / 2,
    y: (box.value.height - LAYOUT_HEIGHT * scale) / 2,
  };
}

function applyBoxSize(width: number, height: number) {
  if (!hasMeasuredBox) {
    hasMeasuredBox = true;
    box.value = { width, height };
    resetView();
    return;
  }
  const centre = toLayoutPoint(box.value.width / 2, box.value.height / 2);
  box.value = { width, height };
  view.value = {
    ...view.value,
    x: width / 2 - centre.x * view.value.scale,
    y: height / 2 - centre.y * view.value.scale,
  };
}

function onWheel(event: WheelEvent) {
  const point = rawPoint(event);
  const factor = Math.exp(-event.deltaY * ZOOM_SPEED);
  zoomAt(point.x, point.y, factor);
}

function onMove(event: MouseEvent) {
  const raw = rawPoint(event);
  pointer.value = raw;
  const point = toLayoutPoint(raw.x, raw.y);
  const node = nodeAt(layout.value, point.x, point.y);
  if (node) {
    hover.value = { kind: "node", node };
    return;
  }
  const edge = edgeAt(layout.value, point.x, point.y);
  hover.value = edge ? { kind: "edge", edge } : null;
}

function onPointerDown(event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }
  isPanning.value = true;
  dragMoved = false;
  panStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    viewX: view.value.x,
    viewY: view.value.y,
  };
}

function onPointerMove(event: MouseEvent) {
  if (!isPanning.value) {
    onMove(event);
    return;
  }
  const element = canvas.value;
  const rect = element?.getBoundingClientRect();
  const scaleX = LAYOUT_WIDTH / (rect?.width || LAYOUT_WIDTH);
  const scaleY = LAYOUT_HEIGHT / (rect?.height || LAYOUT_HEIGHT);
  const dx = event.clientX - panStart.clientX;
  const dy = event.clientY - panStart.clientY;
  if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    dragMoved = true;
  }
  hover.value = null;
  view.value = {
    ...view.value,
    x: panStart.viewX + dx * scaleX,
    y: panStart.viewY + dy * scaleY,
  };
}

function onPointerUp() {
  isPanning.value = false;
}

function onLeave() {
  isPanning.value = false;
  hover.value = null;
}

function onClick(event: MouseEvent) {
  if (dragMoved) {
    dragMoved = false;
    return;
  }
  const point = canvasPoint(event);
  selectedNode.value = nodeAt(layout.value, point.x, point.y) ?? null;
}

function closePanel() {
  selectedNode.value = null;
}

function analyzeSelected() {
  if (selectedNode.value) {
    emit("analyze", selectedNode.value.company_id);
  }
}

async function load() {
  const request = ++graphRequest;
  error.value = "";
  try {
    const result = await api.graph({
      confidence: minConfidence.value,
      scope: scope.value === "all" ? undefined : scope.value,
      group_id:
        focus.value === "group" ? (props.focusGroup ?? undefined) : undefined,
      include_isolated: false,
    });
    if (request !== graphRequest) {
      return;
    }
    graph.value = result;
    hover.value = null;
    selectedNode.value = null;
    resetView();
  } catch (cause) {
    if (request === graphRequest) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    }
  }
}

watch([minConfidence, scope, focus], () => load());

watch(
  () => props.focusGroup,
  (nextGroup) => {
    const nextFocus = nextGroup ? "group" : "all";
    if (focus.value === nextFocus) {
      load();
      return;
    }
    focus.value = nextFocus;
  },
);

let paintScheduled = false;
function schedulePaint() {
  if (paintScheduled) {
    return;
  }
  paintScheduled = true;
  requestAnimationFrame(() => {
    paintScheduled = false;
    paint();
  });
}

watch([layout, hover, view], schedulePaint, { flush: "post" });

onMounted(() => {
  load();
  if (frame.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        applyBoxSize(width, height);
      }
    });
    resizeObserver.observe(frame.value);
  }
});

onUnmounted(() => resizeObserver?.disconnect());
</script>

<template>
  <section class="graph-screen">
    <div class="graph-toolbar panel">
      <label>
        Vista
        <select id="graph-focus" v-model="focus">
          <option v-if="focusGroup" value="group">
            Grupo de {{ focusName ?? focusGroup }}
          </option>
          <option value="all">Todo el mapa</option>
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
          placeholder="Buscar por nombre"
        />
      </label>
      <p class="graph-counter">{{ counter }}</p>
    </div>
    <p v-if="error" class="error panel">{{ error }}</p>
    <div class="graph-stage panel">
      <div ref="frame" class="graph-frame">
        <canvas
          ref="canvas"
          class="graph-canvas"
          :style="{ cursor: cursorStyle }"
          @mousedown="onPointerDown"
          @mousemove="onPointerMove"
          @mouseup="onPointerUp"
          @mouseleave="onLeave"
          @click="onClick"
          @wheel.prevent="onWheel"
        />
        <div class="graph-controls">
          <button
            type="button"
            title="Acercar"
            aria-label="Acercar"
            @click="zoomAt(box.width / 2, box.height / 2, 1.3)"
          >
            +
          </button>
          <button
            type="button"
            title="Alejar"
            aria-label="Alejar"
            @click="zoomAt(box.width / 2, box.height / 2, 1 / 1.3)"
          >
            −
          </button>
          <button
            type="button"
            title="Restablecer vista"
            aria-label="Restablecer vista"
            @click="resetView"
          >
            ⟲
          </button>
        </div>
        <div v-if="tooltip" class="graph-tooltip" role="tooltip" :style="tooltipStyle">
          <strong>{{ tooltip.title }}</strong>
          <span v-for="line in tooltip.lines" :key="line">{{ line }}</span>
        </div>
        <div
          v-if="selectedNode && panelPlacement"
          class="graph-panel"
          role="dialog"
          aria-label="Detalle de empresa"
          :style="panelStyle"
        >
          <header class="graph-panel-header">
            <strong>{{ selectedNode.name }}</strong>
            <button type="button" class="graph-panel-close" aria-label="Cerrar" @click="closePanel">
              ×
            </button>
          </header>
          <p class="graph-panel-meta">
            Grupo {{ selectedNode.group_id ?? "sin grupo" }} ·
            {{ selectedNode.degree }}
            {{ selectedNode.degree === 1 ? "relación" : "relaciones" }}
          </p>
          <p class="graph-panel-meta">
            Score {{ selectedNode.score === null ? "–" : selectedNode.score }} ·
            {{ STATE_LABELS[selectedNode.state] }}
          </p>
          <div class="graph-panel-edges">
            <p v-if="selectedEdges.length === 0" class="graph-panel-empty">
              Sin relaciones visibles con los filtros actuales.
            </p>
            <ul v-else>
              <li
                v-for="edge in selectedEdges"
                :key="`${edge.source}-${edge.target}-${edge.relation_type}`"
              >
                <span class="graph-panel-arc">
                  {{ edge.source === selectedNode.company_id ? "→" : "←" }}
                  {{
                    edge.source === selectedNode.company_id
                      ? nodeName(edge.target)
                      : nodeName(edge.source)
                  }}
                </span>
                <span class="graph-panel-type">{{ TYPE_LABELS[edge.relation_type] }}</span>
              </li>
            </ul>
          </div>
          <div class="graph-panel-actions">
            <button type="button" class="graph-panel-primary" @click="analyzeSelected">
              Ver gráfico
            </button>
          </div>
        </div>
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
  height: 100%;
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
  display: flex;
  flex: 1;
  min-height: 320px;
  padding: 8px;
}

.graph-frame {
  position: relative;
  flex: 1;
  min-height: 0;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  touch-action: none;
}

.graph-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  gap: 4px;
}

.graph-controls button {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgb(15 23 42 / 10%);
}

.graph-controls button:hover {
  color: var(--ink);
  border-color: var(--ink-soft);
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

.graph-panel {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 240px;
  max-height: min(70%, 360px);
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 8px 24px rgb(15 23 42 / 18%);
  font-size: 12px;
  color: var(--ink-soft);
  pointer-events: auto;
}

.graph-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink);
  font-size: 13px;
}

.graph-panel-close {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  line-height: 1;
  cursor: pointer;
}

.graph-panel-close:hover {
  background: var(--line);
}

.graph-panel-meta {
  margin: 0;
}

.graph-panel-edges {
  overflow-y: auto;
  max-height: 160px;
  border-top: 1px solid var(--line);
  padding-top: 6px;
}

.graph-panel-empty {
  margin: 0;
  color: var(--muted);
}

.graph-panel-edges ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.graph-panel-edges li {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.graph-panel-arc {
  color: var(--ink);
  font-weight: 600;
}

.graph-panel-actions {
  display: flex;
  gap: 6px;
}

.graph-panel-actions button {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}

.graph-panel-primary {
  border-color: var(--accent) !important;
  background: var(--accent) !important;
  color: #fff !important;
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
