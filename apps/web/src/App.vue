<script setup lang="ts">
import type {
  Alert,
  CompanyDetail,
  CompanySummary,
  Explain,
  GroupMap,
  Meta,
  Report,
  Role,
} from "@hackspain/shared";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "./api.ts";
import AppSidebar from "./components/AppSidebar.vue";
import ChatPopover from "./components/ChatPopover.vue";
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

const props = defineProps<{ initialRole?: Role }>();

const DEFAULT_COMPANY = "COMP_0471";
const GRAPH_ROUTE = "graph";
const MAX_COMPARED = 3;
const CHAT_SEEN_KEY = "xray.chat.seen";
const role = ref<Role>(props.initialRole ?? "financiero");
const meta = ref<Meta | null>(null);
const alerts = ref<Alert[]>([]);
const companies = ref<CompanySummary[]>([]);
const onGraph = ref(window.location.hash === `#${GRAPH_ROUTE}`);
const selected = ref(onGraph.value ? "" : window.location.hash.slice(1));
const compareIds = ref<string[]>([]);
if (role.value === "tesorero") {
  onGraph.value = false;
  selected.value = DEFAULT_COMPANY;
  compareIds.value = [DEFAULT_COMPANY];
}
const comparison = ref<CompanyDetail[]>([]);
const company = ref<CompanyDetail | null>(null);
const explanation = ref<Explain | null>(null);
const group = ref<GroupMap | null>(null);
const error = ref("");
const chatOpen = ref(false);
const chatSeen = ref(false);
let compareRequest = 0;
let companyRequest = 0;

function toggleChat() {
  chatOpen.value = !chatOpen.value;
  if (!chatOpen.value) {
    return;
  }
  chatSeen.value = true;
  try {
    window.localStorage.setItem(CHAT_SEEN_KEY, "true");
  } catch {
    chatSeen.value = true;
  }
}

watch(role, (nextRole) => {
  if (nextRole === "tesorero" && onGraph.value) {
    openRadiography();
  }
});

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
    window.location.hash = DEFAULT_COMPANY;
    return;
  }
  selected.value = companyId;
}

function defaultCompany() {
  return (
    companies.value.find(({ company_id }) => company_id === DEFAULT_COMPANY)
      ?.company_id ??
    companies.value[0]?.company_id ??
    ""
  );
}

function openGraph() {
  if (role.value === "tesorero") {
    openRadiography();
    return;
  }
  onGraph.value = true;
  window.location.hash = GRAPH_ROUTE;
}

function analyzeFromGraph(companyId: string) {
  onGraph.value = false;
  openCompany(companyId);
}

function openRadiography() {
  onGraph.value = false;
  select(selected.value || defaultCompany());
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
  if (!companyIds.includes(selected.value)) {
    selected.value = companyIds[0] ?? selected.value;
  }
}

function openReport(
  result: Pick<Report, "company_id" | "role" | "export_url">,
) {
  role.value = result.role;
  compareIds.value = [result.company_id];
  selected.value = result.company_id;
}

function syncHash() {
  const hash = window.location.hash.slice(1);
  if (hash === GRAPH_ROUTE && role.value === "tesorero") {
    openRadiography();
    return;
  }
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
    chatSeen.value = window.localStorage.getItem(CHAT_SEEN_KEY) === "true";
  } catch {
    chatSeen.value = false;
  }
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
    selected.value = defaultCompany();
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
      :chat-open="chatOpen"
      :chat-unread="!chatSeen"
      :chat-disabled="!selected"
      @view="selectView"
      @chat="toggleChat"
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
            :comparing="compareIds.length > 1"
            @remove="removeComparison"
            @select="select"
          />
          <p v-else-if="!error" class="loading">Cargando radiografía…</p>
        </div>
      </div>
    </SidebarInset>
    <ChatPopover
      v-if="selected"
      :open="chatOpen"
      :company-id="selected"
      :compare-ids="compareIds"
      :alerts="alerts"
      :role="role"
      @close="chatOpen = false"
      @compare="replaceComparison"
      @report="openReport"
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
