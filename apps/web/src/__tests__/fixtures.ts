import {
  type Alert,
  type CompanyDetail,
  type Explain,
  type Graph,
  type GroupMap,
  graphSchema,
  type Meta,
  type MonthEntry,
  type RelationEdge,
  type RelationNode,
  type Report,
  relationConfidenceSchema,
  relationScopeSchema,
  relationTypeSchema,
  roleSchema,
  type TrendProjection,
  type UploadBatch,
  type Uploads,
} from "@hackspain/shared";
import type { z } from "zod";

export function month(
  name: string,
  score: number | null,
  state: MonthEntry["state"],
): MonthEntry {
  return {
    month: name,
    observed: true,
    level: score,
    momentum: null,
    adjustment: score === null ? null : 0,
    score,
    delta_3: null,
    delta_6: null,
    state,
    confidence: score === null ? "none" : "high",
    components: {},
    drivers: [],
    changed: [],
    evidence: {
      months_observed: 12,
      transactions_in_window: 30,
      share_uncategorised: 0.1,
      window: `${name} a ${name}`,
      cutoff: name,
      currency: "EUR",
      sources: { transactions: true, invoices: true, debt: false },
      rule_version: "xray-score/0.1",
    },
    flows: {
      inflow: 40_000,
      outflow: 100_000,
      financing_in: 0,
      financing_out: 0,
      debt_repayment: 0,
    },
    events: { E1: state === "falling", E2: false, E3: false, E4: false },
  };
}

export const meta: Meta = {
  rule_version: "xray-score/0.1",
  generated_at: "2026-09-19T13:04:05+00:00",
  policy: {
    lambda: 0.25,
    adjustment_cap: 10,
    momentum_threshold: 5,
    volatility_factor: 0.75,
    exit_factor: 0.5,
    penalty_cap: 15,
    healthy_level: 60,
    persistence_months: 3,
    window_months: 3,
    min_months: 3,
    momentum_min_months: 6,
  },
  state_labels: {},
  latest_month: "2026-08",
  holdout_groups: [],
  gaps: { companies_with_gaps: 1, unobserved_months: 3, stale_companies: 0 },
};

export const alerts: Alert[] = [
  {
    rule_version: "xray-score/0.1",
    company_id: "COMP_A",
    group_id: "GROUP_1",
    month: "2026-08",
    kind: "down",
    stage: "confirmed",
    state: "falling",
    previous_state: "slipping",
    score: 12.3,
    delta: -27.9,
    driver: "Cobros 40.000 € frente a pagos 100.000 €",
  },
  {
    rule_version: "xray-score/0.1",
    company_id: "COMP_C",
    group_id: "GROUP_2",
    month: "2026-08",
    kind: "recovered",
    stage: null,
    state: "stable",
    previous_state: "slipping",
    score: 55,
    delta: 6.2,
    driver: null,
  },
];

export const trendProjectionRefusal: TrendProjection = {
  rule_version: "xray-trend-projection/0.1",
  status: "insufficient_data",
  reason: "insufficient_history",
  semantics: "scenario_range_not_confidence_interval",
  observed_months: 4,
  min_months_required: 6,
  months_missing: 2,
  points: [],
  evidence: {
    latest_score: 12.3,
    momentum: -49.2,
    volatility: 0,
    source_months: ["2026-06", "2026-07", "2026-08"],
  },
};

export function alert(companyId: string, kind: Alert["kind"] = "down"): Alert {
  return {
    rule_version: "xray-score/0.1",
    company_id: companyId,
    group_id: "GROUP_1",
    month: "2026-08",
    kind,
    stage: kind === "down" ? "candidate" : null,
    state: "falling",
    previous_state: "slipping",
    score: 12.3,
    delta: -27.9,
    driver: null,
  };
}

