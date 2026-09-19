import {
  type Driver,
  REPORT_WORD_LIMITS,
  type Report,
  type Role,
  type State,
} from "@hackspain/shared";
import type { ReportSources } from "./report.ts";

export type Narrative = Pick<
  Report,
  | "headline"
  | "summary"
  | "score_explanation"
  | "outlook"
  | "caveat"
  | "next_steps"
>;

type Finding = { code: Driver["code"]; hypothesis: string; check: string };

export type ReportFacts = {
  company: string;
  month: string;
  score: number | null;
  state: State;
  state_label: string;
  state_since: string | null;
  data_quality: "suficiente" | "limitada" | "insuficiente";
  retrospective: boolean;
  period: string | null;
  period_inflow: string | null;
  period_outflow: string | null;
  period_inflow_as_pct_of_outflow: number | null;
  last_month_inflow_vs_prev6_avg_pct: number | null;
  fees_pct: number | null;
  refunds_pct: number | null;
  withdrawals_pct: number | null;
  debt_payment_missing: boolean;
  overdue_invoices: number | null;
  overdue_amount: string | null;
  group: { companies: number; falling: number } | null;
  findings: Finding[];
  suggested_action: string;
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const euroFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
});
const percentFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

function monthName(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1] ?? month} de ${year}`;
}

function windowName(start: string, end: string): string {
  if (start === end) {
    return monthName(end);
  }
  const [startYear, startIndex] = start.split("-");
  const [endYear, endIndex] = end.split("-");
  const first = MONTHS[Number(startIndex) - 1] ?? start;
  const last = MONTHS[Number(endIndex) - 1] ?? end;
  return startYear === endYear
    ? `${first} a ${last} de ${endYear}`
    : `${first} de ${startYear} a ${last} de ${endYear}`;
}

function euro(value: number): string {
  return `${euroFormat.format(value)} €`;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function driverValue(sources: ReportSources, code: Driver["code"]) {
  const value = sources.explanation.drivers.find(
    (driver) => driver.code === code,
  )?.value;
  return value === null || value === undefined ? null : value;
}

export function reportFacts(
  sources: ReportSources,
  company: string,
): ReportFacts {
  const { explanation: e, group } = sources;
  const window = e.evidence.window?.split(" a ") ?? null;
  const [start, end] = window ?? [];
  const months =
    start && end
      ? sources.company.series.filter(
          (entry) =>
            entry.observed && entry.month >= start && entry.month <= end,
        )
      : [];
  const inflow = months.reduce((total, entry) => total + entry.flows.inflow, 0);
  const outflow = months.reduce(
    (total, entry) => total + entry.flows.outflow,
    0,
  );
  const inflowChange = driverValue(sources, "inflow_vs_prev6");
  const fees = driverValue(sources, "fees");
  const refunds = driverValue(sources, "refunds");
  const withdrawals = driverValue(sources, "withdrawals");
  const diagnosis = e.diagnosis;
  return {
    company,
    month: monthName(e.month),
    score: e.score === null ? null : Math.round(e.score),
    state: e.state,
    state_label: e.state_label,
    state_since: diagnosis?.state_since
      ? monthName(diagnosis.state_since)
      : null,
    data_quality:
      e.confidence === "none"
        ? "insuficiente"
        : e.confidence === "low"
          ? "limitada"
          : "suficiente",
    retrospective: diagnosis?.status === "RETROSPECTIVE",
    period: start && end && months.length ? windowName(start, end) : null,
    period_inflow: months.length ? euro(inflow) : null,
    period_outflow: months.length ? euro(outflow) : null,
    period_inflow_as_pct_of_outflow:
      months.length && outflow > 0
        ? Math.round((inflow / outflow) * 100)
        : null,
    last_month_inflow_vs_prev6_avg_pct:
      inflowChange === null ? null : Math.round(inflowChange),
    fees_pct: fees === null ? null : round(fees),
    refunds_pct: refunds === null ? null : round(refunds),
    withdrawals_pct: withdrawals === null ? null : round(withdrawals),
    debt_payment_missing: e.drivers.some(
      (driver) => driver.code === "debt_repayment_break",
    ),
    overdue_invoices: e.invoice_facts.overdue_count ?? null,
    overdue_amount:
      e.invoice_facts.overdue_amount === undefined ||
      e.invoice_facts.overdue_amount === null
        ? null
        : euro(e.invoice_facts.overdue_amount),
    group:
      group && !("error" in group)
        ? { companies: group.n_companies, falling: group.n_falling }
        : null,
    findings: (diagnosis?.findings ?? [])
      .filter((finding) => finding.code !== "momentum")
      .map((finding) => ({
        code: finding.code,
        hypothesis: finding.hypothesis,
        check: finding.check,
      })),
    suggested_action: e.action,
  };
}

const FORBIDDEN = [
  "momentum",
  "driver",
  "drivers",
  "contribución",
  "contribuciones",
  "puntos",
  "regla",
  "reglas",
  "rule_version",
  "confianza",
  "held-out",
  "modelo",
  "e1",
  "e2",
  "e3",
  "e4",
  "balance",
  "fees",
  "refunds",
  "inflow_vs_prev6",
  "debt_repayment_break",
  "withdrawals",
  "inflow",
  "outflow",
  "score",
  "solvencia",
  "insolvencia",
  "impago",
  "moroso",
  "morosidad",
  "fraude",
  "quiebra",
  "colapso",
  "colapsa",
  "crítica",
  "crítico",
  "crisis",
  "agota",
  "agotando",
  "saldo negativo",
];

const FORBIDDEN_FOR_SALES = ["riesgo", "riesgos", "cayendo", "torciéndose"];

const SALES_STEP =
  /^(?:¿|Preguntar|Interesarse|Entender|Confirmar con|Conocer)/u;

export function forbiddenWords(role: Role): string[] {
  return role === "ventas" ? [...FORBIDDEN, ...FORBIDDEN_FOR_SALES] : FORBIDDEN;
}

function visibleText(narrative: Narrative): string {
  return [
    narrative.headline,
    narrative.summary,
    narrative.score_explanation,
    narrative.outlook,
    narrative.caveat,
    ...narrative.next_steps,
  ].join("\n");
}

const DATE_PATTERN =
  /\b\d{4}-\d{2}(?:-\d{2})?\b|\b(?:19|20)\d{2}\b|\b[A-Z]+_\d+\b/gu;
const NUMBER_PATTERN =
  /\d+(?:[.,]\d+)*(?:\s*(?:millones|millón|mill\.|M|mil|k)(?![\p{L}]))?/gu;

function parseNumber(token: string): number {
  const multiplier = /(?:millones|millón|mill\.|M)$/u.test(token)
    ? 1_000_000
    : /(?:mil|k)$/u.test(token)
      ? 1000
      : 1;
  const digits = token.replace(/[^\d.,]/gu, "");
  let normalised: string;
  if (digits.includes(",")) {
    normalised = digits.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/u.test(digits)) {
    normalised = digits.replaceAll(".", "");
  } else {
    normalised = digits;
  }
  return Number(normalised) * multiplier;
}

function numbersIn(text: string): { token: string; value: number }[] {
  return [...text.replace(DATE_PATTERN, " ").matchAll(NUMBER_PATTERN)].map(
    ([token]) => ({ token: token.trim(), value: parseNumber(token.trim()) }),
  );
}

const SCORE_SCALE = 100;

function sourcedNumbers(facts: ReportFacts): number[] {
  const numbers = [
    SCORE_SCALE,
    facts.score,
    facts.period_inflow_as_pct_of_outflow,
    facts.last_month_inflow_vs_prev6_avg_pct,
    facts.fees_pct,
    facts.refunds_pct,
    facts.withdrawals_pct,
    facts.overdue_invoices,
    facts.group?.companies,
    facts.group?.falling,
  ].filter((value): value is number => value !== null && value !== undefined);
  const texts = [
    facts.period_inflow,
    facts.period_outflow,
    facts.overdue_amount,
    facts.suggested_action,
    ...facts.findings.flatMap((finding) => [finding.hypothesis, finding.check]),
  ].filter((value): value is string => value !== null);
  return [
    ...numbers,
    ...texts.flatMap((text) => numbersIn(text).map((item) => item.value)),
  ].map((value) => Math.abs(value));
}

function isSourced(value: number, sources: number[]): boolean {
  const target = Math.abs(value);
  if (Number.isInteger(target) && target <= 12) {
    return true;
  }
  return sources.some(
    (source) => Math.abs(target - source) <= Math.max(source * 0.01, 0.5),
  );
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function validateNarrative(
  narrative: Narrative,
  role: Role,
  facts: ReportFacts,
): string[] {
  const violations: string[] = [];
  const text = visibleText(narrative);
  const words = text.split(/\s+/u).filter(Boolean).length;
  if (words > REPORT_WORD_LIMITS[role]) {
    violations.push(
      `too long: ${words} words, limit ${REPORT_WORD_LIMITS[role]}`,
    );
  }
  if (narrative.next_steps.length > 2) {
    violations.push("more than two next steps");
  }
  for (const word of forbiddenWords(role)) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\d_])${escapeRegExp(word)}(?![\\p{L}\\d_])`,
      "iu",
    );
    if (pattern.test(text)) {
      violations.push(`forbidden word: ${word}`);
    }
  }
  if (role === "ventas") {
    for (const step of narrative.next_steps) {
      if (!SALES_STEP.test(step.trim())) {
        violations.push(`sales step is not addressed to the company: ${step}`);
      }
    }
  }
  const sources = sourcedNumbers(facts);
  for (const { token, value } of numbersIn(text)) {
    if (!isSourced(value, sources)) {
      violations.push(`unsourced number: ${token}`);
    }
  }
  return violations;
}

