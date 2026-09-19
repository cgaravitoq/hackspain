<script setup lang="ts">
import type { CompanyDetail, MonthEntry } from "@hackspain/shared";
import { computed, ref, useId } from "vue";
import { monthLabel } from "../format.ts";

const props = defineProps<{ companies: CompanyDetail[] }>();
const emit = defineEmits<{ remove: [companyId: string] }>();

const WIDTH = 960;
const HEIGHT = 320;
const PAD_LEFT = 44;
const PAD_RIGHT = 24;
const PAD_TOP = 24;
const PAD_BOTTOM = 32;
const RANGES = [6, 12, 24] as const;
const GRID = [0, 25, 50, 75, 100];
const FUTURE_STEPS = [1, 2, 3];
const SERIES_COLORS = ["#1d4ed8", "#b45309", "#0f766e"];
const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

type Point = { x: number; y: number };
type Marker = Point & { score: number; entry: MonthEntry };

const gradientId = useId();
const range = ref<(typeof RANGES)[number]>(24);
const hovered = ref<number | null>(null);

const windowMonths = computed(() =>
  [
    ...new Set(
      props.companies.flatMap((company) =>
        company.series.map((entry) => entry.month),
      ),
    ),
  ]
    .sort()
    .slice(-24),
);

const observedMonths = computed(() => windowMonths.value.slice(-range.value));

