import {
  DEMO_COMPANY_NAMES,
  type Report,
  type ReportFigure,
  type Role,
  reportSchema,
  reportSectionCodeSchema,
} from "@hackspain/shared";
import { generateText, type LanguageModel, Output } from "ai";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { type Judge, RED_LINES, type RedLine } from "./report-judge.ts";
import { ROLE_SECTIONS, reportInstructions } from "./report-policy.ts";
import { createStore } from "./store.ts";
import { createTools } from "./tools.ts";

const prose = z
  .string()
  .min(1)
  .max(6000)
  .regex(/^[^\d]*$/u);
const narrativeSchema = z.strictObject({
  summary: prose,
  sections: z.array(
    z.strictObject({
      code: reportSectionCodeSchema.exclude(["decision"]),
      title: prose.max(160),
      body: prose,
    }),
  ),
});

export function resolveCompany(company: string): string {
  return (
    Object.entries(DEMO_COMPANY_NAMES).find(
      ([name]) => name === company,
    )?.[1] ?? company
  );
}

export function companyName(companyId: string): string {
  return (
    Object.entries(DEMO_COMPANY_NAMES).find(
      ([, id]) => id === companyId,
    )?.[0] ?? companyId
  );
}

export async function reportSources(db: D1Database, companyId: string) {
  const store = createStore(db);
  const company = await store.company(companyId);
  if (!company) {
    throw new HTTPException(404, { message: "Unknown company" });
  }
  const latest = company.series.at(-1);
  if (!latest) {
    throw new HTTPException(422, { message: "No observed month available" });
  }
  const tools = createTools(store);
  const [explanation, changed, group, alerts] = await Promise.all([
    tools.explain({ company_id: companyId, month: latest.month }),
    tools.what_changed({ company_id: companyId }),
    company.group_id ? tools.group_map({ group_id: company.group_id }) : null,
    store.alerts(undefined, 500),
  ]);
  if ("error" in explanation) {
    throw new HTTPException(422, { message: explanation.error });
  }
  return {
    company,
    explanation,
    changed:
      "error" in changed || changed.month === latest.month
        ? changed
        : { error: "Latest month is not scored" },
    group,
    alerts: alerts.filter((alert) => alert.company_id === companyId),
  };
}

export type ReportSources = Awaited<ReturnType<typeof reportSources>>;

function figure(
  label: string,
  value: number | null | undefined,
  unit: string,
): ReportFigure[] {
  return value === null || value === undefined ? [] : [{ label, value, unit }];
}

function sectionFigures(sources: ReportSources) {
  const { explanation: e, changed, group } = sources;
  const label = (name: string) => `${name} · ${e.month} · explain`;
  const situation = [
    ...figure(label("score"), e.score, "points"),
    ...figure(label("level"), e.level, "points"),
    ...figure(label("momentum"), e.momentum, "points"),
  ];
  const changes = [
    ...situation,
    ...("error" in changed
      ? []
      : figure(
          `delta · ${changed.previous_month} → ${changed.month} · what_changed`,
          changed.delta,
          "points",
        )),
    ...e.changed.flatMap((change) =>
      figure(label(`changed.${change.code}`), change.delta, "points"),
    ),
  ];
  const drivers = e.drivers.flatMap((driver) => [
    ...figure(
      `${driver.code}.contribution · ${driver.period} · explain.drivers`,
      driver.contribution,
      "points",
    ),
    ...figure(
      `${driver.code}.value · ${driver.period} · explain.drivers`,
      driver.value,
      driver.unit,
    ),
  ]);
  const review = [
    ...figure(
      label("invoice_facts.overdue_count"),
      e.invoice_facts.overdue_count,
      "invoices",
    ),
    ...figure(
      label("invoice_facts.overdue_amount"),
      e.invoice_facts.overdue_amount,
      e.evidence.currency,
    ),
    ...figure(
      label("invoice_facts.oldest_overdue_days"),
      e.invoice_facts.oldest_overdue_days,
      "days",
    ),
    ...figure(
      label("invoice_facts.top3_share_of_pending"),
      e.invoice_facts.top3_share_of_pending,
      "ratio",
    ),
  ];
  const groupFigures =
    group && !("error" in group)
      ? [
          ...figure(
            `n_companies · ${e.month} · group_map`,
            group.n_companies,
            "companies",
          ),
          ...figure(
            `n_falling · ${e.month} · group_map`,
            group.n_falling,
            "companies",
          ),
          ...figure(
            `debt_outstanding · ${e.month} · group_map`,
            group.debt_outstanding,
            "source currency",
          ),
          ...figure(
            `debt_share_top · ${e.month} · group_map`,
            group.debt_share_top,
            "ratio",
          ),
          ...group.members.flatMap((member) => [
            ...figure(
              `${member.company_id}.debt_outstanding · ${member.month ?? "unavailable"} · group_map`,
              member.debt_outstanding,
              "source currency",
            ),
            ...figure(
              `${member.company_id}.debt_share · ${member.month ?? "unavailable"} · group_map`,
              member.debt_share,
              "ratio",
            ),
          ]),
        ]
      : [];
  const evidence = [
    ...figure(
      label("evidence.months_observed"),
      e.evidence.months_observed,
      "months",
    ),
    ...figure(
      label("evidence.transactions_in_window"),
      e.evidence.transactions_in_window,
      "transactions",
    ),
    ...figure(
      label("evidence.share_uncategorised"),
      e.evidence.share_uncategorised,
      "ratio",
    ),
  ];
  return {
    situation,
    changes,
    drivers,
    review,
    group: groupFigures,
    evidence,
    actions: review,
  };
}

