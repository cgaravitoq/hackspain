<script setup lang="ts">
import {
  type Alert,
  type CompanyDetail,
  type CompanySummary,
  type Explain,
  type GroupMap,
  type Meta,
  type Report,
  ROLE_LABELS,
  type Role,
} from "@hackspain/shared";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "./api.ts";
import AlertList from "./components/AlertList.vue";
import ChatBubble from "./components/ChatBubble.vue";
import GroupStrip from "./components/GroupStrip.vue";
import Radiography from "./components/Radiography.vue";
import RelationGraph from "./components/RelationGraph.vue";
import ReportPanel from "./components/ReportPanel.vue";

const roles = [
  { value: "tesorero", label: ROLE_LABELS.tesorero },
  { value: "financiero", label: ROLE_LABELS.financiero },
  { value: "ventas", label: ROLE_LABELS.ventas },
] satisfies { value: Role; label: string }[];
const TREASURER_COMPANY = "COMP_0176";
const GRAPH_ROUTE = "graph";
const MAX_COMPARED = 3;
const role = ref<Role>("financiero");
const meta = ref<Meta | null>(null);
const alerts = ref<Alert[]>([]);
const companies = ref<CompanySummary[]>([]);
const onGraph = ref(window.location.hash === `#${GRAPH_ROUTE}`);
const selected = ref(onGraph.value ? "" : window.location.hash.slice(1));
const compareIds = ref<string[]>([]);
const comparison = ref<CompanyDetail[]>([]);
const company = ref<CompanyDetail | null>(null);
const explanation = ref<Explain | null>(null);
const group = ref<GroupMap | null>(null);
const error = ref("");
const query = ref("");
let compareRequest = 0;