const HEADLINES: Record<State, string> = {
  healthy: "Los cobros cubren con holgura los pagos y la tesorería está sana",
  improving:
    "La tesorería mejora porque los cobros ganan peso frente a los pagos",
  stable: "La tesorería se mantiene estable en los últimos meses",
  slipping: "La relación entre cobros y pagos empeora y conviene vigilarla",
  falling:
    "Los pagos superan con claridad a los cobros y la tesorería se debilita",
  not_evaluable: "No hay datos suficientes para valorar la tesorería este mes",
};

const OUTLOOKS: Record<State, string> = {
  healthy:
    "Si los cobros siguen cubriendo los pagos como hasta ahora, lo esperable es que la situación se mantenga. No hay una proyección que permita concretarlo más.",
  improving:
    "La mejora reciente apunta en buena dirección, pero necesita confirmarse en los próximos meses antes de darla por consolidada.",
  stable:
    "Sin cambios en la relación entre cobros y pagos, lo previsible es una lectura parecida en los próximos meses.",
  slipping:
    "Si la relación entre cobros y pagos no se corrige, lo previsible es que la lectura siga empeorando en los próximos meses.",
  falling:
    "Mientras los pagos sigan superando claramente a los cobros, la lectura seguirá débil. No hay una proyección que permita decir cuándo podría cambiar.",
  not_evaluable:
    "Con los datos disponibles no es posible anticipar cómo evolucionará la tesorería.",
};

