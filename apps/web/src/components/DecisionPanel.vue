<script setup lang="ts">
import type { Role, Simulate, SimulateScenario } from "@hackspain/shared";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { api } from "../api.ts";
import { euro, points } from "../format.ts";

const props = defineProps<{
  companyId: string;
  role: Role;
}>();

const WIDTH = 760;
const HEIGHT = 240;
const PAD = 28;
const HORIZON = 6;
const advance = ref(0);
const draw = ref(0);
const fee = ref(0.02);
const apr = ref(0.06);
const result = ref<Simulate | null>(null);
const loading = ref(true);
const error = ref("");
let ready = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;

const availableLine = computed(() =>
  result.value
    ? Math.max(
        result.value.inputs.credit_line_limit -
          result.value.inputs.credit_line_drawn,
        0,
      )
    : 0,
);

const series = computed(() => {
  if (!result.value) {
    return [];
  }
  return [
    {
      kind: "baseline",
      label: "línea base",
      cash: result.value.baseline.cash,
      minimum: result.value.baseline.minimum_cash_month,
    },
    ...result.value.scenarios.map((scenario) => ({
      kind: scenario.kind,
      label: scenarioLabel(scenario.kind),
      cash: scenario.cash,
      minimum: scenario.minimum_cash_month,
    })),
  ];
});

const extent = computed(() => {
  const values = [0, ...series.value.flatMap((item) => item.cash)];
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
});

function roundedThousands(value: number): number {
  return Math.floor(value / 1000) * 1000;
}

function scenarioLabel(kind: SimulateScenario["kind"]): string {
  return kind === "receivable_advance"
    ? "adelanto de cobros"
    : "disposición de línea";
}

function capText(scenario: SimulateScenario): string {
  return scenario.kind === "receivable_advance"
    ? "tope: pendiente de cobro"
    : "tope: línea disponible";
}

function figureValue(value: number, unit: string): string {
  return unit === "pts" || unit === "points"
    ? `${points(value)} pts`
    : euro(value);
}

function x(index: number): number {
  return PAD + (index / HORIZON) * (WIDTH - PAD * 2);
}

function y(value: number): number {
  const span = extent.value.maximum - extent.value.minimum || 1;
  return PAD + ((extent.value.maximum - value) / span) * (HEIGHT - PAD * 2);
}

