import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  UPLOAD_FILES,
  type UploadFile,
  type Uploads,
  uploadsSchema,
} from "@hackspain/shared";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:8787" },
    out: {
      type: "string",
      default: join(import.meta.dirname, "../../../pipeline/data"),
    },
  },
});

const url = values.url.replace(/\/$/, "");
const out = resolve(values.out);

async function fetchUploads(): Promise<Uploads> {
  const response = await fetch(`${url}/uploads`).catch(() => null);
  if (!response?.ok) {
    console.error(
      `Cannot reach the agent at ${url}: ${response ? `HTTP ${response.status}` : "connection failed"}. Start it with bun run dev or pass --url.`,
    );
    process.exit(1);
  }
  return uploadsSchema.parse(await response.json());
}

async function fetchCsv(batchId: string, name: UploadFile): Promise<string> {
  const response = await fetch(`${url}/uploads/${batchId}/${name}`);
  if (!response.ok) {
    console.error(`HTTP ${response.status} fetching ${batchId}/${name}`);
    process.exit(1);
  }
  return response.text();
}

function split(text: string) {
  const [header = "", ...rest] = text.split(/\r?\n/);
  return {
    header: header.replace(/^\uFEFF/, ""),
    rows: rest.filter((line) => line.trim() !== ""),
  };
}

const uploads = await fetchUploads();
const batches = uploads.batches.toSorted((a, b) =>
  a.batch_id.localeCompare(b.batch_id),
);

mkdirSync(out, { recursive: true });
const merged = new Map<UploadFile, { batches: number; rows: number }>();
for (const name of UPLOAD_FILES) {
  writeFileSync(join(out, `${name}.csv`), "");
  merged.set(name, { batches: 0, rows: 0 });
}

for (const batch of batches) {
  for (const file of batch.files) {
    const { header, rows } = split(await fetchCsv(batch.batch_id, file.name));
    const tally = merged.get(file.name) ?? { batches: 0, rows: 0 };
    const chunk = tally.batches === 0 ? [header, ...rows] : rows;
    if (chunk.length > 0) {
      appendFileSync(join(out, `${file.name}.csv`), `${chunk.join("\n")}\n`);
    }
    merged.set(file.name, {
      batches: tally.batches + 1,
      rows: tally.rows + rows.length,
    });
  }
}

for (const name of UPLOAD_FILES) {
  const tally = merged.get(name) ?? { batches: 0, rows: 0 };
  console.log(`${name}.csv: ${tally.batches} lotes, ${tally.rows} filas`);
}