const months = computed(() => {
  const last = observedMonths.value.at(-1);
  if (!last) {
    return [];
  }
  const future = FUTURE_STEPS.map((offset) => {
    const date = new Date(`${last}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  });
  return [...observedMonths.value, ...future];
});

const todayX = computed(() => x(observedMonths.value.length - 1));

function x(index: number): number {
  const span = Math.max(months.value.length - 1, 1);
  return PAD_LEFT + (index / span) * (WIDTH - PAD_LEFT - PAD_RIGHT);
}

function y(score: number): number {
  return PAD_TOP + (1 - score / 100) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

function shortMonth(name: string): string {
  const [year, index] = name.split("-");
  return `${SHORT_MONTHS[Number(index) - 1]} ${year?.slice(2)}`;
}

function formatScore(score: number): string {
  return score.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

function coordinate(point: Point): string {
  return `${point.x},${point.y}`;
}

function sign(value: number): number {
  return value < 0 ? -1 : 1;
}

function slope3(before: Point, point: Point, after: Point): number {
  const h0 = point.x - before.x;
  const h1 = after.x - point.x;
  const s0 = (point.y - before.y) / h0;
  const s1 = (after.y - point.y) / h1;
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (
    (sign(s0) + sign(s1)) *
      Math.min(Math.abs(s0), Math.abs(s1), Math.abs(p) / 2) || 0
  );
}

function slope2(from: Point, to: Point, tangent: number): number {
  return ((3 * (to.y - from.y)) / (to.x - from.x) - tangent) / 2;
}

function bezier(from: Point, to: Point, t0: number, t1: number): string {
  const dx = (to.x - from.x) / 3;
  return `C${from.x + dx},${from.y + dx * t0} ${to.x - dx},${to.y - dx * t1} ${coordinate(to)}`;
}

function curve(points: Point[]): string {
  const [first, second] = points;
  const last = points.at(-1);
  const penultimate = points.at(-2);
  if (!(first && second && last && penultimate)) {
    return "";
  }
  if (points.length === 2) {
    return `M${coordinate(first)} L${coordinate(second)}`;
  }
  const tangents = points.map((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    return before && after ? slope3(before, point, after) : 0;
  });
  tangents[0] = slope2(first, second, tangents[1] ?? 0);
  tangents[tangents.length - 1] = slope2(
    penultimate,
    last,
    tangents.at(-2) ?? 0,
  );
  return [
    `M${coordinate(first)}`,
    ...points
      .slice(1)
      .map((point, index) =>
        bezier(
          points[index] ?? first,
          point,
          tangents[index] ?? 0,
          tangents[index + 1] ?? 0,
        ),
      ),
  ].join(" ");
}

function runs(entries: MonthEntry[]): Marker[][] {
  const byMonth = new Map(entries.map((entry) => [entry.month, entry]));
  const result: Marker[][] = [];
  let current: Marker[] = [];
  observedMonths.value.forEach((name, index) => {
    const entry = byMonth.get(name);
    if (!entry || entry.score === null) {
      if (current.length) {
        result.push(current);
      }
      current = [];
      return;
    }
    current.push({ x: x(index), y: y(entry.score), score: entry.score, entry });
  });
  if (current.length) {
    result.push(current);
  }
  return result;
}

function areaPath(run: Marker[]): string {
  const first = run[0];
  const last = run.at(-1);
  if (!(first && last)) {
    return "";
  }
  return `${curve(run)} L${last.x},${y(0)} L${first.x},${y(0)} Z`;
}

function buildSeries(company: CompanyDetail, color: string) {
  const segments = runs(company.series);
  const drawable = segments.filter((run) => run.length > 1);
  const markers = segments.flat();
  const last = markers.at(-1);
  const projected =
    company.trend_projection.status === "available"
      ? company.trend_projection.points
      : [];
  const scenarioPoints = (key: "base" | "favorable" | "adverse") =>
    projected.flatMap((point) => {
      const index = months.value.indexOf(point.month);
      return index === -1 ? [] : [`${x(index)},${y(point[key])}`];
    });
  const base = scenarioPoints("base");
  const favorable = scenarioPoints("favorable");
  const adverse = scenarioPoints("adverse");
  return {
    companyId: company.company_id,
    label: company.name,
    color,
    line: drawable.map(curve).join(" "),
    area: drawable.map(areaPath).join(" "),
    markers,
    dots: markers.filter((marker) => marker === last || marker.entry.events.E1),
    projected,
    projection:
      last && base.length ? [coordinate(last), ...base].join(" ") : "",
    band:
      last && favorable.length && adverse.length
        ? [coordinate(last), ...favorable, ...adverse.reverse()].join(" ")
        : "",
  };
}

const chartSeries = computed(() =>
  props.companies
    .slice(0, 3)
    .map((company, index) =>
      buildSeries(company, SERIES_COLORS[index] ?? SERIES_COLORS[0] ?? ""),
    ),
);

const labels = computed(() =>
  months.value
    .map((name, index) => ({ name, x: x(index), text: shortMonth(name) }))
    .filter((_, index) => (observedMonths.value.length - 1 - index) % 3 === 0),
);

const columns = computed(() =>
  months.value.map((name, index) => {
    const left = index === 0 ? PAD_LEFT : (x(index - 1) + x(index)) / 2;
    const right =
      index === months.value.length - 1
        ? WIDTH - PAD_RIGHT
        : (x(index) + x(index + 1)) / 2;
    return { name, x: left, width: right - left };
  }),
);

const tooltip = computed(() => {
  const index = hovered.value;
  const name = index === null ? undefined : months.value[index];
  if (index === null || !name) {
    return null;
  }
  const step = index - (observedMonths.value.length - 1);
  const rows = chartSeries.value.flatMap((item) => {
    if (step > 0) {
      const point = item.projected.find(
        (projection) => projection.month === name,
      );
      return point === undefined
        ? []
        : [
            {
              label: item.label,
              color: item.color,
              value: `proyección ${formatScore(point.base)}`,
            },
          ];
    }
    const marker = item.markers.find((point) => point.entry.month === name);
    return [
      {
        label: item.label,
        color: item.color,
        value: marker ? formatScore(marker.score) : "–",
      },
    ];
  });
  return {
    title: monthLabel(name),
    x: x(index),
    left: (x(index) / WIDTH) * 100,
    rows,
  };
});
</script>

<template>
  <div class="chart">
    <header class="chart-head">
      <h2>Evolución del score</h2>
      <div class="chart-controls">
        <div class="chart-companies" aria-label="Empresas comparadas">
          <span v-for="item in chartSeries" :key="item.companyId" class="chart-company">
            <i :style="{ background: item.color }" />
            {{ item.label }}
            <button
              type="button"
              :aria-label="`Quitar ${item.label}`"
              :disabled="chartSeries.length === 1"
              @click="emit('remove', item.companyId)"
            >
              ×
            </button>
          </span>
        </div>
        <div class="range" role="group" aria-label="Meses observados">
          <button
            v-for="option in RANGES"
            :key="option"
            type="button"
            :aria-pressed="range === option"
            @click="range = option"
          >
            {{ option }}M
          </button>
        </div>
      </div>
    </header>
    <div class="plot">
      <svg
        class="sparkline"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="`Evolución del score en ${range} meses y proyección por tendencia a 3 meses`"
        @pointerleave="hovered = null"
      >
        <defs>
          <linearGradient
            v-for="item in chartSeries"
            :id="`${gradientId}-${item.companyId}`"
            :key="item.companyId"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" :stop-color="item.color" stop-opacity="0.35" />
            <stop offset="1" :stop-color="item.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <template v-for="level in GRID" :key="level">
          <line
            :x1="PAD_LEFT"
            :x2="WIDTH - PAD_RIGHT"
            :y1="y(level)"
            :y2="y(level)"
            class="grid"
          />
          <text :x="PAD_LEFT - 10" :y="y(level) + 4" class="axis">{{ level }}</text>
        </template>
        <template v-if="observedMonths.length">
          <rect
            :x="todayX"
            :y="PAD_TOP"
            :width="WIDTH - PAD_RIGHT - todayX"
            :height="HEIGHT - PAD_TOP - PAD_BOTTOM"
            class="projection-area"
          />
          <line
            :x1="todayX"
            :x2="todayX"
            :y1="PAD_TOP"
            :y2="HEIGHT - PAD_BOTTOM"
            stroke-dasharray="1 3"
            class="today-marker"
          />
          <text :x="todayX" :y="PAD_TOP - 8" class="axis today-label">hoy</text>
        </template>
        <template v-for="item in chartSeries" :key="item.companyId">
          <path
            v-if="item.area"
            :d="item.area"
            :fill="`url(#${gradientId}-${item.companyId})`"
            class="series-area"
          />
          <polygon
            v-if="item.band"
            :points="item.band"
            :fill="item.color"
            fill-opacity="0.12"
            class="projection-band"
          />
          <path
            v-if="item.line"
            :d="item.line"
            :stroke="item.color"
            class="series-line"
          />
          <polyline
            v-if="item.projection"
            :points="item.projection"
            :stroke="item.color"
            stroke-dasharray="6 5"
            opacity="0.7"
            class="projection-line"
          />
          <circle
            v-for="point in item.dots"
            :key="`${item.companyId}-${point.entry.month}`"
            :cx="point.x"
            :cy="point.y"
            :r="point.entry.events.E1 ? 5.5 : 4.5"
            :fill="point.entry.events.E1 ? 'var(--falling)' : item.color"
            stroke="var(--card)"
            stroke-width="2"
          >
            <title>
              {{ item.label }} · {{ point.entry.month }}: {{ point.entry.score }} ·
              {{ point.entry.state }}
            </title>
          </circle>
        </template>
        <text
          v-for="label in labels"
          :key="label.name"
          :x="label.x"
          :y="HEIGHT - 10"
          class="axis month"
        >
          {{ label.text }}
        </text>
        <line
          v-if="tooltip"
          :x1="tooltip.x"
          :x2="tooltip.x"
          :y1="PAD_TOP"
          :y2="HEIGHT - PAD_BOTTOM"
          class="hover-line"
        />
        <rect
          v-for="(column, index) in columns"
          :key="column.name"
          :x="column.x"
          :y="PAD_TOP"
          :width="column.width"
          :height="HEIGHT - PAD_TOP - PAD_BOTTOM"
          class="hit"
          @pointerenter="hovered = index"
        />
      </svg>
      <div
        v-if="tooltip"
        class="tooltip"
        role="status"
        :style="{ left: `clamp(96px, ${tooltip.left}%, calc(100% - 96px))` }"
      >
        <strong>{{ tooltip.title }}</strong>
        <span v-for="row in tooltip.rows" :key="row.label">
          <i :style="{ background: row.color }" />
          {{ row.label }}
          <b>{{ row.value }}</b>
        </span>
      </div>
    </div>
    <div class="legend" aria-label="Leyenda de proyección">
      <span>
        <i class="projection-sample" />
        proyección por tendencia (3 meses)
      </span>
      <span>
        <i class="band-sample" />
        rango por tendencia
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.chart-controls,
.chart-companies,
.chart-company {
  display: flex;
  align-items: center;
}

.chart-controls {
  min-width: 0;
  gap: 14px;
}

.chart-companies {
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 12px;
}

.chart-company {
  gap: 6px;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.chart-company i {
  width: 18px;
  height: 3px;
  border-radius: 999px;
}

.chart-company button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  line-height: 1;
}

.chart-company button:not(:disabled):hover {
  background: var(--chip-bg);
  color: var(--ink);
}

.chart-company button:disabled {
  display: none;
}

.range {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
}

.range button {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}

.range button[aria-pressed="true"] {
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(22 32 42 / 0.12);
}

.plot {
  position: relative;
}

.sparkline {
  width: 100%;
  height: auto;
  display: block;
}

.grid {
  stroke: var(--line);
  stroke-opacity: 0.7;
}

.projection-area {
  fill: var(--muted);
  opacity: 0.07;
}

.today-marker {
  stroke: var(--muted);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.hover-line {
  stroke: var(--ink-soft);
  stroke-opacity: 0.5;
}

.series-line,
.projection-line {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hit {
  fill: transparent;
}

.axis {
  font-size: 15px;
  fill: var(--muted);
  text-anchor: end;
}

.month,
.today-label {
  text-anchor: middle;
}

.tooltip {
  position: absolute;
  top: 12px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 170px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 4px 16px rgb(22 32 42 / 0.12);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

.tooltip strong {
  color: var(--ink-soft);
  font-weight: 600;
}

.tooltip span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tooltip b {
  margin-left: auto;
  font-weight: 600;
}

.tooltip i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  color: var(--ink-soft);
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 18px;
  height: 3px;
  border-radius: 999px;
}

.legend .projection-sample {
  height: 0;
  border-top: 2px dashed currentColor;
  border-radius: 0;
  opacity: 0.6;
}

.legend .band-sample {
  height: 10px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.18;
}

@media (max-width: 760px) {
  .chart-head,
  .chart-controls {
    align-items: flex-start;
    flex-direction: column;
  }

  .chart-companies {
    justify-content: flex-start;
  }
}
</style>