function path(cash: number[]): string {
  return cash
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`)
    .join(" ");
}

async function loadSimulation() {
  const currentRequest = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const next = await api.simulate(props.companyId, {
      horizon: HORIZON,
      advance: advance.value,
      draw: draw.value,
      fee: fee.value,
      apr: apr.value,
    });
    if (currentRequest === requestId) {
      result.value = next;
    }
  } catch (cause) {
    if (currentRequest === requestId) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error.value =
        message === "No months observed"
          ? "Sin tres meses observados: no se puede simular"
          : message;
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
    }
  }
}

function schedule() {
  if (!ready) {
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(loadSimulation, 300);
}

async function initialise() {
  clearTimeout(timer);
  const currentRequest = ++requestId;
  ready = false;
  loading.value = true;
  error.value = "";
  try {
    const company = await api.company(props.companyId);
    if (currentRequest !== requestId) {
      return;
    }
    advance.value = roundedThousands(company.treasury.pending_receivables);
    draw.value = roundedThousands(
      Math.max(
        company.treasury.credit_line_limit - company.treasury.credit_line_drawn,
        0,
      ),
    );
    fee.value = 0.02;
    apr.value = 0.06;
    ready = true;
    await loadSimulation();
  } catch (cause) {
    if (currentRequest === requestId) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      loading.value = false;
    }
  }
}

watch(() => props.companyId, initialise, { immediate: true });
watch([advance, draw, fee, apr], schedule);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section class="panel decision-panel" :data-role="role">
    <header class="decision-header">
      <h2 class="panel-title">Decisión</h2>
      <span class="decision-badge">escenario</span>
    </header>

    <div class="decision-content">
      <p class="decision-frame">
        Escenario, no observación: qué pasa con tu caja y tu índice si adelantas
        cobros o dispones de la línea
      </p>

      <dl v-if="result" class="decision-inputs">
        <div><dt>Caja inicial</dt><dd>{{ euro(result.inputs.starting_cash) }}</dd></div>
        <div><dt>Pendiente de cobro</dt><dd>{{ euro(result.inputs.pending_receivables) }}</dd></div>
        <div><dt>Línea disponible</dt><dd>{{ euro(availableLine) }}</dd></div>
        <div><dt>Flujo neto mensual</dt><dd>{{ euro(result.inputs.net_flow_monthly) }}</dd></div>
      </dl>

      <div class="decision-controls">
        <label>
          Adelantar cobros
          <input
            v-model.number="advance"
            name="advance"
            type="number"
            min="0"
            :max="result?.inputs.pending_receivables"
            step="1000"
          />
        </label>
        <label>
          Disponer de la línea
          <input
            v-model.number="draw"
            name="draw"
            type="number"
            min="0"
            :max="availableLine"
            step="1000"
          />
        </label>
      </div>

      <details class="decision-assumptions">
        <summary>Supuestos · 2 % comisión · 6 % anual</summary>
        <div>
          <label>Comisión <input v-model.number="fee" name="fee" type="number" min="0" max="1" step="0.01" /></label>
          <label>Interés anual <input v-model.number="apr" name="apr" type="number" min="0" max="1" step="0.01" /></label>
        </div>
      </details>

      <p v-if="loading" class="decision-loading">Actualizando escenario…</p>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="result">
        <div class="decision-chart">
          <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" aria-label="Caja mensual por escenario">
            <line class="zero-line" :x1="PAD" :x2="WIDTH - PAD" :y1="y(0)" :y2="y(0)" />
            <path
              v-for="item in series"
              :key="item.kind"
              :class="['decision-series', item.kind]"
              :d="path(item.cash)"
            />
            <circle
              v-for="item in series"
              :key="`${item.kind}-minimum`"
              :class="['decision-minimum', item.kind]"
              :cx="x(item.minimum)"
              :cy="y(item.cash[item.minimum] ?? 0)"
              r="4"
            />
            <text v-for="month in HORIZON + 1" :key="month" :x="x(month - 1)" :y="HEIGHT - 6" text-anchor="middle">{{ month - 1 }}</text>
          </svg>
          <ul class="decision-legend">
            <li v-for="item in series" :key="item.kind" :class="item.kind">{{ item.label }}</li>
          </ul>
        </div>

        <p v-if="result.scenarios.length === 0" class="decision-empty">
          Sin importes disponibles para construir escenarios.
        </p>
        <div v-else class="decision-scenarios">
          <article v-for="scenario in result.scenarios" :key="scenario.kind" class="decision-scenario">
            <header>
              <h3>{{ scenarioLabel(scenario.kind) }}</h3>
              <span>escenario</span>
            </header>
            <p>
              Aplicado: {{ euro(scenario.applied) }}
              <small v-if="scenario.capped">{{ capText(scenario) }}</small>
            </p>
            <dl>
              <div v-for="figure in scenario.decision_figures" :key="figure.label" class="decision-figure">
                <dt>{{ figure.label }}</dt>
                <dd>{{ figureValue(figure.value, figure.unit) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.decision-header,
.decision-scenario header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.decision-badge,
.decision-scenario header span {
  margin-right: 16px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 600;
}

.decision-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px 20px;
}

.decision-frame,
.decision-loading,
.decision-empty,
.decision-scenario p {
  margin: 0;
}

.decision-frame {
  font-weight: 600;
}

.decision-inputs,
.decision-scenario dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.decision-inputs div,
.decision-figure {
  padding: 10px;
  border-radius: 7px;
  background: var(--paper);
}

dt {
  color: var(--ink-soft);
  font-size: 11px;
}

dd {
  margin: 3px 0 0;
  font-weight: 600;
}

.decision-controls,
.decision-assumptions div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}

input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
}

.decision-assumptions summary {
  cursor: pointer;
  color: var(--ink-soft);
  font-size: 12px;
}

.decision-assumptions div {
  margin-top: 10px;
}

.decision-loading {
  color: var(--ink-soft);
  font-size: 12px;
}

.decision-chart {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.decision-chart svg {
  display: block;
  width: 100%;
  height: auto;
}

.zero-line {
  stroke: var(--line);
  stroke-dasharray: 4 4;
}

.decision-series {
  fill: none;
  stroke-width: 3;
}

.decision-series.baseline,
.decision-minimum.baseline {
  stroke: var(--stable);
  fill: var(--stable);
}

.decision-series.receivable_advance,
.decision-minimum.receivable_advance {
  stroke: var(--accent);
  fill: var(--accent);
}

.decision-series.credit_line_draw,
.decision-minimum.credit_line_draw {
  stroke: var(--improving);
  fill: var(--improving);
}

.decision-chart text {
  fill: var(--ink-soft);
  font-size: 10px;
}

.decision-legend {
  display: flex;
  gap: 18px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  color: var(--ink-soft);
  font-size: 12px;
}

.decision-legend li::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 3px;
  margin-right: 6px;
  vertical-align: middle;
  background: var(--stable);
}

.decision-legend .receivable_advance::before {
  background: var(--accent);
}

.decision-legend .credit_line_draw::before {
  background: var(--improving);
}

.decision-scenarios {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.decision-scenario {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.decision-scenario h3 {
  margin: 0;
  font-size: 14px;
}

.decision-scenario header span {
  margin: 0;
}

.decision-scenario p {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 12px;
}

.decision-scenario small {
  display: block;
  color: var(--slipping);
}

.decision-scenario dl {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 10px;
}

@media (max-width: 720px) {
  .decision-inputs,
  .decision-controls,
  .decision-assumptions div,
  .decision-scenarios {
    grid-template-columns: 1fr;
  }
}
</style>
