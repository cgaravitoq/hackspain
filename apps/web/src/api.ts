import {
  type Alert,
  alertSchema,
  type CompanyDetail,
  type CompanySummary,
  type Compare,
  companyDetailSchema,
  companySummarySchema,
  compareSchema,
  type Explain,
  explainSchema,
  type GroupMap,
  groupMapSchema,
  type Meta,
  metaSchema,
} from "@hackspain/shared";
import { z } from "zod";

async function get<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    throw new Error(`${path} answered ${response.status}`);
  }
  return schema.parse(await response.json());
}

const companiesSchema = z.object({ companies: z.array(companySummarySchema) });
const alertsSchema = z.object({ alerts: z.array(alertSchema) });

export const ALERTS_LIMIT = 500;

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
};