const FORMAT_RETRY =
  "La respuesta anterior no cumplió el formato. Respeta las secciones y no escribas cifras en la narrativa.";

function redLinesRetry(failed: RedLine[]): string {
  const lines = failed.map((line) => RED_LINES[line].retry).join("; ");
  return `La respuesta anterior incumplió las líneas rojas del informe: ${lines}. Reescribe la narrativa sin esas afirmaciones y con el mismo formato.`;
}

async function narrate(
  model: LanguageModel,
  judge: Judge,
  role: Role,
  sources: ReportSources,
): Promise<Report> {
  const sections = ROLE_SECTIONS[role];
  const figures = sectionFigures(sources);
  let retry: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model,
        reasoning: "none",
        maxRetries: 0,
        maxOutputTokens: 6000,
        output: Output.object({ schema: narrativeSchema }),
        system: reportInstructions(role),
        prompt: JSON.stringify({
          role,
          sections: sections.map((section) => ({
            ...section,
            figures: figures[section.source],
          })),
          sources,
          retry,
        }),
      });
      if (
        output.sections.length !== sections.length ||
        output.sections.some(
          (section, index) => section.code !== sections[index]?.code,
        )
      ) {
        retry = FORMAT_RETRY;
        continue;
      }
      const verdict = await judge(output);
      if (verdict.verdict === "rejected") {
        retry = redLinesRetry(verdict.failed);
        continue;
      }
      return reportSchema.parse({
        company_id: sources.explanation.company_id,
        month: sources.explanation.month,
        role,
        rule_version: sources.explanation.evidence.rule_version,
        generated_at: new Date().toISOString(),
        summary: output.summary,
        sections: output.sections.map((section, index) => ({
          ...section,
          figures: figures[sections[index]?.source ?? "evidence"],
        })),
        export_url: `/api/companies/${encodeURIComponent(sources.explanation.company_id)}/report.pdf?role=${role}`,
      });
    } catch {
      retry = FORMAT_RETRY;
    }
  }
  throw new HTTPException(502, {
    message: "Report generation failed validation",
  });
}

export async function loadReport(
  db: D1Database,
  model: () => LanguageModel,
  judge: Judge,
  companyId: string,
  role: Role,
): Promise<Report> {
  const sources = await reportSources(db, companyId);
  const { month, evidence } = sources.explanation;
  const query = db
    .prepare(
      "SELECT body FROM reports WHERE company_id = ? AND month = ? AND role = ? AND rule_version = ?",
    )
    .bind(companyId, month, role, evidence.rule_version);
  const cached = await query.first<{ body: string }>();
  if (cached) {
    return reportSchema.parse(JSON.parse(cached.body));
  }
  const report = await narrate(model(), judge, role, sources);
  await db
    .prepare(
      "INSERT INTO reports (company_id, month, role, rule_version, body, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
    )
    .bind(
      companyId,
      month,
      role,
      evidence.rule_version,
      JSON.stringify(report),
      report.generated_at,
    )
    .run();
  const stored = await query.first<{ body: string }>();
  return stored ? reportSchema.parse(JSON.parse(stored.body)) : report;
}
