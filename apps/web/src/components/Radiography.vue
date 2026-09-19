<script setup lang="ts">
import type { CompanyDetail, Explain } from "@hackspain/shared";
import { computed } from "vue";
import {
  CONFIDENCE_LABELS,
  componentLabel,
  euro,
  eventLabel,
  monthLabel,
  points,
  STATE_COLORS,
} from "../format.ts";
import Sparkline from "./Sparkline.vue";

const props = defineProps<{ company: CompanyDetail; explanation: Explain }>();

const previous = computed(() => {
  const scored = props.company.series.filter((entry) => entry.score !== null);
  return scored.at(-2) ?? null;
});

const delta = computed(() =>
  previous.value?.score !== null &&
  previous.value !== null &&
  props.explanation.score !== null
    ? props.explanation.score - previous.value.score
    : null,
);

const SCORED_CODES = new Set(["balance", "fees", "refunds", "momentum"]);

const mainDrivers = computed(() =>
  props.explanation.drivers.filter((driver) => driver.contribution !== 0),
);

const contextDrivers = computed(() =>
  props.explanation.drivers.filter(
    (driver) => driver.contribution === 0 && !SCORED_CODES.has(driver.code),
  ),
);
</script>

<template>
  <section class="panel radiography">
    <header class="head">
      <div>
        <h1>{{ company.company_id }}</h1>
        <p class="meta">
          {{ monthLabel(explanation.month) }} · {{ company.months_observed }} meses observados ·
          {{ CONFIDENCE_LABELS[explanation.confidence] }}
          <span v-if="company.holdout" class="holdout">held-out</span>
        </p>
      </div>
      <div class="score-block">
        <span class="score" :style="{ color: STATE_COLORS[explanation.state] }">
          {{ explanation.score ?? "–" }}
        </span>
        <span class="delta" :class="{ negative: (delta ?? 0) < 0, positive: (delta ?? 0) > 0 }">
          <template v-if="delta !== null">{{ delta < 0 ? "▼" : delta > 0 ? "▲" : "▶" }} {{ points(delta) }} vs mes anterior</template>
          <template v-else>sin mes anterior</template>
        </span>
        <span class="chip" :style="{ background: STATE_COLORS[explanation.state] }">
          {{ explanation.state_label }}
        </span>
      </div>
    </header>

    <Sparkline :series="company.series" />

    <div class="columns">
      <div>
        <h3>Por qué</h3>
        <ul class="drivers">
          <li v-for="driver in mainDrivers" :key="driver.code">
            <span class="contribution" :class="{ negative: driver.contribution < 0, positive: driver.contribution > 0 }">
              {{ points(driver.contribution) }}
            </span>
            <span>{{ driver.text }}</span>
          </li>
          <li v-for="driver in contextDrivers" :key="driver.code" class="context">
            <span class="contribution">ctx</span>
            <span>{{ driver.text }}</span>
          </li>
        </ul>
        <ul v-if="explanation.events.length" class="events">
          <li v-for="event in explanation.events" :key="event">
            <strong>{{ event }}</strong> {{ eventLabel(event) }}
          </li>
        </ul>
      </div>
      <div>
        <h3>Qué cambió</h3>
        <ul v-if="explanation.changed.length" class="changed">
          <li v-for="item in explanation.changed" :key="item.code">
            <span class="contribution" :class="{ negative: item.delta < 0, positive: item.delta > 0 }">{{ points(item.delta) }}</span>
            <span>{{ componentLabel(item.code) }}</span>
          </li>
        </ul>
        <p v-else class="quiet">Sin cambios frente al mes anterior.</p>
        <h3>Acción</h3>
        <p class="action">{{ explanation.action }}</p>
      </div>
    </div>

    <dl class="evidence">
      <div><dt>Ventana</dt><dd>{{ explanation.evidence.window ?? "–" }}</dd></div>
      <div><dt>Transacciones</dt><dd>{{ explanation.evidence.transactions_in_window }}</dd></div>
      <div><dt>Sin categoría</dt><dd>{{ Math.round(explanation.evidence.share_uncategorised * 100) }} %</dd></div>
      <div><dt>Fuentes</dt><dd>{{ Object.entries(explanation.evidence.sources).filter(([, on]) => on).map(([name]) => name).join(", ") }}</dd></div>
      <div v-if="company.debt_outstanding > 0"><dt>Deuda viva</dt><dd>{{ euro(company.debt_outstanding) }}</dd></div>
      <div v-if="explanation.invoice_facts.overdue_count"><dt>Facturas vencidas</dt><dd>{{ explanation.invoice_facts.overdue_count }} · {{ euro(explanation.invoice_facts.overdue_amount ?? 0) }}</dd></div>
      <div><dt>Regla</dt><dd>{{ explanation.evidence.rule_version }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.radiography {
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 22px;
}

.meta {
  margin: 4px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.holdout {
  margin-left: 8px;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.score-block {
  display: grid;
  grid-template-columns: auto auto;
  grid-template-areas:
    "score chip"
    "score delta";
  column-gap: 14px;
  align-items: center;
}

.score {
  grid-area: score;
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.chip {
  grid-area: chip;
  justify-self: start;
}

.delta {
  grid-area: delta;
  font-size: 13px;
  color: var(--ink-soft);
}

.delta.negative {
  color: var(--falling);
}

.delta.positive {
  color: var(--healthy);
}

.columns {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 24px;
}

@media (max-width: 700px) {
  .columns {
    grid-template-columns: 1fr;
  }
}

h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

ul {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drivers li,
.changed li {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
  align-items: baseline;
}

.context {
  color: var(--ink-soft);
}

.contribution {
  font-weight: 600;
  text-align: right;
  color: var(--ink-soft);
}

.contribution.negative {
  color: var(--falling);
}

.contribution.positive {
  color: var(--healthy);
}

.events li {
  font-size: 13px;
  color: var(--falling);
}

.quiet {
  margin: 0 0 14px;
  color: var(--ink-soft);
}

.action {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--accent);
  background: var(--chip-bg);
  border-radius: 0 6px 6px 0;
  font-weight: 500;
}

.evidence {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}

.evidence div {
  display: flex;
  gap: 6px;
  font-size: 12px;
}

dt {
  color: var(--ink-soft);
}

dd {
  margin: 0;
  font-weight: 600;
}
</style>
