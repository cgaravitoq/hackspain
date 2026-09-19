import {
  type Alert,
  alertKindSchema,
  type CompanyDetail,
  type Group,
  type MonthEntry,
  STATE_LABELS,
  type State,
} from "@hackspain/shared";
import { z } from "zod";
import type { Store } from "./store.ts";

const companyId = z
  .string()
  .describe("Embat company id, for example COMP_0176");

export const toolInputs = {
  score: z.object({ company_id: companyId }),
  explain: z.object({
    company_id: companyId,
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Month as YYYY-MM; the latest month when omitted"),
  }),
  what_changed: z.object({ company_id: companyId }),
  group_map: z.object({
    group_id: z.string().describe("Embat group id, for example GROUP_0220"),
  }),
  alerts: z.object({
    kind: alertKindSchema
      .optional()
      .describe("down (worsened), recovered (left a down state) or up"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
};

export const toolDescriptions = {
  score:
    "Current X Ray health score (0-100), trajectory state and confidence of a company",
  explain:
    "Why a company has its score in a month: drivers with figures and periods, active events, evidence card and the Embat action to take",
  what_changed:
    "What moved the score since the previous month and since when the company is in its current state",
  group_map:
    "Every company of a group with score, state and share of the group debt, plus whether the group is under tension",
  alerts:
    "Companies whose state changed in the latest month, worst first, with the driver behind each one",
};

export type ToolName = keyof typeof toolInputs;

type Unknown = { error: string };

const DOWN: readonly State[] = ["slipping", "falling"];

function unknownCompany(id: string): Unknown {
  return { error: `Unknown company ${id}` };
}

function latestScored(company: CompanyDetail): MonthEntry | undefined {
  return company.series.findLast((entry) => entry.score !== null);
}

function activeEvents(entry: MonthEntry): string[] {
  return Object.entries(entry.events)
    .filter(([, active]) => active)
    .map(([code]) => code);
}

function action(company: CompanyDetail, entry: MonthEntry): string {
  const overdue = company.invoice_facts.overdue_count ?? 0;
  const debtBreak = entry.drivers.some(
    (driver) => driver.code === "debt_repayment_break",
  );
  if (entry.state === "falling" && debtBreak) {
    return "Revisar el calendario de cuotas en Financiación: este mes no hay pago de deuda";
  }
  if (DOWN.includes(entry.state) && overdue > 0) {
    return `Reclamar las ${overdue} facturas vencidas desde Cuentas por cobrar`;
  }
  if (DOWN.includes(entry.state)) {
    return "Abrir la previsión de tesorería a 13 semanas y revisar los pagos comprometidos";
  }
  if (entry.state === "improving" || entry.state === "healthy") {
    return "Sin acción: mantener el seguimiento mensual";
  }
  return "Seguimiento en el panel de tesorería";
}

function scoreOf(company: CompanyDetail) {
  const entry = latestScored(company);
  return {
    company_id: company.company_id,
    group_id: company.group_id,
    month: entry?.month ?? null,
    score: entry?.score ?? null,
    level: entry?.level ?? null,
    momentum: entry?.momentum ?? null,
    state: company.latest.state,
    state_label: STATE_LABELS[company.latest.state],
    confidence: company.latest.confidence,
    months_observed: company.months_observed,
    holdout: company.holdout,
    debt_outstanding: company.debt_outstanding,
    evidence: entry?.evidence ?? null,
  };
}

function explainOf(company: CompanyDetail, entry: MonthEntry) {
  return {
    company_id: company.company_id,
    group_id: company.group_id,
    month: entry.month,
    score: entry.score,
    level: entry.level,
    momentum: entry.momentum,
    state: entry.state,
    state_label: STATE_LABELS[entry.state],
    confidence: entry.confidence,
    drivers: entry.drivers,
    changed: entry.changed,
    events: activeEvents(entry),
    evidence: entry.evidence,
    flows: entry.flows,
    invoice_facts: company.invoice_facts,
    action: action(company, entry),
  };
}

function whatChangedOf(company: CompanyDetail) {
  const scored = company.series.filter((entry) => entry.score !== null);
  const now = scored.at(-1);
  const before = scored.at(-2);
  if (!(now && before)) {
    return {
      company_id: company.company_id,
      error: "Fewer than two scored months",
    };
  }
  const stateSince =
    scored.findLast((entry) => entry.state !== now.state)?.month ?? null;
  return {
    company_id: company.company_id,
    month: now.month,
    previous_month: before.month,
    score: now.score,
    previous_score: before.score,
    delta: Math.round(((now.score ?? 0) - (before.score ?? 0)) * 10) / 10,
    state: now.state,
    state_label: STATE_LABELS[now.state],
    previous_state: before.state,
    state_since: stateSince,
    changed: now.changed,
    drivers: now.drivers.slice(0, 3).map((driver) => driver.text),
    events: activeEvents(now),
  };
}

function tensionReason(group: Group): string | null {
  if (!group.tension) {
    return null;
  }
  const down = group.members.filter((member) => DOWN.includes(member.state));
  if (down.length / group.n_companies >= 0.5) {
    return `${down.length} de ${group.n_companies} empresas cayendo o torciéndose`;
  }
  const debtor = down.find(
    (member) => member.debt_share !== null && member.debt_share >= 0.8,
  );
  return debtor
    ? `${debtor.company_id} concentra el ${Math.round((debtor.debt_share ?? 0) * 100)} % de la deuda del grupo y está ${STATE_LABELS[debtor.state]}`
    : null;
}

function withLabel(alert: Alert) {
  return { ...alert, state_label: STATE_LABELS[alert.state] };
}

export function createTools(store: Store) {
  return {
    async score(input: z.infer<typeof toolInputs.score>) {
      const company = await store.company(input.company_id);
      return company ? scoreOf(company) : unknownCompany(input.company_id);
    },

    async explain(input: z.infer<typeof toolInputs.explain>) {
      const company = await store.company(input.company_id);
      if (!company) {
        return unknownCompany(input.company_id);
      }
      const entry = input.month
        ? company.series.find((item) => item.month === input.month)
        : latestScored(company);
      if (!entry) {
        return {
          error: `No scored month ${input.month ?? ""} for ${input.company_id}`,
        };
      }
      return explainOf(company, entry);
    },

    async what_changed(input: z.infer<typeof toolInputs.what_changed>) {
      const company = await store.company(input.company_id);
      return company
        ? whatChangedOf(company)
        : unknownCompany(input.company_id);
    },

    async group_map(input: z.infer<typeof toolInputs.group_map>) {
      const group = await store.group(input.group_id);
      if (!group) {
        return { error: `Unknown group ${input.group_id}` };
      }
      return {
        ...group,
        tension_reason: tensionReason(group),
        members: group.members.map((member) => ({
          ...member,
          state_label: STATE_LABELS[member.state],
        })),
      };
    },

    async alerts(input: z.infer<typeof toolInputs.alerts>) {
      const alerts = await store.alerts(input.kind, input.limit);
      return {
        month: alerts[0]?.month ?? null,
        count: alerts.length,
        alerts: alerts.map(withLabel),
      };
    },
  };
}

export type Tools = ReturnType<typeof createTools>;

export type ToolOutput = Awaited<ReturnType<Tools[ToolName]>>;
