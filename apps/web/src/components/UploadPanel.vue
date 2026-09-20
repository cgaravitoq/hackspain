<script setup lang="ts">
import {
  UPLOAD_FILES,
  type UploadBatch,
  type UploadFile,
  type Uploads,
  uploadFileFor,
} from "@hackspain/shared";
import { computed, onMounted, ref } from "vue";
import { api } from "../api.ts";

type Chosen = {
  file: File;
  input: UploadFile | null;
  duplicate: boolean;
};

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});
const integerFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const sizeFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

const uploads = ref<Uploads | null>(null);
const chosen = ref<Chosen[]>([]);
const sending = ref(false);
const success = ref("");
const error = ref("");
const picker = ref<HTMLInputElement | null>(null);

const banner = computed(() => {
  if (!uploads.value) {
    return "Cargando historial…";
  }
  const { batches, scored_at, pending } = uploads.value;
  const newest = batches[0];
  if (pending && newest) {
    const since = `hay datos subidos el ${date(newest.uploaded_at)}`;
    return scored_at
      ? `Pendiente de recalcular: ${since} posteriores al último cálculo (${date(scored_at)})`
      : `Pendiente de recalcular: ${since} y todavía no se ha calculado ningún score`;
  }
  if (batches.length && scored_at) {
    return `Score al día: calculado el ${date(scored_at)} con todos los datos subidos`;
  }
  return "Aún no se han subido datos";
});

const blocked = computed(() =>
  chosen.value.some((entry) => entry.input === null || entry.duplicate),
);

const canSubmit = computed(
  () => chosen.value.length > 0 && !blocked.value && !sending.value,
);

function date(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function size(bytes: number): string {
  return bytes >= MEGABYTE
    ? `${sizeFormat.format(bytes / MEGABYTE)} MB`
    : `${sizeFormat.format(bytes / KILOBYTE)} KB`;
}

function files(batch: UploadBatch): string {
  return batch.files
    .map((file) => `${file.name} (${integerFormat.format(file.rows)} filas)`)
    .join(", ");
}

function totalBytes(batch: UploadBatch): number {
  return batch.files.reduce((sum, file) => sum + file.bytes, 0);
}

function markDuplicates(files: File[]): Chosen[] {
  const taken = new Set<UploadFile>();
  return files.map((file) => {
    const input = uploadFileFor(file.name);
    const duplicate = input !== null && taken.has(input);
    if (input) {
      taken.add(input);
    }
    return { file, input, duplicate };
  });
}

function add(list: FileList) {
  chosen.value = markDuplicates([
    ...chosen.value.map((entry) => entry.file),
    ...Array.from(list),
  ]);
  success.value = "";
  error.value = "";
}

function onPick(event: Event) {
  if (event.target instanceof HTMLInputElement && event.target.files) {
    add(event.target.files);
    event.target.value = "";
  }
}

function onDrop(event: DragEvent) {
  if (event.dataTransfer?.files) {
    add(event.dataTransfer.files);
  }
}

function remove(index: number) {
  chosen.value = markDuplicates(
    chosen.value
      .filter((_entry, position) => position !== index)
      .map((entry) => entry.file),
  );
}

async function load() {
  try {
    uploads.value = await api.uploads();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function submit() {
  if (!canSubmit.value) {
    return;
  }
  const form = new FormData();
  for (const entry of chosen.value) {
    if (entry.input) {
      form.append(entry.input, entry.file, entry.file.name);
    }
  }
  sending.value = true;
  error.value = "";
  success.value = "";
  try {
    const batch = await api.upload(form);
    const rows = batch.files.reduce((sum, file) => sum + file.rows, 0);
    success.value = `Lote ${date(batch.uploaded_at)}: ${batch.files.length} ficheros, ${integerFormat.format(rows)} filas`;
    chosen.value = [];
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="panel upload">
    <h2 class="panel-title">Cargar datos</h2>
    <div class="upload-content">
      <p
        class="banner"
        :class="{ pending: uploads?.pending }"
        role="status"
      >
        {{ banner }}
      </p>
      <p class="hint">
        Cada subida se suma a las anteriores; nada se borra ni se sustituye.
      </p>
      <p class="hint">
        Ficheros aceptados (por nombre):
        <code v-for="name in UPLOAD_FILES" :key="name">{{ name }}.csv</code>
      </p>
      <div
        class="dropzone"
        @dragover.prevent
        @drop.prevent="onDrop"
        @click="picker?.click()"
      >
        <span>Arrastra aquí los CSV o elige ficheros</span>
        <input
          ref="picker"
          type="file"
          multiple
          accept=".csv"
          aria-label="Elegir ficheros CSV"
          @change="onPick"
          @click.stop
        />
      </div>
      <ul v-if="chosen.length" class="chosen">
        <li v-for="(entry, index) in chosen" :key="`${entry.file.name}-${index}`">
          <span class="chosen-name">{{ entry.file.name }}</span>
          <span
            class="chosen-input"
            :class="{ unknown: entry.input === null || entry.duplicate }"
          >
            {{ entry.duplicate ? "Duplicado" : (entry.input ?? "Nombre no reconocido") }}
          </span>
          <span class="chosen-size">{{ size(entry.file.size) }}</span>
          <button type="button" class="remove" @click="remove(index)">Quitar</button>
        </li>
      </ul>
      <div class="actions">
        <button
          type="button"
          class="submit"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ sending ? "Subiendo…" : "Subir" }}
        </button>
        <p v-if="success" class="success" role="status">{{ success }}</p>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
      <h3>Historial</h3>
      <table v-if="uploads?.batches.length">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Ficheros</th>
            <th scope="col" class="numeric">Tamaño</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="batch in uploads.batches" :key="batch.batch_id">
            <td>{{ date(batch.uploaded_at) }}</td>
            <td>{{ files(batch) }}</td>
            <td class="numeric">{{ size(totalBytes(batch)) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="uploads" class="empty">Sin lotes todavía</p>
    </div>
  </section>
</template>

<style scoped>
.upload-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 20px;
}

.banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

.banner.pending {
  background: #fdf1e7;
  color: var(--slipping);
}

.hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
}

.hint code {
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--chip-bg);
  font-size: 11px;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border: 1px dashed var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}

.dropzone input {
  font-size: 12px;
}

.chosen {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}

.chosen li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}

.chosen-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chosen-input {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--chip-bg);
  font-size: 12px;
}

.chosen-input.unknown {
  background: #fde8e8;
  color: var(--falling);
}

.chosen-size {
  color: var(--ink-soft);
  font-size: 12px;
}

.remove {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  font-size: 12px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.submit {
  padding: 7px 14px;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.submit:hover:not(:disabled) {
  background: var(--accent-hover);
}

.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.error {
  margin: 0;
  padding: 0;
  font-size: 13px;
}

h3 {
  margin: 8px 0 0;
  font-size: 13px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--ink-soft);
  font-weight: 500;
}

.numeric {
  text-align: right;
  white-space: nowrap;
}

.empty {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}
</style>
