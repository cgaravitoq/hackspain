import {
  type Alert,
  type Backtest,
  type CompanyDetail,
  type Group,
  type Meta,
  type MonthEntry,
  STATE_LABELS,
  type State,
} from "@hackspain/shared";

type Month = {
  month: string;
  score: number | null;
  state: State;
  observed?: boolean;
};

function entry(month: Month, previous: Month | undefined): MonthEntry {
  const score = month.score;
  const previousScore = previous?.score ?? null;
  const delta =
    score !== null && previousScore !== null
      ? Math.round((score - previousScore) * 10) / 10
      : null;
  const scored = score !== null;
  return {
    month: month.month,
    observed: month.observed ?? true,
    level: score,
    momentum: delta,
    adjustment: scored ? 0 : null,
    score,
    delta_3: null,
    delta_6: null,
    state: month.state,
    confidence: scored ? "high" : "none",
    components:
      score !== null
        ? { balance: score - 50, fees: 0, refunds: 0, momentum: 0 }
        : {},
    drivers:
      score !== null
        ? [
            {
              code: "balance",
              contribution: score - 50,
              value: 0.4,
              unit: "ratio",
              period: `${month.month} a ${month.month}`,
              text: `Cobros 40.000 € frente a pagos 100.000 € en ${month.month}: cobertura 0.40`,
            },
          ]
        : [],
    changed: delta !== null ? [{ code: "balance", delta }] : [],
    evidence: {
      months_observed: 12,
      transactions_in_window: 30,
      share_uncategorised: 0.1,
      window: scored ? `${month.month} a ${month.month}` : null,
      cutoff: month.month,
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
    events: { E1: month.state === "falling", E2: false, E3: false, E4: false },
  };
}

export function company(
  id: string,
  groupId: string,
  months: Month[],
): CompanyDetail {
  const series = months.map((month, index) => entry(month, months[index - 1]));
  const latest = series.at(-1);
  if (!latest) {
    throw new Error("a company needs at least one month");
  }
  return {
    rule_version: "xray-score/0.1",
    company_id: id,
    group_id: groupId,
    currency: "EUR",
    scorable: latest.score !== null,
    holdout: false,
    months_observed: months.filter((month) => month.observed !== false).length,
    last_observed_month: latest.month,
    stale: false,
    debt_outstanding: 0,
    invoice_facts: {
      overdue_count: 2,
      overdue_amount: 12_000,
      oldest_overdue_days: 45,
    },
    latest: {
      month: latest.month,
      score: latest.score,
      delta_3: latest.delta_3,
      delta_6: latest.delta_6,
      level: latest.level,
      momentum: latest.momentum,
      state: latest.state,
      confidence: latest.confidence,
    },
    series,
  };
}

export const falling = company("COMP_A", "GROUP_1", [
  { month: "2026-05", score: null, state: "not_evaluable" },
  { month: "2026-06", score: 61.5, state: "healthy" },
  { month: "2026-07", score: 40.2, state: "slipping" },
  { month: "2026-08", score: 12.3, state: "falling" },
]);

export const healthy = company("COMP_B", "GROUP_1", [
  { month: "2026-06", score: 88.1, state: "healthy" },
  { month: "2026-07", score: 90.4, state: "healthy" },
  { month: "2026-08", score: 91.0, state: "healthy" },
]);

export const ribera = company("COMP_0176", "GROUP_3", [
  { month: "2026-06", score: 70.0, state: "stable" },
  { month: "2026-07", score: 72.5, state: "stable" },
  { month: "2026-08", score: 74.1, state: "stable" },
]);

export const meridian = company("COMP_0909", "GROUP_2", [
  { month: "2026-04", score: null, state: "not_evaluable", observed: false },
  { month: "2026-05", score: null, state: "not_evaluable" },
  { month: "2026-06", score: null, state: "not_evaluable", observed: false },
  { month: "2026-07", score: 66.0, state: "stable" },
  { month: "2026-08", score: 64.5, state: "stable" },
]);

export const slipping = company("COMP_D", "GROUP_2", [
  { month: "2026-05", score: 70.0, state: "healthy" },
  { month: "2026-06", score: 45.0, state: "slipping" },
  { month: "2026-07", score: 42.0, state: "slipping" },
  { month: "2026-08", score: 40.0, state: "slipping" },
]);

export const group: Group = {
  group_id: "GROUP_1",
  holdout: false,
  n_companies: 2,
  n_falling: 1,
  debt_outstanding: 0,
  debt_share_top: null,
  tension: true,
  members: [falling, healthy].map((member) => ({
    company_id: member.company_id,
    debt_outstanding: 0,
    debt_share: null,
    ...member.latest,
  })),
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
    driver:
      "Cobros 40.000 € frente a pagos 100.000 € en 2026-08: cobertura 0.40",
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
  state_labels: { ...STATE_LABELS, falling: "en caída" },
  latest_month: "2026-08",
  holdout_groups: [],
  gaps: { companies_with_gaps: 1, unobserved_months: 2, stale_companies: 0 },
};

export const backtest: Backtest = {
  rule_version: "xray-score/0.1",
  events: {
    E1: {
      events: 2,
      with_prior_alert: 0,
      coverage: 0.0,
      median_lead_months: null,
    },
  },
  alerts: {
    evaluated: 1,
    false_alarms: 0,
    false_alarm_rate: 0.0,
    reverted_within_3_months: 0,
    revert_rate: 0.0,
    censored: 1,
  },
  alerts_by_stage: {
    candidate: {
      evaluated: 0,
      false_alarms: 0,
      false_alarm_rate: 0.0,
      reverted_within_3_months: 0,
      revert_rate: 0.0,
      censored: 1,
    },
    confirmed: {
      evaluated: 1,
      false_alarms: 0,
      false_alarm_rate: 0.0,
      reverted_within_3_months: 0,
      revert_rate: 0.0,
      censored: 0,
    },
  },
  definitions: { E1: "cash stress" },
};

export async function seed(db: D1Database): Promise<void> {
  const statements = [falling, healthy, ribera, meridian, slipping].map(
    (detail) => {
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
    },
  );
  statements.push(
    db
      .prepare(
        "INSERT INTO groups (group_id, tension, payload) VALUES (?1, ?2, ?3)",
      )
      .bind(group.group_id, 1, JSON.stringify(group)),
    ...alerts.map((alert, position) =>
      db
        .prepare(
          "INSERT INTO alerts (position, company_id, group_id, kind, payload) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(
          position,
          alert.company_id,
          alert.group_id,
          alert.kind,
          JSON.stringify(alert),
        ),
    ),
    db
      .prepare("INSERT INTO documents (name, payload) VALUES (?1, ?2)")
      .bind("meta", JSON.stringify(meta)),
    db
      .prepare("INSERT INTO documents (name, payload) VALUES (?1, ?2)")
      .bind("backtest", JSON.stringify(backtest)),
  );
  await db.batch(statements);
}
