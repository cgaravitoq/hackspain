<script setup lang="ts">
import {
  type Alert,
  type CommitmentEvaluation,
  type CommitmentRequest,
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
import ChatBubble from "./components/ChatBubble.vue";
import CompanySelector from "./components/CompanySelector.vue";
import Radiography from "./components/Radiography.vue";
import RelationGraph from "./components/RelationGraph.vue";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";

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
const commitmentLaunch = ref<{
  token: number;
  assumptions: CommitmentRequest;
} | null>(null);
let compareRequest = 0;
let commitmentToken = 0;

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

function openCompany(companyId: string) {
  compareIds.value = [companyId];
  select(companyId);
}

function setComparison(companyIds: string[]) {
  compareIds.value = companyIds;
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

function openCommitment(
  result: Pick<CommitmentEvaluation, "company_id" | "assumptions">,
) {
  if (role.value === "ventas") {
    role.value = "financiero";
  }
  onGraph.value = false;
  selected.value = result.company_id;
  window.location.hash = result.company_id;
  commitmentToken += 1;
  commitmentLaunch.value = {
    token: commitmentToken,
    assumptions: result.assumptions,
  };
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
    <Tabs :model-value="onGraph ? GRAPH_ROUTE : 'radiography'">
      <TabsList class="route-tabs" aria-label="Pantalla">
        <TabsTrigger value="radiography" @click="openRadiography">
          Radiografía
        </TabsTrigger>
        <TabsTrigger :value="GRAPH_ROUTE" @click="openGraph">Grafo</TabsTrigger>
      </TabsList>
    </Tabs>
    <Tabs :model-value="role">
      <TabsList class="role-tabs" aria-label="Perfil">
        <TabsTrigger
        v-for="item in roles"
        :key="item.value"
        :value="item.value"
        @click="selectRole(item.value)"
      >
        {{ item.label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
    <CompanySelector
      v-if="role !== 'tesorero'"
      :alerts="alerts"
      :companies="companies"
      :company="company"
      :selected="selected"
      :comparison="compareIds"
      @open="openCompany"
      @compare="setComparison"
    />
  </header>
  <main v-if="onGraph" class="graph-layout">
    <RelationGraph />
  </main>
  <main v-else class="layout">
    <div class="center">
      <p v-if="error" class="error panel">{{ error }}</p>
      <Radiography
        v-if="company && explanation"
        :company="company"
        :explanation="explanation"
        :comparison="comparison.length ? comparison : [company]"
        :alerts="alerts"
        :group="group"
        :selected="selected"
        :role="role"
        :commitment-launch="commitmentLaunch"
        @select="select"
      />
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
    @commitment="openCommitment"
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

.route-tabs :deep([data-slot="tabs-trigger"]) {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
}

.route-tabs :deep([data-state="active"]) {
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

.role-tabs :deep([data-slot="tabs-trigger"]) {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
}

.role-tabs :deep([data-state="active"]) {
  background: var(--card);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(15 23 42 / 12%);
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