export function company(id: string, groupId: string): CompanyDetail {
  const series = [
    month("2026-05", null, "not_evaluable"),
    month("2026-06", 61.5, "healthy"),
    month("2026-07", 40.2, "slipping"),
    month("2026-08", 12.3, "falling"),
  ];
  return {
    rule_version: "xray-score/0.1",
    company_id: id,
    name:
      id === "COMP_0176"
        ? "Talleres Ribera"
        : id === "COMP_0077"
          ? "Bodegas Altamira"
          : id,
    group_id: groupId,
    currency: "EUR",
    scorable: true,
    holdout: false,
    months_observed: 4,
    last_observed_month: "2026-08",
    stale: false,
    debt_outstanding: 0,
    invoice_facts: {
      overdue_count: 2,
      overdue_amount: 12_000,
      oldest_overdue_days: 45,
    },
    treasury: {
      starting_cash: 150_000,
      pending_receivables: 33_333.33,
      credit_line_limit: 73_333.33,
      credit_line_drawn: 40_000,
    },
    latest: {
      month: "2026-08",
      score: 12.3,
      delta_3: null,
      delta_6: null,
      level: 12.3,
      momentum: -49.2,
      state: "falling",
      confidence: "high",
    },
    trend_projection: trendProjectionRefusal,
    series,
  };
}

export function explain(id: string, groupId: string): Explain {
  return {
    company_id: id,
    name: id,
    group_id: groupId,
    month: "2026-08",
    score: 12.3,
    level: 12.3,
    momentum: -49.2,
    state: "falling",
    state_label: "cayendo",
    confidence: "high",
    drivers: [
      {
        code: "balance",
        contribution: -37.7,
        value: 0.4,
        unit: "ratio",
        period: "2026-06 a 2026-08",
        text: "Cobros 40.000 € frente a pagos 100.000 € en 2026-06 a 2026-08: cobertura 0.40",
      },
      {
        code: "inflow_vs_prev6",
        contribution: 0,
        value: -62,
        unit: "percent",
        period: "2026-08",
        text: "Cobros del mes un -62 % frente a la media de los seis meses anteriores",
      },
    ],
    changed: [{ code: "balance", delta: -27.9 }],
    events: ["E1"],
    evidence: {
      months_observed: 4,
      transactions_in_window: 30,
      share_uncategorised: 0.1,
      window: "2026-06 a 2026-08",
      cutoff: "2026-08",
      currency: "EUR",
      sources: { transactions: true, invoices: true, debt: false },
      rule_version: "xray-score/0.1",
    },
    flows: {
      inflow: 40_000,
      outflow: 100_000,
      financing_in: 0,
      financing_out: 0,
      debt_repayment: 0,
    },
    invoice_facts: {
      overdue_count: 2,
      overdue_amount: 12_000,
      oldest_overdue_days: 45,
    },
    action: "Reclamar las 2 facturas vencidas desde Cuentas por cobrar",
  };
}

export const companies = ["COMP_A", "COMP_B", "COMP_C"].map((id) => {
  const { series: _series, ...summary } = company(id, "GROUP_1");
  return summary;
});

export const report: Report = {
  schema_version: "human-v2",
  company_id: "COMP_A",
  company_name: "Industrias Ebro",
  month: "2026-08",
  role: "financiero",
  rule_version: "xray-score/0.1",
  generated_at: "2026-09-19T12:00:00.000Z",
  score: 12,
  state: "falling",
  state_label: "cayendo",
  headline: "Los pagos superan con claridad a los cobros",
  summary: "La tesorería necesita atención inmediata.",
  score_explanation:
    "Los cobros han caído.\n\nLas facturas vencidas presionan la caja.",
  outlook: "Si nada cambia, la lectura seguirá débil.",
  caveat: "La actividad registrada es escasa.",
  next_steps: ["Revisar las facturas vencidas."],
  source: "llm",
  export_url: "/companies/COMP_A/report.pdf?role=financiero",
  trend_projection: trendProjectionRefusal,
};

export const group: GroupMap = {
  group_id: "GROUP_1",
  holdout: false,
  n_companies: 2,
  n_falling: 1,
  debt_outstanding: 0,
  debt_share_top: null,
  tension: true,
  tension_reason: "1 de 2 empresas cayendo o torciéndose",
  members: [
    {
      company_id: "COMP_A",
      name: "COMP_A",
      debt_outstanding: 0,
      debt_share: null,
      month: "2026-08",
      score: 12.3,
      delta_3: null,
      delta_6: null,
      level: 12.3,
      momentum: -49.2,
      state: "falling",
      confidence: "high",
      state_label: "cayendo",
    },
    {
      company_id: "COMP_B",
      name: "COMP_B",
      debt_outstanding: 0,
      debt_share: null,
      month: "2026-08",
      score: 91,
      delta_3: null,
      delta_6: null,
      level: 91,
      momentum: 0.6,
      state: "healthy",
      confidence: "high",
      state_label: "sana",
    },
  ],
};

