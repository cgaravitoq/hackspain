<script setup lang="ts">
import {
  type CommitmentAlternative,
  type CommitmentEvaluation,
  type CommitmentRequest,
  type CommitmentStatus,
  commitmentRequestSchema,
  type Role,
} from "@hackspain/shared";
import { ref, watch } from "vue";
import { api } from "../api.ts";
import { euroMinor } from "../format.ts";

const props = defineProps<{ companyId: string; role: Role }>();

type CostRow = { id: number; label: string; date: string; amount: string };

const statusLabels: Record<CommitmentStatus, string> = {
  COMPATIBLE_UNDER_ASSUMPTIONS: "Compatible bajo supuestos",
  INCOMPATIBLE: "Incompatible",
  INSUFFICIENT_EVIDENCE: "Evidencia insuficiente",
  OUTSIDE_HORIZON: "Fuera de horizonte",
};
const fieldLabels = new Map([
  ["opening_minor", "el saldo inicial supuesto"],
  ["floor_minor", "el suelo de caja"],
  ["revenue_minor", "el ingreso de la oportunidad"],
  ["advance_date", "la fecha del anticipo"],
  ["final_date", "la fecha del cobro final"],
  ["advance_bps", "los anticipos a comparar"],
  ["costs", "los costes"],
]);

const opening = ref("");
const floor = ref("0");
const revenue = ref("");
const advanceDate = ref("");
const finalDate = ref("");
const advancePercents = ref("0, 20, 40, 60");
const costs = ref<CostRow[]>([{ id: 1, label: "", date: "", amount: "" }]);
const result = ref<CommitmentEvaluation | null>(null);
const error = ref("");
const loading = ref(false);
let nextCostId = 2;
let requestId = 0;

function parseMoney(value: string): number | null {
  const compact = value.trim().replaceAll(" ", "");
  const normalized = compact.includes(",")
    ? compact.replaceAll(".", "").replace(",", ".")
    : compact;
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2] ?? "0");
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  const cents = sign * (whole * 100n + fraction);
  const number = Number(cents);
  return Number.isSafeInteger(number) ? number : null;
}

function parsePercents(value: string): number[] {
  return value.split(",").map((part) => {
    const trimmed = part.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) * 100 : Number.NaN;
  });
}

function addCost() {
  costs.value.push({ id: nextCostId, label: "", date: "", amount: "" });
  nextCostId += 1;
}

function removeCost(id: number) {
  costs.value = costs.value.filter((cost) => cost.id !== id);
}

function minimumDate(alternative: CommitmentAlternative): string {
  if (alternative.min_cash_minor === null) {
    return "-";
  }
  return (
    alternative.path.find(
      (checkpoint) => checkpoint.cash_minor === alternative.min_cash_minor,
    )?.date ?? "-"
  );
}

async function submit() {
  const candidate = {
    opening_minor: parseMoney(opening.value) ?? Number.NaN,
    floor_minor: parseMoney(floor.value) ?? Number.NaN,
    revenue_minor: parseMoney(revenue.value) ?? Number.NaN,
    advance_date: advanceDate.value,
    final_date: finalDate.value,
    advance_bps: parsePercents(advancePercents.value),
    costs: costs.value.map((cost) => ({
      label: cost.label.trim(),
      date: cost.date,
      amount_minor: parseMoney(cost.amount) ?? Number.NaN,
    })),
    other_flows: [],
  };
  const parsed = commitmentRequestSchema.safeParse(candidate);
  result.value = null;
  error.value = "";
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "los datos");
    error.value = `Revisa ${fieldLabels.get(field) ?? "los datos"}: valor no válido`;
    return;
  }
  const currentRequest = ++requestId;
  loading.value = true;
  try {
    const evaluation = await api.simulateCommitment(
      props.companyId,
      parsed.data satisfies CommitmentRequest,
    );
    if (currentRequest === requestId) {
      result.value = evaluation;
    }
  } catch (cause) {
    if (currentRequest === requestId) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
    }
  }
}

watch([() => props.companyId, () => props.role], () => {
  requestId += 1;
  result.value = null;
  error.value = "";
  loading.value = false;
});
</script>

