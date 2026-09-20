import {
  type Alert,
  alertSchema,
  type CommitmentContext,
  type CommitmentRequest,
  type CommitmentResponse,
  type CompanyDetail,
  type CompanySummary,
  type Compare,
  commitmentContextSchema,
  commitmentRequestSchema,
  commitmentResponseSchema,
  companyDetailSchema,
  companySummarySchema,
  compareSchema,
  type Explain,
  explainSchema,
  type Graph,
  type GroupMap,
  graphSchema,
  groupMapSchema,
  type Meta,
  metaSchema,
  type RelationConfidence,
  type RelationScope,
  type RelationType,
  type Report,
  type Role,
  reportSchema,
  type Simulate,
  simulateSchema,
  type UploadBatch,
  type Uploads,
  uploadBatchSchema,
  uploadsSchema,
} from "@hackspain/shared";
import { z } from "zod";

async function send<Schema extends z.ZodType>(
  path: string,
  init: RequestInit,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    const parsed = z
      .object({ error: z.string() })
      .safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      throw new Error(parsed.data.error);
    }
    throw new Error(`${path} answered ${response.status}`);
  }
  return schema.parse(await response.json());
}

function get<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  signal?: AbortSignal,
): Promise<z.infer<Schema>> {
  return send(path, { signal }, schema);
}

const companiesSchema = z.object({ companies: z.array(companySummarySchema) });
const alertsSchema = z.object({ alerts: z.array(alertSchema) });

export const ALERTS_LIMIT = 500;

export type GraphQuery = {
  type?: RelationType;
  confidence?: RelationConfidence;
  scope?: RelationScope;
  group_id?: string;
  include_isolated?: boolean;
};

export type SimulateQuery = {
  horizon?: number;
  advance?: number;
  draw?: number;
  fee?: number;
  apr?: number;
};

function graphSearch(query: GraphQuery): string {
  const search = new URLSearchParams();
  if (query.type) {
    search.set("type", query.type);
  }
  if (query.confidence) {
    search.set("confidence", query.confidence);
  }
  if (query.scope) {
    search.set("scope", query.scope);
  }
  if (query.group_id) {
    search.set("group_id", query.group_id);
  }
  search.set("include_isolated", String(query.include_isolated ?? false));
  return search.toString();
}

function simulateSearch(query: SimulateQuery): string {
  return new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  ).toString();
}

export const api = {
  commitmentContext: (
    id: string,
    signal?: AbortSignal,
  ): Promise<CommitmentContext> =>
    get(
      `/companies/${encodeURIComponent(id)}/commitment-context`,
      commitmentContextSchema,
      signal,
    ),
  commitment: async (
    id: string,
    input: CommitmentRequest,
    signal?: AbortSignal,
  ): Promise<CommitmentResponse> => {
    const response = await fetch(
      `/api/companies/${encodeURIComponent(id)}/commitment`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(commitmentRequestSchema.parse(input)),
        signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        `No se pudo evaluar la operación (${response.status}). Revisa los datos y vuelve a intentarlo.`,
      );
    }
    return commitmentResponseSchema.parse(await response.json());
  },
  meta: (): Promise<Meta> => get("/meta", metaSchema),
  companies: async (): Promise<CompanySummary[]> =>
    (await get("/companies", companiesSchema)).companies,
  company: (id: string): Promise<CompanyDetail> =>
    get(`/companies/${id}`, companyDetailSchema),
  explain: (id: string): Promise<Explain> =>
    get(`/companies/${id}/explain`, explainSchema),
  group: (id: string): Promise<GroupMap> =>
    get(`/groups/${id}`, groupMapSchema),
  alerts: async (): Promise<Alert[]> =>
    (await get(`/alerts?limit=${ALERTS_LIMIT}`, alertsSchema)).alerts,
  compare: (ids: string[]): Promise<Compare> =>
    get(
      `/compare?${new URLSearchParams({ ids: ids.join(",") })}`,
      compareSchema,
    ),
  graph: (query: GraphQuery = {}): Promise<Graph> =>
    get(`/graph?${graphSearch(query)}`, graphSchema),
  report: (id: string, role: Role): Promise<Report> =>
    get(
      `/companies/${id}/report?${new URLSearchParams({ role })}`,
      reportSchema,
    ),
  simulate: (id: string, query: SimulateQuery): Promise<Simulate> =>
    get(`/companies/${id}/simulate?${simulateSearch(query)}`, simulateSchema),
  uploads: (): Promise<Uploads> => get("/uploads", uploadsSchema),
  upload: (form: FormData): Promise<UploadBatch> =>
    send("/uploads", { method: "POST", body: form }, uploadBatchSchema),
};
