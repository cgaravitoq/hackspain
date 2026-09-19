<script setup lang="ts">
import type { Alert, CompanyDetail, Explain } from "@hackspain/shared";
import { computed } from "vue";
import { monthLabel, points, STATE_COLORS } from "../format.ts";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

const props = defineProps<{
  company: CompanyDetail;
  explanation: Explain;
  alerts: Alert[];
}>();

type Direction = "up" | "down" | "flat";
type KpiCard = {
  label: string;
  value: string;
  color?: string;
  chip?: { text: string; color: string };
  pill: string;
  direction: Direction | null;
  trend: string;
  caption: string;
};

const ARROWS: Record<Direction, string> = { up: "▲", down: "▼", flat: "▶" };
const DIRECTION_COLORS: Record<Direction, string> = {
  up: "var(--healthy)",
  down: "var(--falling)",
  flat: "var(--stable)",
};

function direction(value: number | null): Direction | null {
  if (value === null) {
    return null;
  }
  if (value > 0) {
    return "up";
  }
  return value < 0 ? "down" : "flat";
}

function arrow(value: number | null): string {
  const way = direction(value);
  return way === null ? "–" : ARROWS[way];
}

function shift(month: string, months: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 7);
}

const previousScore = computed(
  () =>
    props.company.series.filter((entry) => entry.score !== null).at(-2)
      ?.score ?? null,
);

const monthDelta = computed(() => {
  const now = props.explanation.score;
  const before = previousScore.value;
  return now === null || before === null ? null : now - before;
});

function deltaCard(
  label: string,
  value: number | null,
  months: number,
): KpiCard {
  const way = direction(value);
  return {
    label,
    value: points(value),
    color: way === null ? undefined : DIRECTION_COLORS[way],
    pill: arrow(value),
    direction: way,
    trend: `vs hace ${months} meses`,
    caption: `desde ${monthLabel(shift(props.explanation.month, months))}`,
  };
}

const cards = computed<KpiCard[]>(() => {
  const worsening = props.alerts.filter(
    (alert) => alert.kind === "down",
  ).length;
  return [
    {
      label: "Score",
      value:
        props.explanation.score === null
          ? "–"
          : String(props.explanation.score),
      color: STATE_COLORS[props.explanation.state],
      chip: {
        text: props.explanation.state_label,
        color: STATE_COLORS[props.explanation.state],
      },
      pill:
        monthDelta.value === null
          ? "–"
          : `${arrow(monthDelta.value)} ${points(monthDelta.value)}`,
      direction: direction(monthDelta.value),
      trend: "vs mes anterior",
      caption: monthLabel(props.explanation.month),
    },
    deltaCard("Δ 3 meses", props.company.latest.delta_3, 3),
    deltaCard("Δ 6 meses", props.company.latest.delta_6, 6),
    {
      label: "Alertas del mes",
      value: String(props.alerts.length),
      pill: `${worsening > 0 ? "▼" : "▶"} ${worsening}`,
      direction: worsening > 0 ? "down" : "flat",
      trend: "empeoran",
      caption: monthLabel(props.explanation.month),
    },
  ];
});
</script>

<template>
  <div class="kpis">
    <Card v-for="card in cards" :key="card.label" class="panel kpi">
      <header class="kpi-head">
        <span class="kpi-label">{{ card.label }}</span>
        <Badge v-if="card.chip" class="chip" :style="{ background: card.chip.color }">
          {{ card.chip.text }}
        </Badge>
      </header>
      <span class="kpi-value" :class="{ score: card.label === 'Score' }" :style="{ color: card.color }">{{ card.value }}</span>
      <p class="kpi-trend">
        <span class="pill" :class="card.direction">{{ card.pill }}</span> {{ card.trend }}
      </p>
      <p class="kpi-caption">{{ card.caption }}</p>
    </Card>
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 12px;
  min-width: 0;
}

.kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kpi-label {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kpi-value {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
}

.kpi-trend,
.kpi-caption {
  margin: 0;
  font-size: 12px;
  color: var(--ink-soft);
}

.kpi-caption {
  color: var(--muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-weight: 600;
  color: var(--ink-soft);
}

.pill.up {
  color: var(--healthy);
  border-color: color-mix(in srgb, var(--healthy) 35%, transparent);
  background: color-mix(in srgb, var(--healthy) 8%, transparent);
}

.pill.down {
  color: var(--falling);
  border-color: color-mix(in srgb, var(--falling) 35%, transparent);
  background: color-mix(in srgb, var(--falling) 8%, transparent);
}
</style>