<template>
  <section class="panel commitment">
    <h2 class="panel-title">Simular compromiso (experimental)</h2>
    <form class="commitment-form" @submit.prevent="submit">
      <div class="commitment-fields">
        <label>
          Saldo inicial supuesto (EUR)
          <input v-model="opening" name="opening" inputmode="decimal" type="text" />
        </label>
        <label>
          Suelo de caja (EUR)
          <input v-model="floor" name="floor" inputmode="decimal" type="text" />
        </label>
        <label>
          Ingreso de la oportunidad (EUR)
          <input v-model="revenue" name="revenue" inputmode="decimal" type="text" />
        </label>
        <label>
          Fecha del anticipo
          <input v-model="advanceDate" name="advance-date" type="date" />
        </label>
        <label>
          Fecha del cobro final
          <input v-model="finalDate" name="final-date" type="date" />
        </label>
        <label>
          Anticipos a comparar (%)
          <input v-model="advancePercents" name="advance-percents" type="text" />
        </label>
      </div>

      <fieldset class="costs">
        <legend>Costes</legend>
        <div v-for="cost in costs" :key="cost.id" class="cost-row">
          <label>
            Concepto
            <input v-model="cost.label" :name="`cost-label-${cost.id}`" type="text" />
          </label>
          <label>
            Fecha
            <input v-model="cost.date" :name="`cost-date-${cost.id}`" type="date" />
          </label>
          <label>
            Importe (EUR)
            <input
              v-model="cost.amount"
              :name="`cost-amount-${cost.id}`"
              inputmode="decimal"
              type="text"
            />
          </label>
          <button
            type="button"
            class="remove-cost"
            :aria-label="`Quitar coste ${cost.label || cost.id}`"
            @click="removeCost(cost.id)"
          >
            Quitar
          </button>
        </div>
        <button type="button" class="add-cost" @click="addCost">Añadir coste</button>
      </fieldset>

      <p v-if="error" class="commitment-error" role="alert">{{ error }}</p>
      <button class="simulate" type="submit" :disabled="loading">
        {{ loading ? "Simulando…" : "Simular alternativas" }}
      </button>
    </form>

    <div v-if="result" class="commitment-result">
      <p class="commitment-label">{{ result.label }}</p>
      <dl class="commitment-meta">
        <div><dt>Fecha base</dt><dd>{{ result.as_of }}</dd></div>
        <div><dt>Fin del horizonte</dt><dd>{{ result.horizon_end }}</dd></div>
        <div><dt>Meses observados</dt><dd>{{ result.observed_months }}</dd></div>
        <div><dt>Base</dt><dd>Supuesto del usuario</dd></div>
        <div><dt>Preparación</dt><dd>Solo simulación</dd></div>
      </dl>
      <p class="feasibility-summary">
        {{
          result.minimum_tested_feasible_bps === null
            ? "Ninguna alternativa probada es compatible"
            : "Anticipo mínimo probado"
        }}
      </p>
      <div class="commitment-table-wrap">
        <table class="commitment-table">
          <thead>
            <tr>
              <th>Anticipo</th>
              <th>Anticipo EUR</th>
              <th>Estado</th>
              <th>Mínimo de caja</th>
              <th>Fecha del mínimo</th>
              <th>Primer incumplimiento</th>
              <th>Cierre</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="alternative in result.alternatives"
              :key="alternative.advance_bps"
              :class="{
                'minimum-feasible':
                  alternative.advance_bps === result.minimum_tested_feasible_bps,
              }"
            >
              <td>{{ alternative.advance_bps / 100 }} %</td>
              <td>{{ euroMinor(alternative.advance_minor) }}</td>
              <td>{{ statusLabels[alternative.status] }}</td>
              <td>
                {{
                  alternative.min_cash_minor === null
                    ? "-"
                    : euroMinor(alternative.min_cash_minor)
                }}
              </td>
              <td>{{ minimumDate(alternative) }}</td>
              <td>{{ alternative.first_breach?.date ?? "-" }}</td>
              <td>
                {{
                  alternative.closing_minor === null
                    ? "-"
                    : euroMinor(alternative.closing_minor)
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.commitment-form,
.commitment-result {
  padding: 16px 20px 20px;
}

.commitment-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-weight: 400;
}

input:focus {
  border-color: var(--accent);
  outline: 2px solid rgb(29 78 216 / 14%);
}

.costs {
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.costs legend {
  padding: 0 5px;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}

.cost-row {
  display: grid;
  grid-template-columns: minmax(140px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.cost-row + .cost-row {
  margin-top: 10px;
}

.add-cost,
.remove-cost,
.simulate {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
}

.add-cost {
  margin-top: 12px;
}

.remove-cost {
  color: var(--falling);
}

.simulate {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.simulate:disabled {
  opacity: 0.65;
  cursor: wait;
}

.commitment-error {
  margin: 0 0 12px;
  color: var(--falling);
}

.commitment-result {
  border-top: 1px solid var(--line);
}

.commitment-label {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid #f0c36b;
  border-radius: 6px;
  background: #fff8df;
  color: #7c4a03;
  font-weight: 700;
}

.commitment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
}

.commitment-meta div {
  display: flex;
  gap: 6px;
}

.commitment-meta dt {
  color: var(--ink-soft);
}

.commitment-meta dd {
  margin: 0;
  font-weight: 600;
}

.feasibility-summary {
  margin: 14px 0 8px;
  font-weight: 700;
}

.commitment-table-wrap {
  overflow-x: auto;
}

.commitment-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 12px;
}

.commitment-table th,
.commitment-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

.commitment-table th {
  color: var(--ink-soft);
  font-weight: 600;
}

.minimum-feasible {
  background: #eaf7ef;
  box-shadow: inset 3px 0 var(--healthy);
  font-weight: 600;
}

@media (max-width: 760px) {
  .commitment-fields,
  .cost-row {
    grid-template-columns: 1fr;
  }

  .remove-cost {
    justify-self: start;
  }
}
</style>
