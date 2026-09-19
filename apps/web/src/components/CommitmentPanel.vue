<script setup lang="ts">
import {
  type CommitmentContext,
  type CommitmentDraft,
  type CommitmentRequest,
  type CommitmentResponse,
  commitmentRequestSchema,
  euroToMinor,
} from "@hackspain/shared";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { api } from "../api.ts";

const props = withDefaults(
  defineProps<{ companyId: string; draft?: CommitmentDraft | null }>(),
  { draft: null },
);
const emit = defineEmits<{
  evaluated: [request: CommitmentRequest, response: CommitmentResponse];
  invalidated: [];
  closed: [];
}>();

type CostDraft = { id: string; date: string; amount: string };
const context = ref<CommitmentContext | null>(null);
const response = ref<CommitmentResponse | null>(null);
const title = ref("Nueva operación");
const revenue = ref("");
const floor = ref("0");
const maximumAdvance = ref("60");
const advanceDate = ref("");
const finalDate = ref("");
const horizon = ref(1);
const costs = ref<CostDraft[]>([{ id: "cost-1", date: "", amount: "" }]);
const confirmed = ref(false);
const error = ref("");
const contextLoading = ref(false);
const loading = ref(false);
const selectedAdvance = ref<number | null>(null);
let costId = 1;
let contextVersion = 0;
let evaluationVersion = 0;
let contextController: AbortController | undefined;
let evaluationController: AbortController | undefined;

const canEvaluate = computed(
  () =>
    context.value?.basis === "LEDGER_SCENARIO_ONLY" &&
    (context.value?.max_horizon_months ?? 0) > 0,
);
const alternatives = computed(
  () => response.value?.evaluation.alternatives ?? [],
);
const selectedPath = computed(
  () =>
    alternatives.value.find(
      (item) => item.advance_bps === selectedAdvance.value,
    )?.cash.path ?? [],
);
const horizonOptions = computed(() =>
  Array.from(
    { length: context.value?.max_horizon_months || 1 },
    (_, index) => index + 1,
  ),
);

function money(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "No informado"
    : new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
      }).format(value / 100);
}

