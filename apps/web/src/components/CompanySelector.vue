<script setup lang="ts">
import {
  type Alert,
  type CompanySummary,
  STATE_LABELS,
} from "@hackspain/shared";
import { computed, ref } from "vue";
import { points, STATE_COLORS } from "../format.ts";
import { Badge } from "./ui/badge";

const MAX_COMPARED = 3;
const SEARCH_RESULTS_LIMIT = 8;

const props = defineProps<{
  alerts: Alert[];
  companies: CompanySummary[];
  selected: string;
  comparison: string[];
}>();

const emit = defineEmits<{
  compare: [companyIds: string[]];
  open: [companyId: string];
}>();

const open = ref(false);
const query = ref("");
const alertsByCompany = computed(
  () => new Map(props.alerts.map((alert) => [alert.company_id, alert])),
);
const results = computed(() => {
  const text = query.value.trim().toUpperCase();
  const byId = new Map<string, CompanySummary>();
  for (const company of props.companies) {
    byId.set(company.company_id, company);
  }
  return [...byId.values()]
    .filter(
      (item) =>
        !text ||
        item.name.toUpperCase().includes(text) ||
        item.company_id.toUpperCase().includes(text),
    )
    .slice(0, SEARCH_RESULTS_LIMIT);
});

function openCompany(companyId: string) {
  emit("open", companyId);
  query.value = "";
  open.value = false;
}

function toggleComparison(companyId: string) {
  if (props.comparison.includes(companyId)) {
    emit(
      "compare",
      props.comparison.filter((id) => id !== companyId),
    );
    return;
  }
  if (props.comparison.length < MAX_COMPARED) {
    emit("compare", [...props.comparison, companyId]);
  }
}

function canCompare(companyId: string): boolean {
  return (
    props.comparison.includes(companyId) ||
    props.comparison.length < MAX_COMPARED
  );
}

function leaveSearch(event: FocusEvent) {
  const container = event.currentTarget;
  if (
    container instanceof HTMLElement &&
    event.relatedTarget instanceof Node &&
    container.contains(event.relatedTarget)
  ) {
    return;
  }
  window.setTimeout(() => {
    open.value = false;
  }, 0);
}
</script>

<template>
  <div class="company-selector" @focusout="leaveSearch">
    <input
      id="company-search"
      v-model="query"
      role="combobox"
      aria-label="Buscar empresa"
      aria-autocomplete="list"
      aria-controls="company-results"
      :aria-expanded="open"
      autocomplete="off"
      :placeholder="`Buscar entre ${companies.length} empresas`"
      @focus="open = true"
      @input="open = true"
      @keydown.escape="open = false"
    />
    <div v-if="open" id="company-results" class="selector-popover" role="listbox">
      <p v-if="results.length === 0" class="empty">No hay empresas que coincidan.</p>
      <div
        v-for="item in results"
        :key="item.company_id"
        class="option-row"
        :data-company-id="item.company_id"
      >
        <button
          type="button"
          class="company-option"
          role="option"
          :aria-selected="selected === item.company_id"
          @pointerdown.prevent="openCompany(item.company_id)"
          @click="openCompany(item.company_id)"
        >
          <span class="company-name">{{ item.name }}</span>
          <template v-if="alertsByCompany.get(item.company_id)">
            <Badge
              class="state-badge"
              :style="{
                background: STATE_COLORS[alertsByCompany.get(item.company_id)!.state],
              }"
            >
              {{ STATE_LABELS[alertsByCompany.get(item.company_id)!.state] }}
            </Badge>
            <span class="company-delta">
              {{ points(alertsByCompany.get(item.company_id)!.delta) }}
            </span>
          </template>
        </button>
        <button
          type="button"
          class="compare-toggle"
          :aria-pressed="comparison.includes(item.company_id)"
          :disabled="!canCompare(item.company_id)"
          @pointerdown.prevent.stop
          @click.stop="toggleComparison(item.company_id)"
        >
          Comparar
        </button>
      </div>
      <footer class="selector-footer">
        <span>Comparando {{ comparison.length }}</span>
        <span aria-hidden="true">·</span>
        <button type="button" @click="emit('compare', [])">Limpiar</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.company-selector {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: auto;
  min-width: 0;
}

.company-selector > input {
  width: min(320px, 36vw);
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--card);
}

.selector-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  right: 0;
  width: 420px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 8px 24px rgb(22 32 42 / 14%);
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px;
}

.company-option {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  text-align: left;
}

.company-option:hover,
.company-option:focus-visible {
  background: var(--chip-bg);
  outline: none;
}

.company-name {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
}

.state-badge {
  color: #fff;
}

.company-delta {
  margin-left: auto;
  color: var(--ink-soft);
  font-size: 12px;
}

.compare-toggle {
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--card);
  color: var(--ink-soft);
  font-size: 12px;
}

.compare-toggle[aria-pressed="true"] {
  border-color: var(--accent);
  background: #eff6ff;
  color: var(--accent);
}

.compare-toggle:disabled {
  cursor: default;
  opacity: 0.4;
}

.selector-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 12px;
}

.selector-footer button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-weight: 600;
}

.empty {
  margin: 0;
  padding: 14px;
  color: var(--ink-soft);
  text-align: center;
}
</style>
