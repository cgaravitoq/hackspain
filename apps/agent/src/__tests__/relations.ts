import type { RelationsArtifact } from "@hackspain/shared";
import { company } from "./fixtures.ts";

export const isolated = company("COMP_E", "GROUP_2", [
  { month: "2026-08", score: null, state: "not_evaluable" },
]);

export const unlisted = company("COMP_F", "GROUP_2", [
  { month: "2026-08", score: 55.5, state: "stable" },
]);

export const relationsJson = {
  meta: {
    rule_version: "xray-relations/0.1",
    generated_at: "2026-09-19T13:04:05+00:00",
    counts: {
      INFERRED_PAYMENT_TO: 1,
      OPEN_OBLIGATION_TO: 1,
      SHARES_COUNTERPARTY_WITH: 1,
    },
  },
  calibration: {
    bank_flows_observed_min_2: { intragroup: 41, intergroup: 7 },
  },
  nodes: [
    {
      company_id: "COMP_A",
      group_id: "GROUP_1",
      degree: 2,
      role: "connected",
      intercompany_flow_volume_minor: 9_000_000,
    },
    {
      company_id: "COMP_B",
      group_id: "GROUP_1",
      degree: 2,
      role: "connected",
      intercompany_flow_volume_minor: 4_000_000,
    },
    {
      company_id: "COMP_D",
      group_id: "GROUP_2",
      degree: 2,
      role: "connected",
      intercompany_flow_volume_minor: 1_000_000,
    },
    {
      company_id: "COMP_E",
      group_id: "GROUP_2",
      degree: 0,
      role: "isolated",
      intercompany_flow_volume_minor: 0,
    },
  ],
  edges: [
    {
      source: "COMP_A",
      target: "COMP_B",
      relation_type: "INFERRED_PAYMENT_TO",
      subtype: "cash_pooling",
      scope: "intragroup",
      confidence: "high",
      claim_status: "inferred",
      evidence_level: "bank_mirror",
      matches: 12,
      amount_minor: 1_234_500,
      currency: "EUR",
      first_date: "2025-01-03",
      last_date: "2026-08-27",
      evidence_ids: ["TX_0001", "TX_0002"],
      detail: { subtype_counts: { cash_pooling: 12 } },
      example: "Traspaso automatico de saldos",
      provider_identity_confirmed: false,
    },
    {
      source: "COMP_A",
      target: "COMP_D",
      relation_type: "SHARES_COUNTERPARTY_WITH",
      subtype: "shared_supplier_or_client",
      scope: "intergroup",
      confidence: "low",
      claim_status: "inferred",
      evidence_level: "shared_counterparty_id",
      matches: 3,
      amount_minor: 250_000,
      currency: "EUR",
      first_date: "2025-03-11",
      last_date: "2026-07-02",
      evidence_ids: ["TX_0003"],
      detail: { shared_counterparties: 3 },
      example: "counterparty_id shared by two companies",
      provider_identity_confirmed: false,
    },
    {
      source: "COMP_D",
      target: "COMP_B",
      relation_type: "OPEN_OBLIGATION_TO",
      subtype: "in_house_bank_line",
      scope: "intergroup",
      confidence: "medium",
      claim_status: "inferred",
      evidence_level: "debt_balance_mirror",
      matches: 1,
      amount_minor: 500_000,
      currency: "EUR",
      first_date: "2025-05-01",
      last_date: "2026-08-31",
      evidence_ids: ["DEBT_0001"],
      detail: { lender_products: ["PRODUCT_1"] },
      example: "Mirror outstanding balance on 'In-house bank' credit lines",
      provider_identity_confirmed: false,
    },
  ],
};

export async function seedRelations(
  db: D1Database,
  artifact: RelationsArtifact,
): Promise<void> {
  const statements = [
    ...[isolated, unlisted].map((detail) => {
      const { series: _series, ...summary } = detail;
      return db
        .prepare(
          "INSERT INTO companies (company_id, group_id, scorable, month, score, state, summary, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(
          detail.company_id,
          detail.group_id,
          detail.scorable ? 1 : 0,
          detail.latest.month,
          detail.latest.score,
          detail.latest.state,
          JSON.stringify(summary),
          JSON.stringify(detail),
        );
    }),
    db
      .prepare("INSERT INTO documents (name, payload) VALUES (?1, ?2)")
      .bind("relations_meta", JSON.stringify(artifact.meta)),
    ...artifact.edges.map((edge, position) =>
      db
        .prepare(
          "INSERT INTO relations (position, source, target, relation_type, scope, confidence, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(
          position,
          edge.source,
          edge.target,
          edge.relation_type,
          edge.scope,
          edge.confidence,
          JSON.stringify(edge),
        ),
    ),
    ...artifact.nodes.map((node) =>
      db
        .prepare(
          "INSERT INTO relation_nodes (company_id, group_id, degree, role, payload) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(
          node.company_id,
          node.group_id,
          node.degree,
          node.role,
          JSON.stringify(node),
        ),
    ),
  ];
  await db.batch(statements);
}