function dayAfter(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function invalidate() {
  evaluationVersion++;
  evaluationController?.abort();
  response.value = null;
  confirmed.value = false;
  loading.value = false;
  emit("invalidated");
}

async function loadContext() {
  const current = ++contextVersion;
  contextController?.abort();
  contextController = new AbortController();
  invalidate();
  context.value = null;
  error.value = "";
  contextLoading.value = true;
  revenue.value = "";
  costs.value = [{ id: `cost-${++costId}`, date: "", amount: "" }];
  try {
    const next = await api.commitmentContext(
      props.companyId,
      contextController.signal,
    );
    if (current !== contextVersion) return;
    if (next.company_id !== props.companyId)
      throw new Error("El contexto no corresponde a la empresa seleccionada.");
    context.value = next;
    horizon.value = Math.max(1, Math.min(3, next.max_horizon_months));
    if (next.as_of) {
      advanceDate.value = dayAfter(next.as_of, 1);
      finalDate.value = dayAfter(next.as_of, Math.min(45, horizon.value * 28));
      for (const cost of costs.value) cost.date = dayAfter(next.as_of, 7);
    }
    applyDraft();
  } catch (cause) {
    if (current === contextVersion)
      error.value =
        cause instanceof Error
          ? cause.message
          : "No se pudo leer la tesorería.";
  } finally {
    if (current === contextVersion) contextLoading.value = false;
  }
}

function euroText(minor: number): string {
  return Number.isInteger(minor / 100)
    ? String(minor / 100)
    : (minor / 100).toFixed(2).replace(".", ",");
}

function applyDraft() {
  const draft = props.draft;
  if (!draft || !context.value) return;
  const opportunity = draft.opportunity ?? {};
  if (opportunity.title) title.value = opportunity.title;
  if (opportunity.revenue_minor)
    revenue.value = euroText(opportunity.revenue_minor);
  if (opportunity.advance_date) advanceDate.value = opportunity.advance_date;
  if (opportunity.final_payment_date)
    finalDate.value = opportunity.final_payment_date;
  if (opportunity.permitted_advance_bps)
    maximumAdvance.value = String(
      Math.round(Math.max(...opportunity.permitted_advance_bps) / 100),
    );
  if (opportunity.costs)
    costs.value = opportunity.costs.map((cost) => ({
      id: `cost-${++costId}`,
      date: cost.date,
      amount: euroText(cost.amount_minor),
    }));
  if (draft.reserve_floor_minor !== undefined)
    floor.value = euroText(draft.reserve_floor_minor);
  if (draft.horizon_months)
    horizon.value = Math.min(
      draft.horizon_months,
      Math.max(1, context.value.max_horizon_months),
    );
}

function addCost() {
  if (costs.value.length < 24)
    costs.value.push({
      id: `cost-${++costId}`,
      date: advanceDate.value,
      amount: "",
    });
}

function removeCost(id: string) {
  if (costs.value.length > 1)
    costs.value = costs.value.filter((cost) => cost.id !== id);
}

async function evaluate() {
  error.value = "";
  if (!confirmed.value) {
    error.value =
      "Revisa y confirma los importes, fechas e impuestos antes de simular.";
    return;
  }
  if (!canEvaluate.value) {
    error.value = "La evidencia disponible no permite evaluar esta operación.";
    return;
  }
  const current = ++evaluationVersion;
  evaluationController?.abort();
  evaluationController = new AbortController();
  response.value = null;
  emit("invalidated");
  try {
    if (!/^(100|[1-9]?\d)$/.test(maximumAdvance.value))
      throw new Error(
        "El anticipo máximo debe ser un porcentaje entero entre cero y cien.",
      );
    const maximum = Number(maximumAdvance.value) * 100;
    const grid = Array.from(
      { length: Math.floor(maximum / 2000) + 1 },
      (_, index) => index * 2000,
    );
    if (!grid.includes(maximum)) grid.push(maximum);
    const input = commitmentRequestSchema.parse({
      horizon_months: horizon.value,
      reserve_floor_minor: euroToMinor(floor.value),
      opportunity: {
        title: title.value,
        revenue_minor: euroToMinor(revenue.value),
        advance_date: advanceDate.value,
        final_payment_date: finalDate.value,
        permitted_advance_bps: grid,
        costs: costs.value.map((cost) => ({
          id: cost.id,
          date: cost.date,
          amount_minor: euroToMinor(cost.amount),
        })),
      },
    });
    loading.value = true;
    const result = await api.commitment(
      props.companyId,
      input,
      evaluationController.signal,
    );
    if (current !== evaluationVersion) return;
    if (result.evaluation.company_id !== props.companyId)
      throw new Error("El resultado no corresponde a la empresa seleccionada.");
    response.value = result;
    selectedAdvance.value =
      result.evaluation.minimum_tested_feasible_bps ??
      result.evaluation.alternatives[0]?.advance_bps ??
      null;
    emit("evaluated", input, result);
  } catch (cause) {
    if (current === evaluationVersion)
      error.value =
        cause instanceof Error
          ? cause.message
          : "No se pudo calcular el escenario.";
  } finally {
    if (current === evaluationVersion) loading.value = false;
  }
}

watch(() => props.companyId, loadContext, { immediate: true });
watch(() => props.draft, applyDraft);
watch(
  [
    title,
    revenue,
    floor,
    maximumAdvance,
    advanceDate,
    finalDate,
    horizon,
    costs,
  ],
  invalidate,
  { deep: true },
);
onBeforeUnmount(() => {
  contextVersion++;
  evaluationVersion++;
  contextController?.abort();
  evaluationController?.abort();
});
</script>

<template>
  <section class="panel commitment">
    <header>
      <div><h1>Evaluar una operación</h1><p>{{ companyId }} · EUR · escenarios de caja</p></div>
      <span class="simulation-label">Simulación, no reservable, requiere revisión humana</span>
      <button type="button" class="close" aria-label="Cerrar la evaluación" @click="emit('closed')">×</button>
    </header>
    <p v-if="draft" class="notice">TellMe ha rellenado el formulario con lo que has contado. Revisa cada dato y completa lo que falte antes de confirmar.</p>
    <p v-if="contextLoading" role="status">Leyendo el contexto de tesorería…</p>
    <template v-if="context">
      <dl class="snapshot">
        <div><dt>Saldo contable al corte</dt><dd>{{ money(context.snapshot?.ledger_minor) }}</dd></div>
        <div><dt>Disponible corroborado</dt><dd>No verificado</dd></div>
        <div><dt>Fecha de corte</dt><dd>{{ context.as_of ?? "No informada" }}</dd></div>
        <div><dt>Horizonte permitido</dt><dd>{{ context.max_horizon_months }} meses</dd></div>
      </dl>
      <p class="notice">El saldo contable no es caja libre. Los costes y condiciones que introduzcas son supuestos: incluye impuestos, comisiones y desembolsos ya comprometidos.</p>
      <p v-if="!canEvaluate" class="notice">Faltan saldos o histórico comparable para simular. No se sustituyen por cero.</p>
      <form @submit.prevent="evaluate">
        <div class="fields">
          <label for="commitment-title">Operación<input id="commitment-title" v-model="title" maxlength="120" required /></label>
          <label for="commitment-revenue">Importe a cobrar (EUR)<input id="commitment-revenue" v-model="revenue" inputmode="decimal" placeholder="100000,00" required aria-describedby="money-hint" /></label>
          <label for="commitment-floor">Suelo de caja del escenario (EUR)<input id="commitment-floor" v-model="floor" inputmode="decimal" required aria-describedby="money-hint" /></label>
          <label for="commitment-horizon">Horizonte<select id="commitment-horizon" v-model.number="horizon"><option v-for="months in horizonOptions" :key="months" :value="months">{{ months }} meses</option></select></label>
          <label for="commitment-advance-date">Fecha del anticipo supuesto<input id="commitment-advance-date" v-model="advanceDate" type="date" required /></label>
          <label for="commitment-final-date">Fecha del cobro restante<input id="commitment-final-date" v-model="finalDate" type="date" required /></label>
          <label for="commitment-maximum">Anticipo máximo a comparar (%)<input id="commitment-maximum" v-model="maximumAdvance" inputmode="numeric" required /></label>
        </div>
        <p id="money-hint" class="quiet">Importes sin separador de miles y con un máximo de dos decimales. Las fechas iniciales son sugerencias editables, no obligaciones observadas.</p>
        <fieldset>
          <legend>Desembolsos de la operación</legend>
          <div v-for="(cost, index) in costs" :key="cost.id" class="cost-row">
            <label :for="`date-${cost.id}`">Fecha del coste {{ index + 1 }}<input :id="`date-${cost.id}`" v-model="cost.date" type="date" data-cost-date required /></label>
            <label :for="`amount-${cost.id}`">Importe del coste {{ index + 1 }} (EUR)<input :id="`amount-${cost.id}`" v-model="cost.amount" inputmode="decimal" data-cost-amount required aria-describedby="money-hint" /></label>
            <button type="button" :disabled="costs.length === 1" :aria-label="`Eliminar coste ${index + 1}`" @click="removeCost(cost.id)">Quitar</button>
          </div>
          <button type="button" :disabled="costs.length >= 24" @click="addCost">Añadir desembolso</button>
        </fieldset>
        <label class="confirmation" for="commitment-confirm"><input id="commitment-confirm" v-model="confirmed" type="checkbox" />He revisado importes, fechas e impuestos incluidos. Confirmo estos supuestos para simular, no para contratar ni pagar.</label>
        <button class="primary" type="submit" :disabled="loading || !canEvaluate">{{ loading ? "Calculando…" : "Comparar condiciones" }}</button>
      </form>
      <details><summary>Cobertura y límites de los datos</summary><ul><li v-for="item in context.limitations" :key="item">{{ item }}</li></ul></details>
    </template>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="response" class="commitment-results" aria-live="polite">
      <h2>Resultado del escenario</h2>
      <p class="simulation-label">{{ response.evaluation.label }}</p>
      <p v-if="response.evaluation.status !== 'EVALUATED'">No se puede evaluar la operación completa con este alcance. Revisa horizonte, moneda y cobertura.</p>
      <template v-else>
        <p v-if="response.evaluation.minimum_tested_feasible_bps === null">Ninguna combinación evaluada mantiene el suelo solicitado.</p>
        <p v-else>Mínimo entre las opciones evaluadas: <strong>{{ response.evaluation.minimum_tested_feasible_bps / 100 }} % de anticipo</strong>. No es un óptimo global ni una garantía de cobro.</p>
        <div class="table-scroll"><table>
          <caption>Comparación bajo los mismos supuestos</caption>
          <thead><tr><th scope="col">Anticipo</th><th scope="col">Caja mínima</th><th scope="col">Caja final</th><th scope="col">Suelo del escenario</th><th scope="col">Detalle</th></tr></thead>
          <tbody><tr v-for="option in alternatives" :key="option.advance_bps">
            <th scope="row">{{ option.advance_bps / 100 }} % · {{ money(option.advance_minor) }}</th>
            <td>{{ money(option.cash.min_cash_minor) }}</td><td>{{ money(option.cash.closing_minor) }}</td>
            <td>{{ option.cash.status === 'COMPATIBLE_UNDER_ASSUMPTIONS' ? 'Cumple en este supuesto' : 'No cumple / no evaluable' }}</td>
            <td><button type="button" :aria-pressed="selectedAdvance === option.advance_bps" @click="selectedAdvance = option.advance_bps">Ver recorrido {{ option.advance_bps / 100 }} %</button></td>
          </tr></tbody>
        </table></div>
        <details v-if="selectedPath.length"><summary>Trayectoria por eventos de la alternativa seleccionada</summary><div class="table-scroll"><table>
          <thead><tr><th scope="col">Fecha</th><th scope="col">Momento conservador</th><th scope="col">Caja del escenario</th></tr></thead>
          <tbody><tr v-for="point in selectedPath" :key="`${point.date}:${point.phase}`"><td>{{ point.date }}</td><td>{{ point.phase === 'DEBITS' ? 'Tras salidas' : 'Tras entradas' }}</td><td>{{ money(point.cash_minor) }}</td></tr></tbody>
        </table></div></details>
      </template>
      <details><summary>Supuestos y condiciones de esta evaluación</summary><ul><li v-for="item in response.evaluation.assumptions" :key="item">{{ item }}</li></ul></details>
      <p class="quiet">{{ response.evaluation.calculation_version }} · Sin cambios en el score histórico ni acciones financieras.</p>
    </div>
  </section>
</template>

<style scoped>
.commitment { padding: 20px; }
.close { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; line-height: 1; font-size: 16px; }
header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; align-items: start; }
h1 { font-size: 22px; margin: 0; }
h2 { font-size: 17px; }
header p, .quiet { color: var(--ink-soft); font-size: 12px; }
.simulation-label { color: var(--slipping); font-weight: 600; font-size: 12px; }
.snapshot { display: flex; flex-wrap: wrap; gap: 12px 24px; border-block: 1px solid var(--line); padding-block: 12px; }
dt { font-size: 12px; color: var(--ink-soft); }
dd { margin: 4px 0 0; font-weight: 600; }
.notice { border-left: 3px solid var(--slipping); padding-left: 12px; color: var(--ink-soft); }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
input, select { padding: 8px; border: 1px solid var(--line); border-radius: 5px; background: var(--card); min-width: 0; font: inherit; }
fieldset { margin: 16px 0; padding: 12px 0; border: 0; border-top: 1px solid var(--line); min-width: 0; }
legend { font-weight: 600; }
.cost-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; margin-bottom: 10px; }
button { padding: 7px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--card); }
button:disabled { cursor: not-allowed; opacity: 0.6; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.confirmation { flex-direction: row; align-items: start; margin: 14px 0; line-height: 1.5; }
.primary { background: var(--accent); color: white; }
details { margin-top: 16px; color: var(--ink-soft); font-size: 12px; }
summary { cursor: pointer; font-weight: 600; }
li { margin-bottom: 6px; }
.commitment-results { border-top: 1px solid var(--line); margin-top: 20px; }
.table-scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
caption { text-align: left; padding: 10px 0; color: var(--ink-soft); }
th, td { text-align: left; padding: 9px 7px; border-bottom: 1px solid var(--line); }
@media (max-width: 650px) { .fields, .cost-row { grid-template-columns: 1fr; } .commitment { padding: 14px; } }
</style>
