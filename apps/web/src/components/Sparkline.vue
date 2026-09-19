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

const months = computed(() =>
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
  months.value.forEach((month, index) => {
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
  return months.value.flatMap((month, index) => {
    const entry = byMonth.get(month);
    return entry?.score === null || !entry
      ? []
      : [{ x: x(index), y: y(entry.score), entry }];
  });
}

const chartSeries = computed(() =>
  props.companies.slice(0, 3).map((company, index) => ({
    companyId: company.company_id,
    label: companyLabel(company.company_id),
    color: SERIES_COLORS[index] ?? SERIES_COLORS[0],
    segments: segments(company.series),
    points: points(company.series),
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
      aria-label="Evolución del score en 24 meses"
    >
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

.series-line {
  fill: none;
  stroke-width: 1.8;
}

.axis {
  font-size: 9px;
  fill: var(--muted);
  text-anchor: end;
}

.month {
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
</style>
