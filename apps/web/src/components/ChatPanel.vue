<script setup lang="ts">
import { Chat } from "@ai-sdk/vue";
import {
  type Alert,
  COMMITMENT_CONFIRMATION,
  type CommitmentDraftResult,
  type CommitmentRequest,
  type CommitmentResponse,
  commitmentDraftResultSchema,
  commitmentResponseSchema,
  compareSchema,
  type Report,
  type Role,
  reportSchema,
} from "@hackspain/shared";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { z } from "zod";
import { ALERTS_LIMIT } from "../api.ts";

const props = withDefaults(
  defineProps<{
    companyId: string;
    alerts: Alert[];
    role: Role;
    confirmedCommitment?: CommitmentRequest | null;
  }>(),
  { confirmedCommitment: null },
);

type ReportResult = Pick<Report, "company_id" | "role" | "export_url">;

const emit = defineEmits<{
  close: [];
  compare: [companyIds: string[]];
  report: [result: ReportResult];
  commitment: [result: CommitmentResponse];
  draft: [result: CommitmentDraftResult];
}>();

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      company_id: props.companyId,
      role: props.role,
      confirmed_commitment: props.confirmedCommitment ?? undefined,
    }),
  }),
});

const draft = ref("");
const list = ref<HTMLElement | null>(null);

const reportResultSchema = reportSchema.pick({
  company_id: true,
  role: true,
  export_url: true,
});
const handledTools = new Set<string>();

function handleFinishedTools() {
  for (const message of chat.messages) {
    for (const part of message.parts) {
      if (
        !isToolUIPart(part) ||
        part.state !== "output-available" ||
        handledTools.has(part.toolCallId)
      ) {
        continue;
      }
      if (part.type === "tool-compare") {
        const comparison = compareSchema.safeParse(part.output);
        if (comparison.success) {
          handledTools.add(part.toolCallId);
          emit(
            "compare",
            comparison.data.companies.map((company) => company.company_id),
          );
        }
      } else if (part.type === "tool-simulate_commitment") {
        const result = commitmentResponseSchema.safeParse(part.output);
        if (
          result.success &&
          result.data.evaluation.company_id === props.companyId
        ) {
          handledTools.add(part.toolCallId);
          emit("commitment", result.data);
        }
      } else if (part.type === "tool-draft_commitment") {
        const result = commitmentDraftResultSchema.safeParse(part.output);
        if (result.success && result.data.company_id === props.companyId) {
          handledTools.add(part.toolCallId);
          emit("draft", result.data);
        }
      } else if (part.type === "tool-report") {
        const report = reportResultSchema.safeParse(part.output);
        if (report.success) {
          handledTools.add(part.toolCallId);
          emit("report", report.data);
        }
      }
    }
  }
}

watch(
  () =>
    chat.messages
      .map((message) =>
        message.parts
          .map((part) => {
            if (part.type === "text") {
              return part.text;
            }
            return isToolUIPart(part) && part.state === "output-available"
              ? `${part.type}:${part.toolCallId}:${JSON.stringify(part.output)}`
              : part.type;
          })
          .join(""),
      )
      .join(""),
  async () => {
    handleFinishedTools();
    await nextTick();
    if (list.value) {
      list.value.scrollTop = list.value.scrollHeight;
    }
  },
);

onBeforeUnmount(() => {
  chat.stop();
});

const intro = computed(() => {
  const month = props.alerts[0]?.month ?? "este mes";
  const down = props.alerts.filter((alert) => alert.kind === "down").length;
  const recovered = props.alerts.filter(
    (alert) => alert.kind === "recovered",
  ).length;
  const total = `${props.alerts.length}${props.alerts.length >= ALERTS_LIMIT ? "+" : ""}`;
  return `${month}: ${total} alertas, ${down} empresas empeoran y ${recovered} se recuperan. Pregunta por ${props.companyId}, por cualquier otra empresa o grupo, o si puedes asumir una operación.`;
});