export const uploadBatch: UploadBatch = {
  batch_id: "20260920T101500000Z",
  uploaded_at: "2026-09-20T10:15:00.000Z",
  files: [
    { name: "transactions", rows: 12_480, bytes: 2_621_440 },
    { name: "balances", rows: 1286, bytes: 40_960 },
  ],
};

export const uploads: Uploads = {
  batches: [uploadBatch],
  scored_at: "2026-09-19T13:04:05+00:00",
  pending: true,
};

export function graphNode(
  companyId: string,
  groupId: string | null,
  state: RelationNode["state"],
  degree: number,
): RelationNode {
  return {
    company_id: companyId,
    name: companyId,
    group_id: groupId,
    degree,
    role: degree === 0 ? "isolated" : "connected",
    intercompany_flow_volume_minor: 0,
    score: 50,
    state,
    scorable: true,
  };
}

export function graphEdge(
  source: string,
  target: string,
  type: RelationEdge["relation_type"],
  scope: RelationEdge["scope"],
  confidence: RelationEdge["confidence"],
): RelationEdge {
  return {
    source,
    target,
    relation_type: type,
    subtype: "funds_transfer",
    scope,
    confidence,
    claim_status: "inferred",
    evidence_level: "bank_mirror",
    matches: 12,
    amount_minor: 123_456_789,
    currency: "EUR",
    first_date: "2026-01-05",
    last_date: "2026-08-20",
    evidence_ids: [],
    detail: {},
    example: "",
    provider_identity_confirmed: false,
  };
}

export const graph: Graph = {
  meta: {
    rule_version: "relations/0.1",
    generated_at: "2026-09-19T10:00:00.000Z",
    counts: {
      INFERRED_PAYMENT_TO: 3,
      OPEN_OBLIGATION_TO: 1,
      SHARES_COUNTERPARTY_WITH: 1,
    },
  },
  nodes: [
    graphNode("COMP_A", "GROUP_1", "falling", 3),
    graphNode("COMP_B", "GROUP_1", "stable", 2),
    graphNode("COMP_C", "GROUP_1", "stable", 2),
    graphNode("COMP_D", "GROUP_2", "slipping", 3),
    graphNode("COMP_E", "GROUP_2", "not_evaluable", 0),
    graphNode("COMP_F", null, "not_evaluable", 0),
  ],
  edges: [
    {
      ...graphEdge(
        "COMP_A",
        "COMP_B",
        "INFERRED_PAYMENT_TO",
        "intragroup",
        "high",
      ),
      subtype: "funds_transfer",
    },
    {
      ...graphEdge(
        "COMP_B",
        "COMP_C",
        "OPEN_OBLIGATION_TO",
        "intragroup",
        "medium",
      ),
      subtype: "sale_to_purchase_invoice",
      evidence_level: "invoice_mirror",
      matches: 3,
      amount_minor: 4_500_000,
      first_date: "2026-02-11",
      last_date: "2026-07-30",
    },
    {
      ...graphEdge(
        "COMP_C",
        "COMP_D",
        "SHARES_COUNTERPARTY_WITH",
        "intergroup",
        "low",
      ),
      subtype: "shared_supplier_or_client",
      evidence_level: "shared_counterparty_id",
      matches: 1,
      amount_minor: 0,
    },
    {
      ...graphEdge(
        "COMP_D",
        "COMP_A",
        "INFERRED_PAYMENT_TO",
        "intergroup",
        "low",
      ),
      currency: "GBP",
    },
    graphEdge(
      "COMP_A",
      "COMP_D",
      "INFERRED_PAYMENT_TO",
      "intergroup",
      "medium",
    ),
  ],
};

