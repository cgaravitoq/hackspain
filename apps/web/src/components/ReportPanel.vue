<script setup lang="ts">
import type { Report, Role } from "@hackspain/shared";
import { computed, ref, watch } from "vue";
import { api } from "../api.ts";

const props = defineProps<{ companyId: string; role: Role }>();

const report = ref<Report | null>(null);
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
    <div v-else-if="report" class="report-content">
      <p class="report-summary">{{ report.summary }}</p>
      <article v-for="section in report.sections" :key="section.code" class="report-section">
        <h3>{{ section.title }}</h3>
        <div class="report-body">
          <template v-for="block in blocks(section.body)" :key="block.source">
            <ul v-if="block.items">
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ul>
            <p v-else>{{ block.text }}</p>
          </template>
        </div>
        <table v-if="section.figures.length">
          <tbody>
            <tr v-for="figure in section.figures" :key="figure.label">
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

.report-summary {
  margin: 0 0 18px;
  font-size: 16px;
  font-weight: 600;
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