const roleSuggestions: Record<Role, string[]> = {
  tesorero: [
    "¿Por qué está así?",
    "¿Puedo aceptar un pedido de 50.000 € con un 30 % de anticipo?",
    "Exporta mi informe",
  ],
  financiero: [
    "Compara Talleres Ribera y Bodegas Altamira",
    "¿Puede asumir un pedido de 50.000 € con un 30 % de anticipo?",
    "¿Qué empresas han empeorado este mes?",
    "Exporta el informe de Talleres Ribera",
  ],
  ventas: [
    "¿Qué empresas se han recuperado este mes?",
    "¿Cómo está el grupo de Talleres Ribera?",
    "Exporta el informe de Talleres Ribera",
  ],
};

const suggestions = computed(() => roleSuggestions[props.role]);

const busy = computed(
  () => chat.status === "submitted" || chat.status === "streaming",
);

const toolEntity = z.object({
  company_id: z.string().optional(),
  group_id: z.string().optional(),
});

function send(text: string) {
  const question = text.trim();
  if (!question || busy.value) {
    return;
  }
  draft.value = "";
  chat.sendMessage({ text: question });
}

function sendConfirmation() {
  if (!busy.value && props.confirmedCommitment) {
    chat.sendMessage({ text: COMMITMENT_CONFIRMATION });
  }
}

defineExpose({ sendConfirmation });

function toolLabel(part: UIMessage["parts"][number]): string | null {
  if (!isToolUIPart(part)) {
    return null;
  }
  const name = part.type.slice("tool-".length);
  const entity = toolEntity.safeParse(part.input);
  const target = entity.success
    ? (entity.data.company_id ?? entity.data.group_id)
    : undefined;
  return target ? `${name} ${target}` : name;
}

function reportOutput(part: UIMessage["parts"][number]): ReportResult | null {
  if (
    !isToolUIPart(part) ||
    part.type !== "tool-report" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const report = reportResultSchema.safeParse(part.output);
  return report.success ? report.data : null;
}
</script>

<template>
  <section class="panel chat">
    <header class="chat-header">
      <h2 class="panel-title">TellMe · X Ray</h2>
      <button type="button" aria-label="Cerrar el asistente" @click="emit('close')">
        ×
      </button>
    </header>
    <div ref="list" class="messages">
      <article class="message assistant">
        <p>{{ intro }}</p>
      </article>
      <article
        v-for="message in chat.messages"
        :key="message.id"
        class="message"
        :class="message.role"
      >
        <template v-for="(part, index) in message.parts" :key="index">
          <p v-if="part.type === 'text'">{{ part.text }}</p>
          <a
            v-else-if="reportOutput(part)"
            class="file"
            :href="reportOutput(part)?.export_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            Informe listo: descargar PDF
          </a>
          <span v-else-if="toolLabel(part)" class="tool">{{ toolLabel(part) }}</span>
        </template>
      </article>
      <p v-if="chat.error" class="error">{{ chat.error.message }}</p>
    </div>
    <div class="suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        :disabled="busy"
        @click="send(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
    <form @submit.prevent="send(draft)">
      <input
        id="chat-input"
        v-model="draft"
        placeholder="Pregunta al agente…"
        autocomplete="off"
      />
      <button type="submit" :disabled="busy || !draft.trim()">Enviar</button>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--line);
}

.chat-header h2 {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
}

.chat-header button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-soft);
  font-size: 22px;
  line-height: 1;
}

.chat-header button:hover {
  background: var(--chip-bg);
}

.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 1100px) {
  .messages {
    min-height: 240px;
    max-height: 60vh;
  }
}

.message {
  max-width: 92%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
}

.message p {
  margin: 0 0 6px;
  white-space: pre-wrap;
}

.message p:last-child {
  margin-bottom: 0;
}

.assistant {
  align-self: flex-start;
  background: var(--chip-bg);
}

.user {
  align-self: flex-end;
  background: var(--accent);
  color: #fff;
}

.tool {
  display: inline-block;
  margin: 0 4px 6px 0;
  padding: 2px 8px;
  border: 1px dashed var(--muted);
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--ink-soft);
}

.file {
  display: inline-block;
  margin: 0 4px 6px 0;
  padding: 5px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 14px 10px;
}

.suggestions button {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  font-size: 12px;
}

form {
  display: flex;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--line);
}

form input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
}

form button {
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

form button:disabled,
.suggestions button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