async function load(companyId: string) {
  error.value = "";
  try {
    const [detail, why] = await Promise.all([
      api.company(companyId),
      api.explain(companyId),
    ]);
    company.value = detail;
    explanation.value = why;
    group.value = detail.group_id ? await api.group(detail.group_id) : null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

function select(companyId: string) {
  if (companyId === GRAPH_ROUTE) {
    return;
  }
  if (role.value === "tesorero") {
    window.location.hash = TREASURER_COMPANY;
    return;
  }
  selected.value = companyId;
}

function openGraph() {
  onGraph.value = true;
  window.location.hash = GRAPH_ROUTE;
}

function openRadiography() {
  onGraph.value = false;
  select(
    selected.value ||
      alerts.value[0]?.company_id ||
      companies.value[0]?.company_id ||
      "",
  );
  window.location.hash = selected.value;
}

function addComparison(companyId: string) {
  if (compareIds.value.includes(companyId)) {
    return;
  }
  compareIds.value = [...compareIds.value, companyId].slice(-MAX_COMPARED);
}

function removeComparison(companyId: string) {
  if (compareIds.value.length === 1) {
    return;
  }
  compareIds.value = compareIds.value.filter((id) => id !== companyId);
  if (selected.value === companyId) {
    select(compareIds.value[0] ?? "");
  }
}

function replaceComparison(companyIds: string[]) {
  compareIds.value = companyIds;
  selected.value = companyIds[0] ?? selected.value;
}

function openReport(
  result: Pick<Report, "company_id" | "role" | "export_url">,
) {
  role.value = result.role;
  selected.value = result.company_id;
}

function selectRole(nextRole: Role) {
  role.value = nextRole;
  if (nextRole === "tesorero") {
    compareIds.value = [TREASURER_COMPANY];
    selected.value = TREASURER_COMPANY;
  }
}

function syncHash() {
  const hash = window.location.hash.slice(1);
  onGraph.value = hash === GRAPH_ROUTE;
  if (!onGraph.value) {
    select(hash);
  }
}

function search() {
  const text = query.value.trim().toUpperCase();
  if (!text) {
    return;
  }
  const hit =
    companies.value.find((item) => item.company_id === text) ??
    companies.value.find((item) => item.company_id.startsWith(text));
  if (hit) {
    select(hit.company_id);
  }
}

watch(
  selected,
  (companyId) => {
    if (companyId) {
      window.location.hash = companyId;
      addComparison(companyId);
      load(companyId);
    }
  },
  { immediate: true },
);

watch(compareIds, async (ids) => {
  const request = ++compareRequest;
  if (role.value === "tesorero" || ids.length === 0) {
    comparison.value = [];
    return;
  }
  try {
    const result = await api.compare(ids);
    if (request === compareRequest) {
      comparison.value = result.companies;
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
});

onMounted(async () => {
  try {
    [meta.value, alerts.value, companies.value] = await Promise.all([
      api.meta(),
      api.alerts(),
      api.companies(),
    ]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    return;
  }
  if (!selected.value && !onGraph.value) {
    selected.value =
      alerts.value[0]?.company_id ?? companies.value[0]?.company_id ?? "";
  }
  window.addEventListener("hashchange", syncHash);
});

onUnmounted(() => window.removeEventListener("hashchange", syncHash));
</script>

<template>
  <header class="topbar">
    <div class="brand">X Ray</div>
    <nav class="route-tabs" aria-label="Pantalla">
      <button
        type="button"
        :class="{ active: !onGraph }"
        :aria-pressed="!onGraph"
        @click="openRadiography"
      >
        Radiografía
      </button>
      <button
        type="button"
        :class="{ active: onGraph }"
        :aria-pressed="onGraph"
        @click="openGraph"
      >
        Grafo
      </button>
    </nav>
    <nav class="role-tabs" aria-label="Perfil">
      <button
        v-for="item in roles"
        :key="item.value"
        type="button"
        :class="{ active: role === item.value }"
        :aria-pressed="role === item.value"
        @click="selectRole(item.value)"
      >
        {{ item.label }}
      </button>
    </nav>
  </header>
  <section v-if="role !== 'tesorero'" class="toolbar" aria-label="Herramientas de empresas">
    <form class="search" @submit.prevent="search">
      <input
        id="company-search"
        v-model="query"
        list="company-ids"
        placeholder="Buscar empresa, p. ej. COMP_0077"
      />
      <datalist id="company-ids">
        <option v-for="item in companies" :key="item.company_id" :value="item.company_id" />
      </datalist>
      <button type="submit">Abrir</button>
    </form>
    <div class="comparator">
      <span class="compare-label">Comparar</span>
      <span v-for="companyId in compareIds" :key="companyId" class="compare-chip">
        {{ companyId }}
        <button
          type="button"
          :aria-label="`Quitar ${companyId}`"
          :disabled="compareIds.length === 1"
          @click="removeComparison(companyId)"
        >
          ×
        </button>
      </span>
      <span class="compare-hint">hasta 3</span>
    </div>
  </section>
  <main v-if="onGraph" class="graph-layout">
    <RelationGraph />
  </main>
  <main v-else class="layout">
    <div class="center">
      <AlertList
        v-if="role !== 'tesorero'"
        :alerts="alerts"
        :selected="selected"
        @select="select"
      />
      <p v-if="error" class="error panel">{{ error }}</p>
      <template v-if="company && explanation">
        <Radiography
          :company="company"
          :explanation="explanation"
          :comparison="comparison.length ? comparison : [company]"
        />
        <ReportPanel :company-id="selected" :role="role" />
        <GroupStrip v-if="group" :group="group" :selected="selected" @select="select" />
      </template>
      <p v-else-if="!error" class="loading">Cargando radiografía…</p>
    </div>
  </main>
  <ChatBubble
    v-if="selected"
    :company-id="selected"
    :alerts="alerts"
    :role="role"
    @compare="replaceComparison"
    @report="openReport"
  />
</template>

<style scoped>
.route-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--chip-bg);
}

.route-tabs button {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
}

.route-tabs button.active {
  background: var(--card);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(15 23 42 / 12%);
}

.graph-layout {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 24px;
  overflow: auto;
}

.role-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--chip-bg);
}

.role-tabs button {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
}

.role-tabs button.active {
  background: var(--card);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(15 23 42 / 12%);
}

.comparator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  white-space: nowrap;
}

.compare-label {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.compare-hint {
  color: var(--muted);
  font-size: 12px;
}

.compare-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 5px 3px 9px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--ink);
  font-weight: 600;
}

.compare-chip button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  line-height: 1;
}

.compare-chip button:not(:disabled):hover {
  background: var(--line);
}

.compare-chip button:disabled {
  opacity: 0.35;
  cursor: default;
}

.search button {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
}

.center {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.loading {
  color: var(--ink-soft);
  padding: 16px;
}
</style>
