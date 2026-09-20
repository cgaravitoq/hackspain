import { z } from "zod";

export const uploadFileSchema = z.enum([
  "companies",
  "groups",
  "banking_products",
  "transactions",
  "invoices",
  "debt_products",
  "balances",
]);

export type UploadFile = z.infer<typeof uploadFileSchema>;

export const UPLOAD_FILES: readonly UploadFile[] = uploadFileSchema.options;

export const UPLOAD_COLUMNS: Record<UploadFile, readonly string[]> = {
  companies: ["company_id", "group_id", "currency"],
  groups: ["group_id", "erp"],
  banking_products: ["product_id", "company_id", "type", "currency"],
  transactions: [
    "transaction_id",
    "company_id",
    "product_id",
    "date",
    "amount",
    "status",
    "category",
    "description",
    "counterparty_id",
  ],
  invoices: [
    "operation_id",
    "company_id",
    "document_type",
    "issuance_date",
    "due_date",
    "payment_date",
    "amount",
    "pending_amount",
    "status",
    "concept",
    "counterparty_id",
    "currency",
  ],
  debt_products: [
    "product_id",
    "company_id",
    "type",
    "bank_name",
    "outstanding",
    "granted",
    "currency",
    "created_at",
  ],
  balances: ["product_id", "company_id", "balance"],
};

export function uploadFileFor(filename: string): UploadFile | null {
  const stem = filename.toLowerCase().replace(/\.csv$/, "");
  const matches = UPLOAD_FILES.filter((name) => stem.includes(name));
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function missingUploadColumns(
  name: UploadFile,
  header: string,
): string[] {
  const present = new Set(
    header
      .replace(/^\uFEFF/, "")
      .trim()
      .split(",")
      .map((column) => column.trim().replace(/^"|"$/g, "")),
  );
  return UPLOAD_COLUMNS[name].filter((column) => !present.has(column));
}

export const uploadBatchFileSchema = z.object({
  name: uploadFileSchema,
  rows: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

export type UploadBatchFile = z.infer<typeof uploadBatchFileSchema>;

export const uploadBatchSchema = z.object({
  batch_id: z.string().min(1),
  uploaded_at: z.iso.datetime(),
  files: z.array(uploadBatchFileSchema).min(1),
});

export type UploadBatch = z.infer<typeof uploadBatchSchema>;

export const uploadsSchema = z.object({
  batches: z.array(uploadBatchSchema),
  scored_at: z.iso.datetime({ offset: true }).nullable(),
  pending: z.boolean(),
});

export type Uploads = z.infer<typeof uploadsSchema>;
