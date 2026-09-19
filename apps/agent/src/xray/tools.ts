import {
  type Alert,
  alertKindSchema,
  type CommitmentDraftResult,
  type CompanyDetail,
  type Compare,
  commitmentDraftSchema,
  commitmentRequestSchema,
  DEMO_COMPANY_NAMES,
  type Explain,
  type Group,
  type GroupMap,
  type MonthEntry,
  missingDraftFields,
  relationTypeSchema,
  STATE_LABELS,
  type State,
} from "@hackspain/shared";
import { z } from "zod";
import { evaluateCommitment } from "./commitment.ts";
import { diagnose } from "./diagnosis.ts";
import type { Store } from "./store.ts";

const COMPANY_NAMES = new Map(
  Object.entries(DEMO_COMPANY_NAMES).map(([name, id]) => [
    normalizeKey(name),
    id,
  ]),
);

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function resolveCompanyId(value: string): string {
  return COMPANY_NAMES.get(normalizeKey(value)) ?? value.trim();
}

const companyId = z
  .string()
  .describe(
    "Company name or Embat id, for example Talleres Ribera or COMP_0176",
  );

export const toolInputs = {
  draft_commitment: z.strictObject({
    company_id: companyId.min(1).max(120),
    ...commitmentDraftSchema.shape,
  }),
  simulate_commitment: z.strictObject({
    company_id: companyId.min(1).max(120),
    ...commitmentRequestSchema.shape,
  }),
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
  compare: z.object({
    company_ids: z
      .array(companyId)
      .min(1)
      .max(3)
      .describe("One to three companies to compare side by side"),
  }),
  alerts: z.object({
    kind: alertKindSchema
      .optional()
      .describe("down (worsened), recovered (left a down state) or up"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  relations: z.object({
    company_id: companyId,
    relation_type: relationTypeSchema
      .optional()
      .describe(
        "INFERRED_PAYMENT_TO, OPEN_OBLIGATION_TO or SHARES_COUNTERPARTY_WITH",
      ),
  }),
};

export const toolDescriptions = {
  draft_commitment:
    "Turn an operation the user describes (an order, contract or purchase: revenue, advance options, payment dates, costs) into a draft that opens the review form on screen. Amounts in integer cents, dates as YYYY-MM-DD, advances in basis points. Leave out anything the user did not state; never guess. It does not simulate anything.",
  simulate_commitment:
    "Compare user-confirmed order terms against the company's server-loaded EUR ledger and a labelled historical run-rate scenario. Integer cents, at most six months and one third of usable history. Never reserves cash, lends, pays or approves a contract.",
  score:
    "Current X Ray health score (0-100), trajectory state and confidence of a company",
  explain:
    "Why a company has its score in a month: drivers with figures and periods, active events, evidence card and the Embat action to take",
  what_changed:
    "What moved the score since the previous month and since when the company is in its current state",
  group_map:
    "Every company of a group with score, state and share of the group debt, plus whether the group is under tension",
  compare:
    "Up to three companies side by side, aligned on the union of observed months; accepts demo names (Talleres Ribera) or Embat ids (COMP_0176)",
  alerts:
    "Companies whose state changed in the latest month, worst first, with the driver behind each one",
  relations:
    "The companies related to a company, with each counterpart's score and state; every edge is inferred from mirrored movements and is not a verified obligation",
};

export type ToolName = keyof typeof toolInputs;

type Unknown = { error: string };

const DOWN: readonly State[] = ["slipping", "falling"];

function unknownCompany(id: string): Unknown {
  return { error: `Unknown company ${id}` };
}

function unknownCompanies(ids: string[]): Unknown {
  const [only, ...rest] = ids;
  return only !== undefined && rest.length === 0
    ? unknownCompany(only)
    : { error: `Unknown companies ${ids.join(", ")}` };
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
    rule_version: company.rule_version,
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

function explainOf(company: CompanyDetail, entry: MonthEntry): Explain {
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
    diagnosis: diagnose(company, entry),
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
  const previousStateAt = scored.findLastIndex(
    (entry) => entry.state !== now.state,
  );
  const stateSince = scored[previousStateAt + 1]?.month ?? null;
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

function compareOf(companies: CompanyDetail[]): Compare {
  const months = new Set<string>();
  for (const company of companies) {
    for (const entry of company.series) {
      if (entry.observed) {
        months.add(entry.month);
      }
    }
  }
  return { companies, months: [...months].sort() };
}

function groupMapOf(group: Group): GroupMap {
  return {
    ...group,
    tension_reason: tensionReason(group),
    members: group.members.map((member) => ({
      ...member,
      state_label: STATE_LABELS[member.state],
    })),
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

export function draftCommitment(
  input: z.infer<typeof toolInputs.draft_commitment>,
): CommitmentDraftResult {
  const { company_id: requested, ...draft } = input;
  return {
    company_id: resolveCompanyId(requested),
    draft,
    missing: missingDraftFields(draft),
  };
}

export function createTools(store: Store) {
  return {
    async simulate_commitment(
      input: z.infer<typeof toolInputs.simulate_commitment>,
    ) {
      const companyId = resolveCompanyId(input.company_id);
      const company = await store.company(companyId);
      const { company_id: _companyId, ...request } = input;
      return company
        ? evaluateCommitment(company, commitmentRequestSchema.parse(request))
        : unknownCompany(companyId);
    },

    async score(input: z.infer<typeof toolInputs.score>) {
      const companyId = resolveCompanyId(input.company_id);
      const company = await store.company(companyId);
      return company ? scoreOf(company) : unknownCompany(companyId);
    },

    async explain(input: z.infer<typeof toolInputs.explain>) {
      const companyId = resolveCompanyId(input.company_id);
      const company = await store.company(companyId);
      if (!company) {
        return unknownCompany(companyId);
      }
      const entry = input.month
        ? company.series.find((item) => item.month === input.month)
        : latestScored(company);
      if (!entry) {
        return {
          error: `No scored month ${input.month ?? ""} for ${companyId}`,
        };
      }
      const explanation = explainOf(company, entry);
      return input.month
        ? explanation
        : {
            ...explanation,
            state: company.latest.state,
            state_label: STATE_LABELS[company.latest.state],
            confidence: company.latest.confidence,
          };
    },

    async what_changed(input: z.infer<typeof toolInputs.what_changed>) {
      const companyId = resolveCompanyId(input.company_id);
      const company = await store.company(companyId);
      return company ? whatChangedOf(company) : unknownCompany(companyId);
    },

    async group_map(input: z.infer<typeof toolInputs.group_map>) {
      const group = await store.group(input.group_id);
      return group
        ? groupMapOf(group)
        : { error: `Unknown group ${input.group_id}` };
    },

    async compare(input: z.infer<typeof toolInputs.compare>) {
      const ids = input.company_ids.map(resolveCompanyId);
      const companies = await store.details(ids);
      const found = new Set(companies.map((company) => company.company_id));
      const unknown = ids.filter((id) => !found.has(id));
      return unknown.length > 0
        ? unknownCompanies(unknown)
        : compareOf(companies);
    },

    async alerts(input: z.infer<typeof toolInputs.alerts>) {
      const alerts = await store.alerts(input.kind, input.limit);
      return {
        month: alerts[0]?.month ?? null,
        count: alerts.length,
        alerts: alerts.map(withLabel),
      };
    },

    async relations(input: z.infer<typeof toolInputs.relations>) {
      const companyId = resolveCompanyId(input.company_id);
      const relations = await store.companyRelations(
        companyId,
        input.relation_type,
      );
      return relations ?? unknownCompany(companyId);
    },
  };
}

export type Tools = ReturnType<typeof createTools>;

export type ToolOutput = Awaited<
  ReturnType<Tools[Exclude<ToolName, "draft_commitment">]>
>;
