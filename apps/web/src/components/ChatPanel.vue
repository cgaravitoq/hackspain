<script setup lang="ts">
import { Chat } from "@ai-sdk/vue";
import type { Alert } from "@hackspain/shared";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { computed, ref } from "vue";

const props = defineProps<{ companyId: string; alerts: Alert[] }>();

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ company_id: props.companyId }),
  }),
});

const draft = ref("");

const intro = computed(() => {
  const month = props.alerts[0]?.month ?? "este mes";
  const down = props.alerts.filter((alert) => alert.kind === "down").length;
  const recovered = props.alerts.filter(
    (alert) => alert.kind === "recovered",
  ).length;
  return `${month}: ${props.alerts.length} alertas, ${down} empresas empeoran y ${recovered} se recuperan. Pregunta por ${props.companyId} o por cualquier otra empresa o grupo.`;
});

const suggestions = [
  "¿Por qué está así?",
  "¿Qué cambió este mes?",
  "¿Cómo está su grupo?",
];

const busy = computed(
  () => chat.status === "submitted" || chat.status === "streaming",
);

function send(text: string) {
  const question = text.trim();
  if (!question || busy.value) {
    return;
  }
  draft.value = "";
  chat.sendMessage({ text: question });
}

function toolLabel(part: UIMessage["parts"][number]): string | null {
  if (!isToolUIPart(part)) {
    return null;
  }
  const name = part.type.slice("tool-".length);
  const input = part.input ? JSON.stringify(part.input) : "";
  return `${name} ${input}`;
}
</script>

<template>
  <section class="panel chat">
    <h2 class="panel-title">Agente · X Ray sobre Workers AI</h2>
    <div class="messages">
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
  max-height: calc(100vh - 110px);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
