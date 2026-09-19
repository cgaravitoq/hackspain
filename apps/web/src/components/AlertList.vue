<script setup lang="ts">
import type { Alert } from "@hackspain/shared";
import { computed } from "vue";
import { ALERTS_LIMIT } from "../api.ts";
import { points, STATE_COLORS } from "../format.ts";

const props = defineProps<{ alerts: Alert[]; selected: string }>();
const emit = defineEmits<{ select: [companyId: string] }>();

const KIND_LABELS = { down: "empeora", recovered: "se recupera", up: "mejora" };

const capped = computed(() => props.alerts.length >= ALERTS_LIMIT);
</script>

<template>
  <section class="panel alerts">
    <h2 class="panel-title">
      Alertas del mes · {{ alerts.length }}{{ capped ? "+" : "" }}
    </h2>
    <ul>
      <li v-for="alert in alerts" :key="alert.company_id">
        <button
          type="button"
          class="alert-pill"
          :class="{ active: alert.company_id === selected }"
          :aria-pressed="alert.company_id === selected"
          @click="emit('select', alert.company_id)"
        >
          <span class="dot" :style="{ background: STATE_COLORS[alert.state] }" />
          <span class="id">{{ alert.company_id }}</span>
          <span class="kind" :class="alert.kind">{{ KIND_LABELS[alert.kind] }}</span>
          <span class="delta" :class="alert.kind">{{ points(alert.delta) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.alerts {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.panel-title {
  align-self: stretch;
  display: flex;
  flex: none;
  align-items: center;
  padding: 10px 14px;
  border-right: 1px solid var(--line);
  border-bottom: 0;
  white-space: nowrap;
}

ul {
  display: flex;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 6px;
  overflow-x: auto;
  list-style: none;
}

li {
  flex: none;
}

button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--paper);
  white-space: nowrap;
}

button:hover {
  background: var(--chip-bg);
}

button.active {
  border-color: var(--accent);
  background: #eff6ff;
}

button.active .id {
  color: var(--accent);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.id {
  font-weight: 600;
}

.kind {
  color: var(--ink-soft);
  font-size: 12px;
}

.delta {
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
