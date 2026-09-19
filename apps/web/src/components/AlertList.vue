<script setup lang="ts">
import type { Alert } from "@hackspain/shared";
import { points, STATE_COLORS } from "../format.ts";

defineProps<{ alerts: Alert[]; selected: string }>();
const emit = defineEmits<{ select: [companyId: string] }>();

const KIND_LABELS = { down: "empeora", recovered: "se recupera", up: "mejora" };
</script>

<template>
  <section class="panel alerts">
    <h2 class="panel-title">Alertas del mes · {{ alerts.length }}</h2>
    <ul>
      <li v-for="alert in alerts" :key="alert.company_id">
        <button
          type="button"
          :class="{ active: alert.company_id === selected }"
          @click="emit('select', alert.company_id)"
        >
          <span class="dot" :style="{ background: STATE_COLORS[alert.state] }" />
          <span class="id">{{ alert.company_id }}</span>
          <span class="kind" :class="alert.kind">{{ KIND_LABELS[alert.kind] }}</span>
          <span class="score">{{ alert.score }}</span>
          <span class="delta" :class="alert.kind">{{ points(alert.delta) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.alerts {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 6px;
  min-height: 0;
  overflow-y: auto;
}

button {
  width: 100%;
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  grid-template-areas:
    "dot id score delta"
    "dot kind score delta";
  column-gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
}

button:hover,
button.active {
  background: var(--chip-bg);
}

button.active .id {
  color: var(--accent);
}

.dot {
  grid-area: dot;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.id {
  grid-area: id;
  font-weight: 600;
}

.kind {
  grid-area: kind;
  font-size: 12px;
  color: var(--ink-soft);
}

.score {
  grid-area: score;
  font-weight: 600;
}

.delta {
  grid-area: delta;
  min-width: 46px;
  text-align: right;
  font-size: 12px;
}

.delta.down {
  color: var(--falling);
}

.delta.recovered,
.delta.up {
  color: var(--healthy);
}
</style>
