import {
  type Alert,
  alertSchema,
  type Backtest,
  backtestSchema,
  type CompanyDetail,
  type CompanyRelations,
  type CompanySummary,
  companyDetailSchema,
  companyRelationsSchema,
  companySummarySchema,
  type Graph,
  type Group,
  graphMetaSchema,
  graphSchema,
  groupSchema,
  type Meta,
  metaSchema,
  type RelationConfidence,
  type RelationNode,
  type RelationScope,
  type RelationType,
  relationEdgeSchema,
  relationNodeSchema,
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

type GraphFilter = {
  type?: RelationType;
  confidence?: RelationConfidence;
  scope?: RelationScope;
  group_id?: string;
  include_isolated: boolean;
};

type RelationNodeRow = PayloadRow & {
  score: number | null;
  state: State;
  scorable: number;
};

type CompanyRelationRow = PayloadRow & {
  counterpart_company_id: string;
  counterpart_group_id: string | null;
  counterpart_score: number | null;
  counterpart_state: State;
};

const CONFIDENCE_RANK: Record<RelationConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const RELATIONS_QUERY =
  "SELECT payload FROM relations WHERE (?1 IS NULL OR relation_type = ?1) AND (?2 = 0 OR CASE confidence WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END >= ?2) AND (?3 IS NULL OR scope = ?3) AND (?4 IS NULL OR (source IN (SELECT company_id FROM relation_nodes WHERE group_id = ?4) AND target IN (SELECT company_id FROM relation_nodes WHERE group_id = ?4))) ORDER BY position";

const RELATION_NODES_QUERY =
  "SELECT relation_nodes.payload AS payload, companies.score, companies.state, companies.scorable FROM relation_nodes JOIN companies ON companies.company_id = relation_nodes.company_id WHERE (?1 IS NULL OR relation_nodes.group_id = ?1) AND (?2 = 1 OR relation_nodes.degree > 0) ORDER BY relation_nodes.company_id";

const COMPANY_RELATIONS_QUERY =
  "SELECT relations.payload AS payload, counterpart.company_id AS counterpart_company_id, counterpart.group_id AS counterpart_group_id, counterpart_company.score AS counterpart_score, counterpart_company.state AS counterpart_state FROM relations JOIN relation_nodes AS counterpart ON counterpart.company_id = CASE WHEN relations.source = ?1 THEN relations.target ELSE relations.source END JOIN companies AS counterpart_company ON counterpart_company.company_id = counterpart.company_id WHERE (relations.source = ?1 OR relations.target = ?1) AND (?2 IS NULL OR relations.relation_type = ?2) ORDER BY relations.position";

function nodeOf(row: RelationNodeRow): RelationNode {
  return relationNodeSchema.parse({
    ...JSON.parse(row.payload),
    score: row.score,
    state: row.state,
    scorable: row.scorable === 1,
  });
}

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

    async details(companyIds: string[]): Promise<CompanyDetail[]> {
      const placeholders = companyIds.map((_id, index) => `?${index + 1}`);
      const { results } = await db
        .prepare(
          `SELECT detail AS payload FROM companies WHERE company_id IN (${placeholders.join(", ")})`,
        )
        .bind(...companyIds)
        .all<PayloadRow>();
      const byId = new Map(
        results.map((row) => {
          const detail = companyDetailSchema.parse(JSON.parse(row.payload));
          return [detail.company_id, detail] as const;
        }),
      );
      return companyIds.flatMap((id) => {
        const detail = byId.get(id);
        return detail ? [detail] : [];
      });
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

    async graph(filter: GraphFilter): Promise<Graph | null> {
      const meta = await document("relations_meta", graphMetaSchema);
      if (!meta) {
        return null;
      }
      const edges = await db
        .prepare(RELATIONS_QUERY)
        .bind(
          filter.type ?? null,
          filter.confidence ? CONFIDENCE_RANK[filter.confidence] : 0,
          filter.scope ?? null,
          filter.group_id ?? null,
        )
        .all<PayloadRow>();
      const nodes = await db
        .prepare(RELATION_NODES_QUERY)
        .bind(filter.group_id ?? null, filter.include_isolated ? 1 : 0)
        .all<RelationNodeRow>();
      return graphSchema.parse({
        meta,
        nodes: nodes.results.map((row) => nodeOf(row)),
        edges: edges.results.map((row) =>
          relationEdgeSchema.parse(JSON.parse(row.payload)),
        ),
      });
    },

    async companyRelations(
      companyId: string,
      relationType?: RelationType,
    ): Promise<CompanyRelations | null> {
      const known = await db
        .prepare("SELECT company_id FROM companies WHERE company_id = ?1")
        .bind(companyId)
        .first();
      if (!known) {
        return null;
      }
      const { results } = await db
        .prepare(COMPANY_RELATIONS_QUERY)
        .bind(companyId, relationType ?? null)
        .all<CompanyRelationRow>();
      return companyRelationsSchema.parse({
        company_id: companyId,
        edges: results.map((row) => ({
          ...JSON.parse(row.payload),
          counterpart_company_id: row.counterpart_company_id,
          counterpart_group_id: row.counterpart_group_id,
          counterpart_score: row.counterpart_score,
          counterpart_state: row.counterpart_state,
        })),
      });
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
