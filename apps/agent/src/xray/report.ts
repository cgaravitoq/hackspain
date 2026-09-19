import {
  DEMO_COMPANY_NAMES,
  type Report,
  type Role,
  reportSchema,
} from "@hackspain/shared";
import { generateText, type LanguageModel, Output } from "ai";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  forbiddenWords,
  type Narrative,
  type ReportFacts,
  reportFacts,
  templateNarrative,
  validateNarrative,
} from "./report-narrative.ts";
import { reportInstructions } from "./report-policy.ts";
import { createStore } from "./store.ts";
import { createTools } from "./tools.ts";

const REPORT_FORMAT_VERSION = "xray-report/0.3";

const narrativeSchema = z.strictObject({
  headline: z.string().min(1).max(200),
  summary: z.string().min(1).max(800),
  score_explanation: z.string().min(1).max(3000),
  outlook: z.string().min(1).max(1200),
  caveat: z.string().max(600),
  next_steps: z.array(z.string().min(1).max(300)).max(2),
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

export function reportCacheVersion(
  scoreRuleVersion: string,
  trendRuleVersion: string,
): string {
  return `${scoreRuleVersion}+${trendRuleVersion}+${REPORT_FORMAT_VERSION}`;
}

async function narrate(
  model: LanguageModel,
  role: Role,
  facts: ReportFacts,
): Promise<Narrative | null> {
  let violations: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model,
        reasoning: "none",
        maxRetries: 0,
        maxOutputTokens: 6000,
        output: Output.object({ schema: narrativeSchema }),
        system: reportInstructions(role, forbiddenWords(role)),
        prompt: JSON.stringify({
          role,
          facts,
          corrections: violations.length ? violations : undefined,
        }),
      });
      violations = validateNarrative(output, role, facts);
      if (violations.length === 0) {
        return output;
      }
    } catch {
      violations = ["the previous answer was not valid JSON for the schema"];
    }
  }
  return null;
}

function assemble(
  sources: ReportSources,
  role: Role,
  narrative: Narrative,
  source: Report["source"],
): Report {
  const { explanation: e } = sources;
  return reportSchema.parse({
    schema_version: "human-v2",
    company_id: e.company_id,
    month: e.month,
    role,
    rule_version: e.evidence.rule_version,
    generated_at: new Date().toISOString(),
    score: e.score === null ? null : Math.round(e.score),
    state: e.state,
    state_label: e.state_label,
    ...narrative,
    source,
    export_url: `/api/companies/${encodeURIComponent(e.company_id)}/report.pdf?role=${role}`,
    trend_projection: sources.company.trend_projection,
  });
}

function cachedReport(body: string): Report | null {
  const parsed = reportSchema.safeParse(JSON.parse(body));
  return parsed.success ? parsed.data : null;
}

export async function loadReport(
  db: D1Database,
  model: () => LanguageModel,
  companyId: string,
  role: Role,
): Promise<Report> {
  const sources = await reportSources(db, companyId);
  const { month, evidence } = sources.explanation;
  const cacheVersion = reportCacheVersion(
    evidence.rule_version,
    sources.company.trend_projection.rule_version,
  );
  const query = db
    .prepare(
      "SELECT body FROM reports WHERE company_id = ? AND month = ? AND role = ? AND rule_version = ?",
    )
    .bind(companyId, month, role, cacheVersion);
  const cached = await query.first<{ body: string }>();
  const hit = cached ? cachedReport(cached.body) : null;
  if (hit) {
    return hit;
  }
  const facts = reportFacts(sources, companyName(companyId));
  let narrative: Narrative | null = null;
  try {
    narrative = await narrate(model(), role, facts);
  } catch {
    narrative = null;
  }
  if (!narrative) {
    return assemble(sources, role, templateNarrative(role, facts), "template");
  }
  const report = assemble(sources, role, narrative, "llm");
  await db
    .prepare(
      "INSERT INTO reports (company_id, month, role, rule_version, body, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (company_id, month, role, rule_version) DO UPDATE SET body = excluded.body, pdf = NULL, created_at = excluded.created_at",
    )
    .bind(
      companyId,
      month,
      role,
      cacheVersion,
      JSON.stringify(report),
      report.generated_at,
    )
    .run();
  return report;
}
