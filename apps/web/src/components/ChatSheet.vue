<script setup lang="ts">
import type { Alert, Report, Role } from "@hackspain/shared";
import { nextTick, ref, watch } from "vue";
import ChatPanel from "./ChatPanel.vue";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

type ReportResult = Pick<Report, "company_id" | "role" | "export_url">;

const props = defineProps<{
  alerts: Alert[];
  companyId: string;
  open: boolean;
  role: Role;
}>();

const emit = defineEmits<{
  compare: [companyIds: string[]];
  report: [result: ReportResult];
  "update:open": [open: boolean];
}>();

const panel = ref<HTMLElement | null>(null);

function close() {
  emit("update:open", false);
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return;
    }
    await nextTick();
    panel.value?.querySelector<HTMLInputElement>("#chat-input")?.focus();
  },
);
</script>

<template>
  <Sheet
    :open="props.open"
    :modal="false"
    @update:open="emit('update:open', $event)"
  >
    <SheetContent
      :force-mount="true"
      class="w-full gap-0 p-0 data-[state=closed]:invisible sm:max-w-[420px]"
      :portal-disabled="true"
      side="right"
    >
      <SheetTitle class="sr-only">Asistente</SheetTitle>
      <SheetDescription class="sr-only">
        Consulta y compara la salud financiera de las empresas.
      </SheetDescription>
      <div ref="panel" v-show="props.open" class="chat-sheet-body">
        <ChatPanel
          :company-id="props.companyId"
          :alerts="props.alerts"
          :role="props.role"
          @close="close"
          @compare="emit('compare', $event)"
          @report="emit('report', $event)"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.chat-sheet-body,
.chat-sheet-body :deep(.chat) {
  height: 100%;
}

.chat-sheet-body :deep(.chat) {
  overflow: hidden;
  border: 0;
  border-radius: 0;
}
</style>
