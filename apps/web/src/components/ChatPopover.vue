<script setup lang="ts">
import type {
  Alert,
  CommitmentDraftResult,
  CommitmentRequest,
  CommitmentResponse,
  Report,
  Role,
} from "@hackspain/shared";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ChatPanel from "./ChatPanel.vue";

type ReportResult = Pick<Report, "company_id" | "role" | "export_url">;

const props = defineProps<{
  open: boolean;
  companyId: string;
  compareIds: string[];
  alerts: Alert[];
  role: Role;
  confirmedCommitment?: CommitmentRequest | null;
}>();

const emit = defineEmits<{
  close: [];
  compare: [companyIds: string[]];
  report: [result: ReportResult];
  commitment: [result: CommitmentResponse];
  draft: [result: CommitmentDraftResult];
}>();

const panel = ref<HTMLElement | null>(null);
const chatPanel = ref<{ sendConfirmation: () => void } | null>(null);

function sendConfirmation() {
  chatPanel.value?.sendConfirmation();
}

defineExpose({ sendConfirmation });

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick();
      panel.value?.querySelector<HTMLInputElement>("#chat-input")?.focus();
    }
  },
);

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div
    ref="panel"
    v-show="open"
    class="chat-popover"
    role="dialog"
    aria-label="Asistente"
  >
    <ChatPanel
      ref="chatPanel"
      :company-id="props.companyId"
      :compare-ids="props.compareIds"
      :alerts="props.alerts"
      :role="props.role"
      :confirmed-commitment="props.confirmedCommitment"
      @close="emit('close')"
      @compare="emit('compare', $event)"
      @report="emit('report', $event)"
      @commitment="emit('commitment', $event)"
      @draft="emit('draft', $event)"
    />
  </div>
</template>

<style scoped>
.chat-popover {
  position: fixed;
  left: calc(var(--sidebar-width) + 16px);
  bottom: 16px;
  z-index: 30;
  width: 380px;
  height: min(560px, calc(100dvh - 32px));
}

.chat-popover :deep(.chat) {
  height: 100%;
  overflow: hidden;
  box-shadow: 0 18px 48px rgb(5 11 44 / 25%);
}

@media (max-width: 1100px) {
  .chat-popover {
    left: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
    height: 70vh;
  }
}
</style>
