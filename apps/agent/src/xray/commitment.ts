import {
  type CashEvent,
  type CashLedger,
  type CommitmentContext,
  type CommitmentEvaluation,
  type CommitmentRequest,
  type CommitmentResponse,
  type CompanyDetail,
  commitmentContextSchema,
  commitmentResponseSchema,
  euroToMinor,
  type MonthEntry,
  type ReportFigure,
  type ReportSection,
} from "@hackspain/shared";
import {
  addDays,
  addMonths,
  compareAdvances,
  previewCash,
} from "./cash-engine.ts";

const LABEL = "Simulación, no reservable, requiere revisión humana";
const LIMITATIONS = [
  "El saldo contable no acredita caja libre; no se autoriza ni reserva dinero.",
  "Escenario de continuidad de los últimos tres meses, no previsión validada ni garantía de cobro.",
  "Los pagos históricos ya incluyen amortizaciones: no se descuentan dos veces. No se proyectan nuevas entradas de financiación.",
  "No hay conciliación completa de obligaciones futuras. No se añaden las facturas agregadas otra vez al histórico.",
];

function recentHistory(company: CompanyDetail, asOf: string): MonthEntry[] {
  let expected = addMonths(`${asOf.slice(0, 7)}-01`, -1).slice(0, 7);
  const recent: MonthEntry[] = [];
  for (const entry of [...company.series].sort((a, b) =>
    b.month.localeCompare(a.month),
  )) {
    if (!entry.observed || entry.month !== expected) {
      break;
    }
    recent.push(entry);
    expected = addMonths(`${expected}-01`, -1).slice(0, 7);
  }
  return recent;
}

function meanMinor(values: number[]): number {
  let total = 0n;
  for (const value of values) {
    total += BigInt(euroToMinor(String(value)));
  }
  const count = BigInt(values.length);
  return Number((total + count / 2n) / count);
}

export function commitmentContext(company: CompanyDetail): CommitmentContext {
  const snapshot = company.treasury_snapshot ?? null;
  const history = snapshot ? recentHistory(company, snapshot.as_of) : [];
  const recent = history.slice(0, 3);
  const limitations = [
    ...LIMITATIONS,
    ...(snapshot?.limitations ?? ["No hay snapshot de saldos cargado."]),
  ];
  let inflow: number | null = null;
  let outflow: number | null = null;
  if (recent.length === 3) {
    try {
      inflow = meanMinor(recent.map((entry) => entry.flows.inflow));
      outflow = meanMinor(recent.map((entry) => entry.flows.outflow));
    } catch {
      limitations.push(
        "Los flujos históricos no se pueden interpretar como céntimos exactos dentro del rango permitido.",
      );
    }
  } else {
    limitations.push(
      "Se necesitan al menos tres meses observados consecutivos inmediatamente anteriores al corte.",
    );
  }
  if (company.currency !== "EUR") {
    limitations.push(
      "El simulador inicial sólo admite sociedades con moneda EUR.",
    );
  }
  return commitmentContextSchema.parse({
    company_id: company.company_id,
    currency: company.currency,
    as_of: snapshot?.as_of ?? null,
    snapshot,
    history_months: history.length,
    max_horizon_months: Math.min(6, Math.floor(history.length / 3)),
    baseline_months: recent.map((entry) => entry.month).reverse(),
    monthly_inflow_minor: inflow,
    monthly_outflow_minor: outflow,
    basis:
      snapshot?.ledger_minor !== null &&
      snapshot?.ledger_minor !== undefined &&
      company.currency === "EUR"
        ? "LEDGER_SCENARIO_ONLY"
        : "UNAVAILABLE",
    limitations,
  });
}

function baselineEvents(
  context: CommitmentContext,
  months: number,
  asOf: string,
): CashEvent[] {
  const events: CashEvent[] = [];
  for (let month = 0; month < months; month++) {
    const start = addMonths(asOf, month);
    const end = addDays(addMonths(asOf, month + 1), -1);
    const base = { company_id: context.company_id, currency: "EUR" as const };
    events.push(
      {
        ...base,
        id: `baseline:${month}:out`,
        date: addDays(start, 1),
        amount_minor: -(context.monthly_outflow_minor ?? 0),
      },
      {
        ...base,
        id: `baseline:${month}:in`,
        date: end,
        amount_minor: context.monthly_inflow_minor ?? 0,
      },
    );
  }
  return events;
}

function section(evaluation: CommitmentEvaluation): ReportSection {
  const chosen = evaluation.alternatives.find(
    (item) => item.advance_bps === evaluation.minimum_tested_feasible_bps,
  );
  const figures: ReportFigure[] = [];
  const push = (label: string, value: number | null | undefined) => {
    if (value !== null && value !== undefined) {
      figures.push({ label, value: value / 100, unit: "EUR" });
    }
  };
  push(
    "Saldo contable al corte · balances.csv",
    evaluation.context.snapshot?.ledger_minor,
  );
  push("Suelo solicitado para el escenario", evaluation.reserve_floor_minor);
  push("Mínimo sin la nueva operación", evaluation.baseline?.min_cash_minor);
  push("Anticipo mínimo entre los evaluados", chosen?.advance_minor);
  push("Mínimo con esa alternativa", chosen?.cash.min_cash_minor);
  push("Cierre con esa alternativa", chosen?.cash.closing_minor);
  return {
    code: "decision",
    title: "Evaluación de una operación",
    body: `${outcome(evaluation)}\n\n${LABEL}. Los ingresos de la operación son supuestos, no cobros confirmados; no se reserva ni autoriza dinero.\n\n${evaluation.assumptions.map((text) => `- ${text}`).join("\n")}`,
    figures,
  };
}

const euroFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

function euros(minor: number | null | undefined): string {
  return `${euroFormat.format(Math.round((minor ?? 0) / 100))} €`;
}

function advance(bps: number): string {
  return `${bps / 100} %`;
}

const UNEVALUATED: Record<
  Exclude<CommitmentEvaluation["status"], "EVALUATED">,
  string
> = {
  OUTSIDE_HORIZON:
    "Las fechas de la operación quedan fuera del periodo que se puede simular con el histórico disponible; acorta el horizonte o revisa las fechas.",
  INSUFFICIENT_EVIDENCE:
    "No hay saldo o histórico suficiente para simular esta operación con garantías.",
  UNSUPPORTED_CURRENCY:
    "La simulación solo admite empresas que operan en euros.",
};

function outcome(evaluation: CommitmentEvaluation): string {
  if (evaluation.status !== "EVALUATED") {
    return UNEVALUATED[evaluation.status];
  }
  const floor = euros(evaluation.reserve_floor_minor);
  const chosen = evaluation.alternatives.find(
    (item) => item.advance_bps === evaluation.minimum_tested_feasible_bps,
  );
  if (chosen) {
    const lead =
      chosen.advance_bps === 0
        ? "Sin anticipo"
        : `Con un anticipo del ${advance(chosen.advance_bps)} (${euros(chosen.advance_minor)})`;
    return `${lead}, la caja mínima estimada es ${euros(chosen.cash.min_cash_minor)}, por encima del suelo de ${floor}. Es la opción con menor anticipo, entre las evaluadas, que lo consigue.`;
  }
  const options = evaluation.alternatives
    .map((item) => advance(item.advance_bps))
    .join(", ");
  const best = evaluation.alternatives.reduce<
    CommitmentEvaluation["alternatives"][number] | null
  >(
    (current, item) =>
      !current ||
      (item.cash.min_cash_minor ?? Number.NEGATIVE_INFINITY) >
        (current.cash.min_cash_minor ?? Number.NEGATIVE_INFINITY)
        ? item
        : current,
    null,
  );
  const closest = best
    ? ` En el mejor caso, ${best.advance_bps === 0 ? "sin anticipo" : `con un anticipo del ${advance(best.advance_bps)}`}, la caja mínima estimada sería ${euros(best.cash.min_cash_minor)}.`
    : "";
  return `Ninguna de las opciones de anticipo evaluadas (${options}) mantiene la caja por encima del suelo de ${floor}.${closest} Conviene revisar el calendario, los costes o los supuestos.`;
}

export function evaluateCommitment(
  company: CompanyDetail,
  request: CommitmentRequest,
): CommitmentResponse {
  const context = commitmentContext(company);
  const asOf = context.as_of;
  const horizonEnd = asOf ? addMonths(asOf, request.horizon_months) : null;
  const evaluation: CommitmentEvaluation = {
    company_id: company.company_id,
    context,
    calculation_version: "xray-commitment/1",
    status: "INSUFFICIENT_EVIDENCE",
    label: LABEL,
    reservable: false,
    opportunity: request.opportunity,
    horizon_end: horizonEnd,
    reserve_floor_minor: request.reserve_floor_minor,
    search_kind: "ENUMERATED_GRID",
    minimum_tested_feasible_bps: null,
    baseline: null,
    alternatives: [],
    assumptions: [
      ...context.limitations,
      "Supuesto conservador: pagos del histórico al inicio del periodo y cobros al final; no es una predicción diaria.",
      "Importes, fechas, impuestos incluidos y condiciones de la nueva operación son un escenario confirmado por el usuario, pendiente de revisión contractual.",
      "El anticipo debe recibirse antes del desembolso; su retraso exige volver a simular. No se eliminan costes ya comprometidos.",
    ],
  };
  if (company.currency !== "EUR") {
    evaluation.status = "UNSUPPORTED_CURRENCY";
  } else if (
    asOf &&
    horizonEnd &&
    context.snapshot?.ledger_minor !== null &&
    context.snapshot?.ledger_minor !== undefined &&
    context.monthly_inflow_minor !== null &&
    context.monthly_outflow_minor !== null
  ) {
    const dates = [
      request.opportunity.advance_date,
      request.opportunity.final_payment_date,
      ...request.opportunity.costs.map((cost) => cost.date),
    ];
    if (
      request.horizon_months > context.max_horizon_months ||
      dates.some((day) => day <= asOf || day > horizonEnd)
    ) {
      evaluation.status = "OUTSIDE_HORIZON";
    } else {
      const ledger: CashLedger = {
        company_id: company.company_id,
        currency: "EUR",
        as_of: asOf,
        horizon_end: horizonEnd,
        opening_minor: context.snapshot.ledger_minor,
        floor_minor: request.reserve_floor_minor,
        observed_months: context.history_months,
        opening_verified: false,
        coverage_verified: false,
      };
      const events = baselineEvents(context, request.horizon_months, asOf);
      try {
        const baseline = previewCash({ ledger, events });
        const compared = compareAdvances(
          { ledger, events },
          request.opportunity,
        );
        evaluation.baseline = baseline;
        evaluation.alternatives = compared.alternatives;
        evaluation.minimum_tested_feasible_bps =
          compared.minimum_tested_feasible_bps;
        evaluation.status = "EVALUATED";
      } catch {
        evaluation.assumptions.push(
          "No se pudo representar el escenario dentro de los límites monetarios y de identidad permitidos.",
        );
      }
    }
  }
  return commitmentResponseSchema.parse({
    evaluation,
    report_section: section(evaluation),
  });
}
