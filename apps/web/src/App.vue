<script setup lang="ts">
import {
  type Alert,
  type CompanyDetail,
  type CompanySummary,
  type Explain,
  type GroupMap,
  type Meta,
  ROLE_LABELS,
  type Role,
} from "@hackspain/shared";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "./api.ts";
import AlertList from "./components/AlertList.vue";
import ChatPanel from "./components/ChatPanel.vue";
import GroupStrip from "./components/GroupStrip.vue";
import Radiography from "./components/Radiography.vue";
import ReportPanel from "./components/ReportPanel.vue";
import { monthLabel } from "./format.ts";

const roles = [
  { value: "tesorero", label: ROLE_LABELS.tesorero },
  { value: "financiero", label: ROLE_LABELS.financiero },
  { value: "ventas", label: ROLE_LABELS.ventas },
] satisfies { value: Role; label: string }[];
const TREASURER_COMPANY = "COMP_0176";
const role = ref<Role>("financiero");
const meta = ref<Meta | null>(null);
const alerts = ref<Alert[]>([]);
const companies = ref<CompanySummary[]>([]);
const selected = ref(window.location.hash.slice(1));
const compareIds = ref<string[]>([]);
const comparison = ref<CompanyDetail[]>([]);
const company = ref<CompanyDetail | null>(null);
const explanation = ref<Explain | null>(null);
const group = ref<GroupMap | null>(null);
const error = ref("");
const query = ref("");

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
  if (role.value === "tesorero") {
    window.location.hash = TREASURER_COMPANY;
    return;
  }
  selected.value = companyId;
}

function addComparison(companyId: string) {
  if (!compareIds.value.includes(companyId) && compareIds.value.length < 3) {
    compareIds.value = [...compareIds.value, companyId];
  }
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

function selectRole(nextRole: Role) {
  role.value = nextRole;
  if (nextRole === "tesorero") {
    compareIds.value = [TREASURER_COMPANY];
    selected.value = TREASURER_COMPANY;
  }
}

function syncHash() {
  select(window.location.hash.slice(1));
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
  if (role.value === "tesorero" || ids.length === 0) {
    comparison.value = [];
    return;
  }
  try {
    comparison.value = (await api.compare(ids)).companies;
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
  if (!selected.value) {
    selected.value =
      alerts.value[0]?.company_id ?? companies.value[0]?.company_id ?? "";
  }
  window.addEventListener("hashchange", syncHash);
});

onUnmounted(() => window.removeEventListener("hashchange", syncHash));
</script>

<template>
  <header class="topbar">
    <div class="brand">
      X Ray
      <small>salud financiera de cada empresa, cada mes</small>
    </div>
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
    <span v-if="meta" class="month">datos hasta {{ monthLabel(meta.latest_month) }}</span>
    <form v-if="role !== 'tesorero'" class="search" @submit.prevent="search">
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
  </header>
  <main class="layout" :class="{ 'without-alerts': role === 'tesorero' }">
    <AlertList
      v-if="role !== 'tesorero'"
      :alerts="alerts"
      :selected="selected"
      @select="select"
    />
    <div class="center">
      <div v-if="role !== 'tesorero' && compareIds.length" class="compare-selector panel">
        <span>Comparar</span>
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
      </div>
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
    <ChatPanel
      v-if="selected"
      :key="selected"
      :company-id="selected"
      :alerts="alerts"
      :role="role"
    />
  </main>
</template>

<style scoped>
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

.without-alerts {
  grid-template-columns: minmax(0, 1fr) 360px;
}

.month {
  font-size: 13px;
  color: var(--ink-soft);
}

.compare-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  color: var(--ink-soft);
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
