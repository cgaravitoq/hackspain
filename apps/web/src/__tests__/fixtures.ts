import type {
  Alert,
  CompanyDetail,
  Explain,
  GroupMap,
  Meta,
  MonthEntry,
} from "@hackspain/shared";

function month(
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
  state_labels: {},
  latest_month: "2026-08",
  holdout_groups: [],
};

export const alerts: Alert[] = [
  {
    company_id: "COMP_A",
    group_id: "GROUP_1",
    month: "2026-08",
    kind: "down",
    state: "falling",
    previous_state: "slipping",
    score: 12.3,
    delta: -27.9,
    driver: "Cobros 40.000 € frente a pagos 100.000 €",
  },
  {
    company_id: "COMP_C",
    group_id: "GROUP_2",
    month: "2026-08",
    kind: "recovered",
    state: "stable",
    previous_state: "slipping",
    score: 55,
    delta: 6.2,
    driver: null,
  },
];

export function company(id: string, groupId: string): CompanyDetail {
  const series = [
    month("2026-05", null, "not_evaluable"),
    month("2026-06", 61.5, "healthy"),
    month("2026-07", 40.2, "slipping"),
    month("2026-08", 12.3, "falling"),
  ];
  return {
    company_id: id,
    group_id: groupId,
    currency: "EUR",
    scorable: true,
    holdout: false,
    months_observed: 4,
    debt_outstanding: 0,
    invoice_facts: {
      overdue_count: 2,
      overdue_amount: 12_000,
      oldest_overdue_days: 45,
    },
    latest: {
      month: "2026-08",
      score: 12.3,
      level: 12.3,
      momentum: -49.2,
      state: "falling",
      confidence: "high",
    },
    series,
  };
}

export function explain(id: string, groupId: string): Explain {
  return {
    company_id: id,
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
      debt_outstanding: 0,
      debt_share: null,
      month: "2026-08",
      score: 12.3,
      level: 12.3,
      momentum: -49.2,
      state: "falling",
      confidence: "high",
      state_label: "cayendo",
    },
    {
      company_id: "COMP_B",
      debt_outstanding: 0,
      debt_share: null,
      month: "2026-08",
      score: 91,
      level: 91,
      momentum: 0.6,
      state: "healthy",
      confidence: "high",
      state_label: "sana",
    },
  ],
};

type Route = { pattern: RegExp; body: (match: RegExpMatchArray) => object };

const routes: Route[] = [
  { pattern: /^\/api\/meta$/, body: () => meta },
  { pattern: /^\/api\/alerts/, body: () => ({ alerts }) },
  { pattern: /^\/api\/companies$/, body: () => ({ companies: [] }) },
  {
    pattern: /^\/api\/companies\/(\w+)\/explain$/,
    body: (match) => explain(match[1] ?? "", "GROUP_1"),
  },
  {
    pattern: /^\/api\/companies\/(\w+)$/,
    body: (match) => company(match[1] ?? "", "GROUP_1"),
  },
  { pattern: /^\/api\/groups\/(\w+)$/, body: () => group },
];

export function fakeApi(seen: string[]) {
  return (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(String(input), "https://web.test").pathname;
    seen.push(path);
    const route = routes.find((candidate) => candidate.pattern.test(path));
    const match = path.match(route?.pattern ?? /$^/);
    return Promise.resolve(
      route && match
        ? Response.json(route.body(match))
        : new Response("not found", { status: 404 }),
    );
  };
}
