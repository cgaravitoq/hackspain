import {
  type Alert,
  alertSchema,
  type CommitmentEvaluation,
  type CommitmentRequest,
  type CompanyDetail,
  type CompanySummary,
  type Compare,
  commitmentEvaluationSchema,
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
} from "@hackspain/shared";
import { z } from "zod";

const errorSchema = z.object({ error: z.string() });

async function request<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  init?: RequestInit,
): Promise<z.infer<Schema>> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    let message = `${path} answered ${response.status}`;
    try {
      const failure = errorSchema.safeParse(await response.json());
      if (failure.success) {
        message = failure.data.error;
      }
    } catch {
      message = `${path} answered ${response.status}`;
    }
    throw new Error(message);
  }
  return schema.parse(await response.json());
}

function get<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  return request(path, schema);
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

export const api = {
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
  simulateCommitment: (
    id: string,
    commitment: CommitmentRequest,
  ): Promise<CommitmentEvaluation> =>
    request(`/companies/${id}/commitment`, commitmentEvaluationSchema, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(commitment),
    }),
};
