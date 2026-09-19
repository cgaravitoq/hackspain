<script setup lang="ts">
import {
  REPORT_HEADINGS,
  type Report,
  type ReportSection,
  type Role,
} from "@hackspain/shared";
import { computed, ref, watch } from "vue";
import { api } from "../api.ts";
import { STATE_COLORS } from "../format.ts";

const props = defineProps<{
  companyId: string;
  role: Role;
  decisionSection?: ReportSection | null;
}>();

const report = ref<Report | null>(null);
const headings = computed(() =>
  report.value ? REPORT_HEADINGS[report.value.role] : null,
);
const decisionBlocks = computed(() =>
  props.decisionSection ? blocks(props.decisionSection.body) : [],
);
const decisionLead = computed(() => decisionBlocks.value.slice(0, 1));
const decisionDetails = computed(() => decisionBlocks.value.slice(1));
const loading = ref(true);
const error = ref("");
let requestId = 0;

const exportUrl = computed(
  () =>
    `/api/companies/${props.companyId}/report.pdf?${new URLSearchParams({ role: props.role })}`,
);

type Block = { source: string; items: string[] | null; text: string };

function plain(markdown: string): string {
  return markdown.replaceAll("**", "");
}

function blocks(body: string): Block[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n").map((line) => line.trim());
      const isList = lines.every((line) => line.startsWith("- "));
      return {
        source: chunk,
        items: isList ? lines.map((line) => plain(line.slice(2))) : null,
        text: plain(chunk),
      };
    });
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function figureValue(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(
    value,
  );
}

async function load() {
  const currentRequest = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const nextReport = await api.report(props.companyId, props.role);
    if (currentRequest === requestId) {
      report.value = nextReport;
    }
  } catch (cause) {
    if (currentRequest === requestId) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      report.value = null;
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
    }
  }
}

watch([() => props.companyId, () => props.role], load, { immediate: true });
</script>

<template>
  <section class="panel report">
    <header class="report-header">
      <h2 class="panel-title">Informe</h2>
      <a
        class="report-export"
        :href="exportUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        Exportar PDF
      </a>
    </header>
    <p v-if="loading" class="loading">Generando informe…</p>
    <div v-else-if="error" class="error">
      <p>No se pudo generar el informe</p>
      <small>{{ error }}</small>
    </div>
    <div v-else-if="report && headings" class="report-content">
      <div class="report-lead">
        <p class="report-headline">{{ report.headline }}</p>
        <p class="report-score">
          <strong :style="{ color: STATE_COLORS[report.state] }">{{ report.score ?? "–" }}</strong>
          <span v-if="report.role !== 'ventas'">{{ report.state_label }}</span>
        </p>
      </div>
      <p class="report-summary">{{ report.summary }}</p>
      <article class="report-section report-explanation">
        <h3>{{ headings.score_explanation }}</h3>
        <p v-for="paragraph in paragraphs(report.score_explanation)" :key="paragraph">
          {{ paragraph }}
        </p>
      </article>
      <article class="report-section">
        <h3>{{ headings.outlook }}</h3>
        <p v-for="paragraph in paragraphs(report.outlook)" :key="paragraph">
          {{ paragraph }}
        </p>
      </article>
      <aside v-if="report.caveat.trim()" class="report-section report-caveat">
        <h3>{{ headings.caveat }}</h3>
        <p>{{ report.caveat }}</p>
      </aside>
      <article v-if="report.next_steps.length" class="report-section report-steps">
        <h3>{{ headings.next_steps }}</h3>
        <ul>
          <li v-for="step in report.next_steps" :key="step">{{ step }}</li>
        </ul>
      </article>
      <article v-if="decisionSection" class="report-section report-decision">
        <h3>{{ decisionSection.title }}</h3>
        <div class="report-body">
          <p v-for="block in decisionLead" :key="block.source">{{ block.text }}</p>
          <details v-if="decisionDetails.length">
            <summary>Supuestos y límites de la simulación</summary>
            <template v-for="block in decisionDetails" :key="block.source">
              <ul v-if="block.items">
                <li v-for="item in block.items" :key="item">{{ item }}</li>
              </ul>
              <p v-else>{{ block.text }}</p>
            </template>
          </details>
        </div>
        <table v-if="decisionSection.figures.length">
          <tbody>
            <tr v-for="figure in decisionSection.figures" :key="figure.label">
              <th scope="row">{{ figure.label }}</th>
              <td>{{ figureValue(figure.value) }}</td>
              <td>{{ figure.unit }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </section>
</template>

<style scoped>
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}

.panel-title {
  border-bottom: 0;
}

.report-export {
  margin-right: 14px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.report-content {
  padding: 16px 20px 20px;
}

.report-lead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
}

.report-headline {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
}

.report-score {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.report-score strong {
  font-size: 30px;
  line-height: 1;
  color: var(--accent);
}

.report-score span {
  font-size: 12px;
  color: var(--ink-soft);
}

.report-summary {
  margin: 0 0 18px;
  font-size: 14px;
}

.report-section p {
  margin: 0 0 8px;
  color: var(--ink-soft);
}

.report-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--ink-soft);
}

.report-decision details {
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--ink-soft);
}

.report-decision summary {
  cursor: pointer;
  font-weight: 600;
}

.report-caveat {
  padding: 12px 14px;
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
  background: var(--chip-bg);
}

.report-section + .report-caveat,
.report-caveat + .report-section {
  border-top: 0;
}

.report-section + .report-section {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.report-section h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.report-body p,
.report-body ul {
  margin: 0 0 8px;
  color: var(--ink-soft);
}

.report-body ul {
  padding-left: 20px;
}

.report-body :last-child {
  margin-bottom: 0;
}

table {
  width: min(100%, 420px);
  margin-top: 12px;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  text-align: right;
}

th {
  text-align: left;
  font-weight: 500;
  color: var(--ink-soft);
}

.loading {
  margin: 0;
  padding: 16px 20px;
  color: var(--ink-soft);
}

.error {
  padding: 16px 20px;
}

.error p {
  margin: 0 0 4px;
  font-weight: 600;
}

.error small {
  color: var(--ink-soft);
}
</style>