type CodeText = {
  observed: (facts: ReportFacts) => string | null;
  check: string;
  question: string;
};

const percent = (value: number) => `${percentFormat.format(value)} %`;

const CODE_TEXT: Partial<Record<Driver["code"], CodeText>> = {
  balance: {
    observed: (facts) =>
      facts.period_inflow_as_pct_of_outflow === null || !facts.period
        ? null
        : `${facts.period.includes(" a ") ? "De" : "En"} ${facts.period} entraron ${facts.period_inflow} y salieron ${facts.period_outflow}: los cobros cubrieron el ${percent(facts.period_inflow_as_pct_of_outflow)} de los pagos.`,
    check:
      "Revisar qué pagos explican la diferencia con los cobros y si alguno fue extraordinario.",
    question:
      "Preguntar cómo esperan equilibrar cobros y pagos en los próximos meses.",
  },
  inflow_vs_prev6: {
    observed: (facts) =>
      facts.last_month_inflow_vs_prev6_avg_pct === null ||
      facts.last_month_inflow_vs_prev6_avg_pct === 0
        ? null
        : facts.last_month_inflow_vs_prev6_avg_pct <= -100
          ? "En el último mes no entró ningún cobro, cuando en los seis meses anteriores sí los hubo."
          : `Los cobros del último mes quedaron un ${percent(Math.abs(facts.last_month_inflow_vs_prev6_avg_pct))} ${facts.last_month_inflow_vs_prev6_avg_pct < 0 ? "por debajo" : "por encima"} de la media de los seis meses anteriores.`,
    check:
      "Comprobar si hay cobros retrasados o si simplemente se concentraron en otros meses.",
    question: "Interesarse por el calendario de cobros que tienen previsto.",
  },
  fees: {
    observed: (facts) =>
      facts.fees_pct
        ? `Las comisiones e intereses bancarios supusieron el ${percent(facts.fees_pct)} de los pagos.`
        : null,
    check: "Revisar las condiciones y los cargos bancarios del periodo.",
    question: "Preguntar por sus condiciones bancarias actuales.",
  },
  refunds: {
    observed: (facts) =>
      facts.refunds_pct
        ? `Las devoluciones de cobros supusieron el ${percent(facts.refunds_pct)} de lo cobrado.`
        : null,
    check: "Enlazar cada devolución con su cobro original.",
    question: "Preguntar si han tenido incidencias recientes en sus cobros.",
  },
  debt_repayment_break: {
    observed: () =>
      "Este mes no aparece la cuota de deuda que se venía pagando.",
    check: "Confirmar el calendario de la deuda con su documentación.",
    question: "Confirmar con la empresa el calendario de su financiación.",
  },
  withdrawals: {
    observed: (facts) =>
      facts.withdrawals_pct
        ? `Las retiradas de efectivo supusieron el ${percent(facts.withdrawals_pct)} de los pagos.`
        : null,
    check: "Documentar el destino de las retiradas de efectivo.",
    question:
      "Entender el uso de las retiradas de efectivo antes de proponer nada.",
  },
};

