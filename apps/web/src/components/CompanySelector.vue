<script setup lang="ts">
import {
  type Alert,
  type CompanyDetail,
  type CompanySummary,
  STATE_LABELS,
} from "@hackspain/shared";
import { computed, ref } from "vue";
import { points, STATE_COLORS } from "../format.ts";
import { Badge } from "./ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const MAX_COMPARED = 3;

const props = defineProps<{
  alerts: Alert[];
  companies: CompanySummary[];
  company: CompanyDetail | null;
  selected: string;
  comparison: string[];
}>();

const emit = defineEmits<{
  compare: [companyIds: string[]];
  open: [companyId: string];
}>();

const open = ref(false);
const alertIds = computed(
  () => new Set(props.alerts.map((alert) => alert.company_id)),
);
const otherCompanies = computed(() =>
  props.companies.filter((item) => !alertIds.value.has(item.company_id)),
);
const monthDelta = computed(() => {
  if (!props.company) {
    return null;
  }
  const scores = props.company.series
    .map((entry) => entry.score)
    .filter((score) => score !== null);
  const latest = scores.at(-1);
  const previous = scores.at(-2);
  return latest === undefined || previous === undefined
    ? null
    : latest - previous;
});

function openCompany(companyId: string) {
  emit("open", companyId);
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
</script>

<template>
  <div class="company-selector">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="selector-trigger"
          aria-label="Seleccionar empresa"
        >
          <span>{{ selected }}</span>
          <span class="selector-delta">{{ points(monthDelta) }}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="selector-popover w-[420px] p-0"
        :portal-disabled="true"
      >
        <Command>
          <CommandInput
            id="company-search"
            placeholder="Buscar empresa..."
          />
          <CommandList class="selector-list">
            <CommandEmpty>No hay empresas que coincidan.</CommandEmpty>
            <CommandGroup heading="Alertas del mes">
              <CommandItem
                v-for="alert in alerts"
                :key="alert.company_id"
                class="company-option"
                :value="alert.company_id"
                @select="openCompany(alert.company_id)"
              >
                <span class="company-id">{{ alert.company_id }}</span>
                <Badge
                  class="state-badge"
                  :style="{ background: STATE_COLORS[alert.state] }"
                >
                  {{ STATE_LABELS[alert.state] }}
                </Badge>
                <span class="company-delta">{{ points(alert.delta) }}</span>
                <button
                  type="button"
                  class="compare-toggle"
                  :aria-pressed="comparison.includes(alert.company_id)"
                  :disabled="!canCompare(alert.company_id)"
                  @pointerdown.stop
                  @click.stop="toggleComparison(alert.company_id)"
                >
                  Comparar
                </button>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Todas">
              <CommandItem
                v-for="item in otherCompanies"
                :key="item.company_id"
                class="company-option"
                :value="item.company_id"
                @select="openCompany(item.company_id)"
              >
                <span class="company-id">{{ item.company_id }}</span>
                <button
                  type="button"
                  class="compare-toggle"
                  :aria-pressed="comparison.includes(item.company_id)"
                  :disabled="!canCompare(item.company_id)"
                  @pointerdown.stop
                  @click.stop="toggleComparison(item.company_id)"
                >
                  Comparar
                </button>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        <footer class="selector-footer">
          <span>Comparando {{ comparison.length }}</span>
          <span aria-hidden="true">·</span>
          <button type="button" @click="emit('compare', [])">Limpiar</button>
        </footer>
      </PopoverContent>
    </Popover>
    <span v-for="companyId in comparison" :key="companyId" class="compare-chip">
      {{ companyId }}
      <button
        type="button"
        :aria-label="`Quitar ${companyId}`"
        @click="toggleComparison(companyId)"
      >
        ×
      </button>
    </span>
  </div>
</template>

<style scoped>
.company-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  min-width: 0;
}

.selector-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--card);
  font-weight: 600;
  white-space: nowrap;
}

.selector-trigger:hover {
  background: var(--paper);
}

.selector-delta {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 500;
}

.selector-popover {
  overflow: hidden;
}

.selector-list {
  max-height: 360px;
}

.company-option {
  gap: 8px;
  padding: 8px;
}

.company-id {
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

.compare-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px 2px 8px;
  border-radius: 999px;
  background: var(--chip-bg);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.compare-chip button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  line-height: 1;
}

.compare-chip button:hover {
  background: var(--line);
}
</style>
