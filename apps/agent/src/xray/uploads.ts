import {
  missingUploadColumns,
  type UploadBatch,
  type UploadFile,
  type Uploads,
  uploadBatchSchema,
  uploadFileSchema,
} from "@hackspain/shared";

const PREFIX = "uploads/";

type ParsedFile = {
  name: UploadFile;
  file: File;
  rows: number;
};

type StoreResult = UploadBatch | { error: string };

function batchId(now: Date): string {
  return now.toISOString().replaceAll(/[-:.]/g, "");
}

function countRows(text: string): number {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return Math.max(lines.length - 1, 0);
}

async function parseForm(
  form: FormData,
): Promise<ParsedFile[] | { error: string }> {
  const files: ParsedFile[] = [];
  for (const [field, value] of form.entries()) {
    const name = uploadFileSchema.safeParse(field);
    if (!(name.success && value instanceof File)) {
      return { error: `Fichero no reconocido: ${field}` };
    }
    const text = await value.text();
    const [header = ""] = text.split(/\r?\n/, 1);
    const missing = missingUploadColumns(name.data, header);
    if (missing.length > 0) {
      return {
        error: `${name.data}: faltan las columnas ${missing.join(", ")}`,
      };
    }
    files.push({ name: name.data, file: value, rows: countRows(text) });
  }
  return files.length > 0 ? files : { error: "Sin ficheros" };
}

export function createUploads(bucket: R2Bucket) {
  async function manifest(prefix: string): Promise<UploadBatch | null> {
    const object = await bucket.get(`${prefix}manifest.json`);
    if (!object) {
      return null;
    }
    const parsed = uploadBatchSchema.safeParse(await object.json());
    return parsed.success ? parsed.data : null;
  }

  return {
    async store(form: FormData): Promise<StoreResult> {
      const parsed = await parseForm(form);
      if ("error" in parsed) {
        return parsed;
      }
      const now = new Date();
      const batch: UploadBatch = {
        batch_id: batchId(now),
        uploaded_at: now.toISOString(),
        files: parsed.map(({ name, file, rows }) => ({
          name,
          rows,
          bytes: file.size,
        })),
      };
      const dir = `${PREFIX}${batch.batch_id}/`;
      await Promise.all(
        parsed.map(({ name, file }) =>
          bucket.put(`${dir}${name}.csv`, file, {
            httpMetadata: { contentType: "text/csv" },
          }),
        ),
      );
      await bucket.put(`${dir}manifest.json`, JSON.stringify(batch), {
        httpMetadata: { contentType: "application/json" },
      });
      return batch;
    },

    async list(scoredAt: string | null): Promise<Uploads> {
      const prefixes: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({
          prefix: PREFIX,
          delimiter: "/",
          cursor,
        });
        prefixes.push(...page.delimitedPrefixes);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      const manifests = await Promise.all(prefixes.map(manifest));
      const batches = manifests
        .filter((batch) => batch !== null)
        .sort((a, b) => b.batch_id.localeCompare(a.batch_id));
      const newest = batches[0];
      const pending =
        newest !== undefined &&
        (scoredAt === null ||
          new Date(newest.uploaded_at) > new Date(scoredAt));
      return { batches, scored_at: scoredAt, pending };
    },

    file(id: string, name: UploadFile): Promise<R2ObjectBody | null> {
      return bucket.get(`${PREFIX}${id}/${name}.csv`);
    },
  };
}
