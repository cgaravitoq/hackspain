<script setup lang="ts">
import type {
  Alert,
  CompanyDetail,
  Explain,
  GroupMap,
  Role,
} from "@hackspain/shared";
import { CONFIDENCE_LABELS, monthLabel } from "../format.ts";
import DetailTabs from "./DetailTabs.vue";
import KpiCards from "./KpiCards.vue";
import Sparkline from "./Sparkline.vue";
import { Card } from "./ui/card";

defineProps<{
  company: CompanyDetail;
  explanation: Explain;
  comparison: CompanyDetail[];
  alerts: Alert[];
  group: GroupMap | null;
  selected: string;
  role: Role;
}>();
const emit = defineEmits<{ select: [companyId: string] }>();
</script>

<template>
  <section class="radiography">
    <header class="head">
      <h1>{{ company.company_id }}</h1>
      <p class="meta">
        {{ monthLabel(explanation.month) }} · {{ company.months_observed }} meses observados ·
        {{ CONFIDENCE_LABELS[explanation.confidence] }}
        <span v-if="company.holdout" class="holdout">held-out</span>
      </p>
    </header>

    <KpiCards :company="company" :explanation="explanation" :alerts="alerts" />

    <Card class="chart-card">
      <Sparkline :companies="comparison" />
    </Card>

    <DetailTabs
      :company="company"
      :explanation="explanation"
      :group="group"
      :selected="selected"
      :role="role"
      @select="emit('select', $event)"
    />
  </section>
</template>

<style scoped>
.radiography {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head {
  padding: 4px 2px 0;
}

.chart-card {
  display: block;
  gap: 0;
  padding: 0;
  background: var(--card);
  border-radius: 10px;
}

h1 {
  margin: 0;
  font-size: 22px;
}

.meta {
  margin: 4px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.holdout {
  margin-left: 8px;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