function caveat(facts: ReportFacts): string {
  if (facts.data_quality !== "suficiente") {
    return "La actividad registrada es escasa, así que esta lectura puede no reflejar la imagen completa de la empresa.";
  }
  if (facts.retrospective) {
    return "El último mes no tiene datos suficientes; la lectura corresponde a un periodo anterior.";
  }
  return "Esta lectura se basa en los movimientos de tesorería: señala dónde mirar, pero no demuestra la causa.";
}

export function templateNarrative(role: Role, facts: ReportFacts): Narrative {
  const texts = facts.findings.flatMap((finding) => {
    const text = CODE_TEXT[finding.code];
    return text ? [{ finding, text }] : [];
  });
  const observed = texts
    .map(({ text }) => text.observed(facts))
    .filter((line): line is string => Boolean(line))
    .slice(0, 2);
  const balance = CODE_TEXT.balance?.observed(facts) ?? null;
  const lines = observed.length ? observed : balance ? [balance] : [];
  const reading =
    facts.score === null
      ? `${facts.company} no tiene una lectura válida de su tesorería en ${facts.month}.`
      : role === "ventas"
        ? `${facts.company} tiene una salud de tesorería de ${facts.score} sobre 100 en ${facts.month}.`
        : `${facts.company} tiene una salud de tesorería de ${facts.score} sobre 100 en ${facts.month}, en estado «${facts.state_label}».`;
  const since =
    facts.state_since &&
    facts.state_since !== facts.month &&
    facts.state !== "not_evaluable"
      ? ` Se mantiene así desde ${facts.state_since}.`
      : "";
  const hypothesis = texts[0]?.finding.hypothesis;
  const group =
    role === "financiero" && facts.group && facts.group.falling > 0
      ? `En su grupo, ${facts.group.falling} de ${facts.group.companies} empresas están en caída.`
      : "";
  const explanation = [
    lines.join(" ") ||
      "No se observan movimientos que cambien la lectura respecto a los meses anteriores.",
    [hypothesis, group].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");
  const steps =
    role === "ventas"
      ? texts.map(({ text }) => text.question)
      : texts.map(({ text }) => text.check);
  const fallbackStep =
    role === "ventas" &&
    (facts.state === "healthy" || facts.state === "improving")
      ? [
          "Entender qué ha impulsado la buena evolución antes de plantear una conversación comercial.",
        ]
      : [];
  return {
    headline: HEADLINES[facts.state],
    summary: `${reading}${since}`,
    score_explanation: explanation,
    outlook: OUTLOOKS[facts.state],
    caveat: caveat(facts),
    next_steps: (steps.length ? steps : fallbackStep).slice(0, 2),
  };
}
