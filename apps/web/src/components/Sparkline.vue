<script setup lang="ts">
import type { MonthEntry } from "@hackspain/shared";
import { computed } from "vue";
import { STATE_COLORS } from "../format.ts";

const props = defineProps<{ series: MonthEntry[] }>();

const WIDTH = 520;
const HEIGHT = 140;
const PAD_X = 28;
const PAD_Y = 14;

const last = computed(() => props.series.slice(-24));

function x(index: number): number {
  const span = Math.max(last.value.length - 1, 1);
  return PAD_X + (index / span) * (WIDTH - PAD_X * 2);
}

function y(score: number): number {
  return PAD_Y + (1 - score / 100) * (HEIGHT - PAD_Y * 2);
}

const points = computed(() =>
  last.value.flatMap((entry, index) =>
    entry.score === null ? [] : [{ x: x(index), y: y(entry.score), entry }],
  ),
);

const segments = computed(() => {
  const result: string[] = [];
  let current: string[] = [];
  last.value.forEach((entry, index) => {
    if (entry.score === null) {
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
});

const labels = computed(() =>
  last.value
    .map((entry, index) => ({ month: entry.month, x: x(index) }))
    .filter((_, index) => index % 6 === 0 || index === last.value.length - 1),
);
</script>

<template>
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
    <polyline v-for="segment in segments" :key="segment" :points="segment" class="line" />
    <circle
      v-for="point in points"
      :key="point.entry.month"
      :cx="point.x"
      :cy="point.y"
      :r="point.entry.events.E1 ? 4.5 : 3"
      :fill="STATE_COLORS[point.entry.state]"
      :stroke="point.entry.events.E1 ? 'var(--falling)' : 'none'"
      stroke-width="1.5"
    >
      <title>{{ point.entry.month }}: {{ point.entry.score }} · {{ point.entry.state }}</title>
    </circle>
    <text v-for="label in labels" :key="label.month" :x="label.x" :y="HEIGHT - 1" class="axis month">
      {{ label.month }}
    </text>
  </svg>
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

.line {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.6;
}

.axis {
  font-size: 9px;
  fill: var(--muted);
  text-anchor: end;
}

.month {
  text-anchor: middle;
}
</style>
