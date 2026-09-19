<script setup lang="ts">
import type {
  Alert,
  CommitmentDraft,
  CommitmentDraftResult,
  CommitmentRequest,
  CommitmentResponse,
  CompanyDetail,
  CompanySummary,
  Explain,
  GroupMap,
  Meta,
  Report,
  Role,
} from "@hackspain/shared";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "./api.ts";
import AppSidebar from "./components/AppSidebar.vue";
import ChatBubble from "./components/ChatBubble.vue";
import CommitmentPanel from "./components/CommitmentPanel.vue";
import CompanySelector from "./components/CompanySelector.vue";
import Radiography from "./components/Radiography.vue";
import RelationGraph from "./components/RelationGraph.vue";
import { Separator } from "./components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";

type View = "radiography" | "graph";

const TREASURER_COMPANY = "COMP_0176";
const GRAPH_ROUTE = "graph";
const MAX_COMPARED = 3;
const role = ref<Role>("financiero");
const commitmentOpen = ref(false);
const commitmentDraft = ref<CommitmentDraft | null>(null);
type TellMeHandle = { sendConfirmation: () => void };
const tellMe = ref<TellMeHandle | null>(null);
const confirmedCommitment = ref<CommitmentRequest | null>(null);
const commitmentResult = ref<CommitmentResponse | null>(null);
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
let compareRequest = 0;
let companyRequest = 0;

function invalidateCommitment() {
  confirmedCommitment.value = null;
  commitmentResult.value = null;
}

function closeCommitment() {
  commitmentOpen.value = false;
  commitmentDraft.value = null;
  invalidateCommitment();
}

function openDraft(result: CommitmentDraftResult) {
  if (result.company_id === selected.value) {
    commitmentDraft.value = result.draft;
    commitmentOpen.value = true;
  }
}

async function confirmCommitment(
  request: CommitmentRequest,
  result: CommitmentResponse,
) {
  if (result.evaluation.company_id !== selected.value) {
    return;
  }
  confirmedCommitment.value = request;
  commitmentResult.value = result;
  await nextTick();
  tellMe.value?.sendConfirmation();
}

function showChatCommitment(result: CommitmentResponse) {
  if (
    confirmedCommitment.value &&
    result.evaluation.company_id === selected.value
  ) {
    commitmentResult.value = result;
  }
}

watch([selected, role], closeCommitment);

async function load(companyId: string) {
  const request = ++companyRequest;
  error.value = "";
  try {
    const [detail, why] = await Promise.all([
      api.company(companyId),
      api.explain(companyId),
    ]);
    if (request !== companyRequest) return;
    company.value = detail;
    explanation.value = why;
    const nextGroup = detail.group_id ? await api.group(detail.group_id) : null;
    if (request === companyRequest) group.value = nextGroup;
  } catch (cause) {
    if (request === companyRequest)
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

function analyzeFromGraph(companyId: string) {
  onGraph.value = false;
  select(companyId);
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

function selectView(view: View) {
  if (view === "graph") {
    openGraph();
    return;
  }
  openRadiography();
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
  compareIds.value = [result.company_id];
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

onUnmounted(() => {
  companyRequest++;
  compareRequest++;
  window.removeEventListener("hashchange", syncHash);
});
</script>

<template>
  <SidebarProvider>
    <AppSidebar
      :view="onGraph ? 'graph' : 'radiography'"
      :role="role"
      @role="selectRole"
      @view="selectView"
    />
    <SidebarInset>
      <header class="topbar">
        <SidebarTrigger />
        <Separator orientation="vertical" class="h-4" />
        <h2 class="view-title">{{ onGraph ? "Grafo" : "Radiografía" }}</h2>
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
      <div v-if="onGraph" class="graph-layout">
        <RelationGraph @analyze="analyzeFromGraph" />
      </div>
      <div v-else class="layout">
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
            :decision-section="commitmentResult?.report_section"
            :comparing="compareIds.length > 1"
            @remove="removeComparison"
            @select="select"
          />
          <CommitmentPanel
            v-if="company && explanation && commitmentOpen"
            :key="selected"
            :company-id="selected"
            :draft="commitmentDraft"
            @evaluated="confirmCommitment"
            @invalidated="invalidateCommitment"
            @closed="closeCommitment"
          />
          <button
            v-else-if="company && explanation"
            type="button"
            class="open-commitment"
            @click="commitmentOpen = true"
          >
            Evaluar una operación
          </button>
          <p v-else-if="!error" class="loading">Cargando radiografía…</p>
        </div>
      </div>
    </SidebarInset>
    <ChatBubble
      v-if="selected"
      ref="tellMe"
      :company-id="selected"
      :alerts="alerts"
      :role="role"
      :confirmed-commitment="confirmedCommitment"
      @compare="replaceComparison"
      @report="openReport"
      @commitment="showChatCommitment"
      @draft="openDraft"
    />
  </SidebarProvider>
</template>

<style scoped>
.view-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.topbar :deep(.company-selector) {
  margin-left: auto;
}

.graph-layout {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 24px;
  overflow: hidden;
}

.open-commitment {
  align-self: flex-start;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  color: var(--accent);
  font-weight: 600;
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
