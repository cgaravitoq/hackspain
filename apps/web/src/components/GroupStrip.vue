<script setup lang="ts">
import type { GroupMap } from "@hackspain/shared";
import { euro, STATE_COLORS } from "../format.ts";

defineProps<{ group: GroupMap; selected: string }>();
const emit = defineEmits<{ select: [companyId: string] }>();
</script>

<template>
  <section class="panel group">
    <h2 class="panel-title">
      Grupo {{ group.group_id }} · {{ group.n_companies }} empresas
      <span v-if="group.debt_outstanding > 0" class="debt">deuda {{ euro(group.debt_outstanding) }}</span>
      <span v-if="group.tension" class="tension">grupo en tensión</span>
    </h2>
    <p v-if="group.tension_reason" class="reason">{{ group.tension_reason }}</p>
    <ul>
      <li v-for="member in group.members" :key="member.company_id">
        <button
          type="button"
          :class="{ active: member.company_id === selected }"
          :style="{ borderColor: STATE_COLORS[member.state] }"
          @click="emit('select', member.company_id)"
        >
          <span class="id">{{ member.name }}</span>
          <span class="score">{{ member.score ?? "–" }}</span>
          <span class="state" :style="{ color: STATE_COLORS[member.state] }">{{ member.state_label }}</span>
          <span v-if="member.debt_share && member.debt_share >= 0.01" class="share">{{ Math.round(member.debt_share * 100) }} % deuda</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.debt {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}

.tension {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--falling);
  color: #fff;
  letter-spacing: 0.04em;
}

.reason {
  margin: 0;
  padding: 10px 16px 0;
  color: var(--falling);
  font-size: 13px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 12px 16px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 10px;
  row-gap: 2px;
  padding: 8px 12px;
  border: 1px solid;
  border-left-width: 4px;
  border-radius: 6px;
  background: var(--card);
  text-align: left;
}

button.active {
  background: var(--chip-bg);
}

.id {
  font-weight: 600;
}

.score {
  text-align: right;
  font-weight: 600;
}

.state {
  font-size: 12px;
}

.share {
  font-size: 12px;
  color: var(--ink-soft);
  text-align: right;
}
</style>
