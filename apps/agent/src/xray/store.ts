import {
  type Alert,
  alertSchema,
  type Backtest,
  backtestSchema,
  type CompanyDetail,
  type CompanySummary,
  companyDetailSchema,
  companySummarySchema,
  type Group,
  groupSchema,
  type Meta,
  metaSchema,
  type State,
} from "@hackspain/shared";
import type { z } from "zod";

type PayloadRow = { payload: string };

type AlertKind = Alert["kind"];

type CompanyFilter = {
  state?: State;
  group_id?: string;
  limit: number;
};

export function createStore(db: D1Database) {
  async function document<T extends z.ZodType>(
    name: string,
    schema: T,
  ): Promise<z.infer<T> | null> {
    const row = await db
      .prepare("SELECT payload FROM documents WHERE name = ?1")
      .bind(name)
      .first<PayloadRow>();
    return row ? schema.parse(JSON.parse(row.payload)) : null;
  }

  return {
    async companies(filter: CompanyFilter): Promise<CompanySummary[]> {
      const { results } = await db
        .prepare(
          "SELECT summary AS payload FROM companies WHERE (?1 IS NULL OR state = ?1) AND (?2 IS NULL OR group_id = ?2) ORDER BY company_id LIMIT ?3",
        )
        .bind(filter.state ?? null, filter.group_id ?? null, filter.limit)
        .all<PayloadRow>();
      return results.map((row) =>
        companySummarySchema.parse(JSON.parse(row.payload)),
      );
    },

    async company(companyId: string): Promise<CompanyDetail | null> {
      const row = await db
        .prepare(
          "SELECT detail AS payload FROM companies WHERE company_id = ?1",
        )
        .bind(companyId)
        .first<PayloadRow>();
      return row ? companyDetailSchema.parse(JSON.parse(row.payload)) : null;
    },

    async group(groupId: string): Promise<Group | null> {
      const row = await db
        .prepare("SELECT payload FROM groups WHERE group_id = ?1")
        .bind(groupId)
        .first<PayloadRow>();
      return row ? groupSchema.parse(JSON.parse(row.payload)) : null;
    },

    async alerts(kind: AlertKind | undefined, limit: number): Promise<Alert[]> {
      const { results } = await db
        .prepare(
          "SELECT payload FROM alerts WHERE (?1 IS NULL OR kind = ?1) ORDER BY position LIMIT ?2",
        )
        .bind(kind ?? null, limit)
        .all<PayloadRow>();
      return results.map((row) => alertSchema.parse(JSON.parse(row.payload)));
    },

    backtest(): Promise<Backtest | null> {
      return document("backtest", backtestSchema);
    },

    meta(): Promise<Meta | null> {
      return document("meta", metaSchema);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