export function starGraph(stars: number, leaves: number): Graph {
  const nodes: RelationNode[] = [];
  const edges: RelationEdge[] = [];
  for (let star = 0; star < stars; star += 1) {
    const hub = `HUB_${String(star).padStart(3, "0")}`;
    nodes.push({
      ...graphNode(hub, `GROUP_${star}`, "stable", leaves),
      role: "group_treasury_hub",
    });
    for (let leaf = 0; leaf < leaves; leaf += 1) {
      const id = `${hub}_${leaf}`;
      nodes.push(graphNode(id, `GROUP_${star}`, "healthy", 1));
      edges.push(
        graphEdge(hub, id, "INFERRED_PAYMENT_TO", "intragroup", "high"),
      );
    }
  }
  return { meta: graph.meta, nodes, edges };
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

function optionalParam<Schema extends z.ZodType>(
  schema: Schema,
  value: string | null,
): z.infer<Schema> | undefined {
  const parsed = schema.safeParse(value ?? undefined);
  return parsed.success ? parsed.data : undefined;
}

export function filterGraph(url: URL): Graph {
  const type = optionalParam(relationTypeSchema, url.searchParams.get("type"));
  const scope = optionalParam(
    relationScopeSchema,
    url.searchParams.get("scope"),
  );
  const minimum =
    optionalParam(
      relationConfidenceSchema,
      url.searchParams.get("confidence"),
    ) ?? "low";
  const group = url.searchParams.get("group_id");
  const includeIsolated = url.searchParams.get("include_isolated") === "true";
  const groupOf = new Map(
    graph.nodes.map((node) => [node.company_id, node.group_id]),
  );
  const inGroup = (companyId: string) =>
    group === null || groupOf.get(companyId) === group;
  const edges = graph.edges.filter(
    (edge) =>
      (type === undefined || edge.relation_type === type) &&
      CONFIDENCE_RANK[edge.confidence] >= CONFIDENCE_RANK[minimum] &&
      (scope === undefined || edge.scope === scope) &&
      inGroup(edge.source) &&
      inGroup(edge.target),
  );
  const nodes = graph.nodes.filter(
    (node) =>
      (group === null || node.group_id === group) &&
      (includeIsolated || node.degree > 0),
  );
  return graphSchema.parse({ meta: graph.meta, nodes, edges });
}

type Route = {
  pattern: RegExp;
  body: (match: RegExpMatchArray, url: URL) => object;
};

const routes: Route[] = [
  { pattern: /^\/api\/meta$/, body: () => meta },
  { pattern: /^\/api\/alerts/, body: () => ({ alerts }) },
  { pattern: /^\/api\/companies$/, body: () => ({ companies }) },
  {
    pattern: /^\/api\/companies\/(\w+)\/explain$/,
    body: (match) => explain(match[1] ?? "", "GROUP_1"),
  },
  {
    pattern: /^\/api\/companies\/(\w+)\/report$/,
    body: (match, url) => ({
      ...report,
      company_id: match[1] ?? "",
      role: roleSchema.parse(url.searchParams.get("role")),
    }),
  },
  {
    pattern: /^\/api\/companies\/(\w+)$/,
    body: (match) => company(match[1] ?? "", "GROUP_1"),
  },
  { pattern: /^\/api\/groups\/(\w+)$/, body: () => group },
  { pattern: /^\/api\/graph$/, body: (_match, url) => filterGraph(url) },
  { pattern: /^\/api\/uploads$/, body: () => uploads },
  {
    pattern: /^\/api\/compare$/,
    body: (_match, url) => {
      const ids = url.searchParams.get("ids")?.split(",") ?? [];
      return {
        months: ["2026-05", "2026-06", "2026-07", "2026-08"],
        companies: ids.map((id) => company(id, "GROUP_1")),
      };
    },
  },
];

export function fakeApi(seen: string[]) {
  return (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input), "https://web.test");
    seen.push(url.pathname);
    const route = routes.find((candidate) =>
      candidate.pattern.test(url.pathname),
    );
    const match = url.pathname.match(route?.pattern ?? /$^/);
    return Promise.resolve(
      route && match
        ? Response.json(route.body(match, url))
        : new Response("not found", { status: 404 }),
    );
  };
}
