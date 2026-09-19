<script setup lang="ts">
import type { CompanyDetail, Explain, GroupMap, Role } from "@hackspain/shared";
import { computed, ref } from "vue";
import {
  COMPONENT_CODES,
  componentLabel,
  euro,
  eventLabel,
  points,
} from "../format.ts";
import DecisionPanel from "./DecisionPanel.vue";
import GroupStrip from "./GroupStrip.vue";
import ReportPanel from "./ReportPanel.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const props = defineProps<{
  company: CompanyDetail;
  explanation: Explain;
  group: GroupMap | null;
  selected: string;
  role: Role;
}>();
const emit = defineEmits<{ select: [companyId: string] }>();

const TABS = [
  { id: "action", label: "Acción" },
  { id: "decision", label: "Decisión" },
  { id: "why", label: "Por qué" },
  { id: "changed", label: "Qué cambió" },
  { id: "report", label: "Informe" },
  { id: "group", label: "Grupo" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const active = ref<TabId>("action");

const tabs = computed(() =>
  TABS.filter((tab) => tab.id !== "group" || props.group !== null),
);

const current = computed<TabId>(() =>
  active.value === "group" && props.group === null ? "action" : active.value,
);

const framed = computed(
  () =>
    current.value !== "decision" &&
    current.value !== "report" &&
    current.value !== "group",
);

const mainDrivers = computed(() =>
  props.explanation.drivers.filter((driver) => driver.contribution !== 0),
);

const contextDrivers = computed(() =>
  props.explanation.drivers.filter(
    (driver) => driver.contribution === 0 && !COMPONENT_CODES.has(driver.code),
  ),
);

const sources = computed(() =>
  Object.entries(props.explanation.evidence.sources)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .join(", "),
);
</script>

<template>
  <Tabs :model-value="current" class="details">
    <TabsList class="tabs" aria-label="Detalle de la empresa">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        @click="active = tab.id"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      :value="current"
      :class="{ panel: framed, body: framed }"
    >
      <p v-if="current === 'action'" class="action">{{ explanation.action }}</p>

      <DecisionPanel
        v-else-if="current === 'decision'"
        :company-id="selected"
        :role="role"
      />

      <template v-else-if="current === 'why'">
        <ul class="drivers">
          <li v-for="driver in mainDrivers" :key="driver.code">
            <span class="contribution" :class="{ negative: driver.contribution < 0, positive: driver.contribution > 0 }">
              {{ points(driver.contribution) }}
            </span>
            <span>{{ driver.text }}</span>
          </li>
          <li v-for="driver in contextDrivers" :key="driver.code" class="context">
            <span class="contribution">ctx</span>
            <span>{{ driver.text }}</span>
          </li>
        </ul>
        <ul v-if="explanation.events.length" class="events">
          <li v-for="event in explanation.events" :key="event">
            <strong>{{ event }}</strong> {{ eventLabel(event) }}
          </li>
        </ul>
        <dl class="evidence">
          <div><dt>Ventana</dt><dd>{{ explanation.evidence.window ?? "–" }}</dd></div>
          <div><dt>Transacciones</dt><dd>{{ explanation.evidence.transactions_in_window }}</dd></div>
          <div><dt>Sin categoría</dt><dd>{{ Math.round(explanation.evidence.share_uncategorised * 100) }} %</dd></div>
          <div><dt>Fuentes</dt><dd>{{ sources }}</dd></div>
          <div v-if="company.debt_outstanding > 0"><dt>Deuda viva</dt><dd>{{ euro(company.debt_outstanding) }}</dd></div>
          <div v-if="explanation.invoice_facts.overdue_count"><dt>Facturas vencidas</dt><dd>{{ explanation.invoice_facts.overdue_count }} · {{ euro(explanation.invoice_facts.overdue_amount ?? 0) }}</dd></div>
          <div><dt>Regla</dt><dd>{{ explanation.evidence.rule_version }}</dd></div>
        </dl>
      </template>

      <template v-else-if="current === 'changed'">
        <ul v-if="explanation.changed.length" class="changed">
          <li v-for="item in explanation.changed" :key="item.code">
            <span class="contribution" :class="{ negative: item.delta < 0, positive: item.delta > 0 }">{{ points(item.delta) }}</span>
            <span>{{ componentLabel(item.code) }}</span>
          </li>
        </ul>
        <p v-else class="quiet">Sin cambios frente al mes anterior.</p>
      </template>

      <ReportPanel v-else-if="current === 'report'" :company-id="selected" :role="role" />

      <GroupStrip
        v-else-if="group"
        :group="group"
        :selected="selected"
        @select="emit('select', $event)"
      />
    </TabsContent>
  </Tabs>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabs {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--chip-bg);
}

.tabs :deep([data-slot="tabs-trigger"]) {
  padding: 5px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
}

.tabs :deep([data-state="active"]) {
  background: var(--card);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(15 23 42 / 12%);
}

.body {
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.action {
  margin: 0;
  padding: 14px 16px;
  border-left: 3px solid var(--accent);
  background: var(--chip-bg);
  border-radius: 0 6px 6px 0;
  font-size: 15px;
  font-weight: 500;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drivers li,
.changed li {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
  align-items: baseline;
}

.context {
  color: var(--ink-soft);
}

.contribution {
  font-weight: 600;
  text-align: right;
  color: var(--ink-soft);
}

.contribution.negative {
  color: var(--falling);
}

.contribution.positive {
  color: var(--healthy);
}

.events li {
  font-size: 13px;
  color: var(--falling);
}

.quiet {
  margin: 0;
  color: var(--ink-soft);
}

.evidence {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}

.evidence div {
  display: flex;
  gap: 6px;
  font-size: 12px;
}

dt {
  color: var(--ink-soft);
}

dd {
  margin: 0;
  font-weight: 600;
}
</style>
