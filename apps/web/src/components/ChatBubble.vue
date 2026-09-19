<script setup lang="ts">
import type { Alert, Report, Role } from "@hackspain/shared";
import { nextTick, onMounted, ref } from "vue";
import ChatPanel from "./ChatPanel.vue";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

const SEEN_KEY = "xray.chat.seen";

type ReportResult = Pick<Report, "company_id" | "role" | "export_url">;

const props = defineProps<{
  companyId: string;
  alerts: Alert[];
  role: Role;
}>();

const emit = defineEmits<{
  compare: [companyIds: string[]];
  report: [result: ReportResult];
}>();

const open = ref(false);
const seen = ref(false);
const panel = ref<HTMLElement | null>(null);

function close() {
  open.value = false;
}

async function openChat() {
  open.value = true;
  seen.value = true;
  try {
    window.localStorage.setItem(SEEN_KEY, "true");
  } catch {
    seen.value = true;
  }
  await nextTick();
  panel.value?.querySelector<HTMLInputElement>("#chat-input")?.focus();
}

async function toggle() {
  if (open.value) {
    close();
    return;
  }
  await openChat();
}

onMounted(() => {
  try {
    seen.value = window.localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    seen.value = false;
  }
});
</script>

<template>
  <Sheet v-model:open="open">
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
      <div ref="panel" v-show="open" class="chat-sheet-body">
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
  <button
    type="button"
    class="chat-bubble"
    aria-label="Abrir el asistente"
    :aria-expanded="open"
    @click="toggle"
  >
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 5.75h14a2.25 2.25 0 0 1 2.25 2.25v7A2.25 2.25 0 0 1 19 17.25H9l-4.8 3.2.8-3.2A2.25 2.25 0 0 1 2.75 15V8A2.25 2.25 0 0 1 5 5.75Z"
      />
      <path d="M7.5 10.5h9M7.5 13.5h5.5" />
    </svg>
    <span v-if="!seen" class="chat-badge" aria-label="1 aviso">1</span>
  </button>
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

.chat-bubble {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 31;
  display: grid;
  width: 56px;
  height: 56px;
  padding: 15px;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 10px 28px rgb(15 23 42 / 25%);
  place-items: center;
}

.chat-bubble svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.chat-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  display: grid;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 2px solid var(--card);
  border-radius: 999px;
  background: var(--falling);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  place-items: center;
}

@media (max-width: 1100px) {
  .chat-bubble {
    right: 16px;
    bottom: 16px;
  }
}
</style>
