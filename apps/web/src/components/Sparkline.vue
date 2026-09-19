<script setup lang="ts">
import {
  type CompanyDetail,
  DEMO_COMPANY_NAMES,
  type MonthEntry,
} from "@hackspain/shared";
import { computed } from "vue";

const props = defineProps<{ companies: CompanyDetail[] }>();

const WIDTH = 520;
const HEIGHT = 140;
const PAD_X = 28;
const PAD_Y = 14;
const SERIES_COLORS = ["#1d4ed8", "#b45309", "#0f766e"];

const observedMonths = computed(() =>
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

const months = computed(() => {
  const last = observedMonths.value.at(-1);
  if (!last) {
    return [];
  }
  const future = [1, 2, 3].map((offset) => {
    const date = new Date(`${last}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  });
  return [...observedMonths.value, ...future];
});

const todayX = computed(() => x(observedMonths.value.length - 1));

function x(index: number): number {
  const span = Math.max(months.value.length - 1, 1);
  return PAD_X + (index / span) * (WIDTH - PAD_X * 2);
}

function y(score: number): number {
  return PAD_Y + (1 - score / 100) * (HEIGHT - PAD_Y * 2);
}

function companyLabel(companyId: string): string {
  return (
    Object.entries(DEMO_COMPANY_NAMES).find(
      ([, id]) => id === companyId,
    )?.[0] ?? companyId
  );
}

function segments(entries: MonthEntry[]): string[] {
  const byMonth = new Map(entries.map((entry) => [entry.month, entry]));
  const result: string[] = [];
  let current: string[] = [];
  observedMonths.value.forEach((month, index) => {
    const entry = byMonth.get(month);
    if (!entry || entry.score === null) {
      if (current.length > 1) {
        result.push(current.join(" "));
      }
      current = [];
      return;
    }
    current.push(`${x(index)},${y(entry.score)}`);
  });
  if (current.length > 1) {
    result.push(current.join(" "));
  }
  return result;
}

function points(entries: MonthEntry[]) {
  const byMonth = new Map(entries.map((entry) => [entry.month, entry]));
  return observedMonths.value.flatMap((month, index) => {
    const entry = byMonth.get(month);
    return entry?.score === null || !entry
      ? []
      : [{ x: x(index), y: y(entry.score), entry }];
  });
}

function projection(entries: MonthEntry[]): string {
  const last = points(entries).at(-1);
  if (!last || last.entry.score === null || last.entry.momentum === null) {
    return "";
  }
  const { score, momentum } = last.entry;
  return [
    `${last.x},${last.y}`,
    ...[1, 2, 3].map((step) => {
      const projected = Math.max(
        0,
        Math.min(100, score + (momentum * step) / 3),
      );
      return `${x(observedMonths.value.length - 1 + step)},${y(projected)}`;
    }),
  ].join(" ");
}

const chartSeries = computed(() =>
  props.companies.slice(0, 3).map((company, index) => ({
    companyId: company.company_id,
    label: companyLabel(company.company_id),
    color: SERIES_COLORS[index] ?? SERIES_COLORS[0],
    segments: segments(company.series),
    points: points(company.series),
    projection: projection(company.series),
  })),
);

const labels = computed(() =>
  months.value
    .map((month, index) => ({ month, x: x(index) }))
    .filter((_, index) => index % 6 === 0 || index === months.value.length - 1),
);
</script>

<template>
  <div class="chart">
    <svg
      class="sparkline"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="img"
      aria-label="Evolución del score en 24 meses y proyección por tendencia a 3 meses"
    >
      <template v-if="observedMonths.length">
        <rect
          :x="todayX"
          :y="PAD_Y"
          :width="WIDTH - PAD_X - todayX"
          :height="HEIGHT - PAD_Y * 2"
          class="projection-area"
        />
        <line
          :x1="todayX"
          :x2="todayX"
          :y1="PAD_Y"
          :y2="HEIGHT - PAD_Y"
          stroke-dasharray="1 3"
          class="today-marker"
        />
        <text :x="todayX" :y="PAD_Y - 4" class="axis today-label">hoy</text>
      </template>
      <line :x1="PAD_X" :x2="WIDTH - PAD_X" :y1="y(50)" :y2="y(50)" class="guide" />
      <text :x="PAD_X - 6" :y="y(100) + 4" class="axis">100</text>
      <text :x="PAD_X - 6" :y="y(50) + 4" class="axis">50</text>
      <text :x="PAD_X - 6" :y="y(0) + 4" class="axis">0</text>
      <template v-for="item in chartSeries" :key="item.companyId">
        <polyline
          v-for="(segment, index) in item.segments"
          :key="`${item.companyId}-${index}`"
          :points="segment"
          :stroke="item.color"
          class="series-line"
        />
        <polyline
          v-if="item.projection"
          :points="item.projection"
          :stroke="item.color"
          stroke-dasharray="5 4"
          opacity="0.6"
          class="projection-line"
        />
        <circle
          v-for="point in item.points"
          :key="`${item.companyId}-${point.entry.month}`"
          :cx="point.x"
          :cy="point.y"
          :r="point.entry.events.E1 ? 4.5 : 3"
          :fill="item.color"
          :stroke="point.entry.events.E1 ? 'var(--falling)' : 'none'"
          stroke-width="1.5"
        >
          <title>
            {{ item.label }} · {{ point.entry.month }}: {{ point.entry.score }} ·
            {{ point.entry.state }}
          </title>
        </circle>
      </template>
      <text
        v-for="label in labels"
        :key="label.month"
        :x="label.x"
        :y="HEIGHT - 1"
        class="axis month"
      >
        {{ label.month }}
      </text>
    </svg>
    <div class="legend" aria-label="Empresas comparadas">
      <span v-for="item in chartSeries" :key="item.companyId">
        <i :style="{ background: item.color }" />
        {{ item.label }}
      </span>
      <span>
        <i class="projection-sample" />
        proyección por tendencia (3 meses)
      </span>
    </div>
  </div>
</template>

<style scoped>
.sparkline {
  width: 100%;
  height: auto;
  display: block;
}

.guide {
  stroke: var(--line);
  stroke-dasharray: 4 4;
}

.projection-area {
  fill: var(--muted);
  opacity: 0.07;
}

.today-marker {
  stroke: var(--muted);
  stroke-linecap: round;
}

.series-line,
.projection-line {
  fill: none;
  stroke-width: 1.8;
}

.axis {
  font-size: 9px;
  fill: var(--muted);
  text-anchor: end;
}

.month,
.today-label {
  text-anchor: middle;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  margin-top: 4px;
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
</style>
