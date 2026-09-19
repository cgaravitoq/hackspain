import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  type Alert,
  alertSchema,
  type Backtest,
  backtestSchema,
  type CompanyDetail,
  companyDetailSchema,
  companySummarySchema,
  type Group,
  groupSchema,
  type Meta,
  metaSchema,
} from "@hackspain/shared";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    artifacts: {
      type: "string",
      default: join(import.meta.dirname, "../../../pipeline/artifacts"),
    },
    env: { type: "string" },
    local: { type: "boolean", default: false },
  },
});

if (values.local && values.env) {
  console.error("Use --local or --env, not both");
  process.exit(1);
}

const artifacts = resolve(values.artifacts);
const target = values.local
  ? ["--local"]
  : ["--remote", ...(values.env ? ["--env", values.env] : [])];

const text = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
const num = (value: number | null) => (value === null ? "NULL" : String(value));
const flag = (value: boolean) => (value ? "1" : "0");
type Payload =
  | CompanyDetail
  | Omit<CompanyDetail, "series">
  | Alert
  | Group
  | Backtest
  | Meta;
const json = (value: Payload) => text(JSON.stringify(value));

function read<Schema extends z.ZodType>(
  name: string,
  schema: Schema,
): z.infer<Schema> {
  return schema.parse(JSON.parse(readFileSync(join(artifacts, name), "utf8")));
}

function companyRow(detail: CompanyDetail): string {
  const { series: _series, ...summary } = detail;
  return `INSERT INTO companies (company_id, group_id, scorable, month, score, state, summary, detail) VALUES (${text(detail.company_id)}, ${text(detail.group_id)}, ${flag(detail.scorable)}, ${text(detail.latest.month)}, ${num(detail.latest.score)}, ${text(detail.latest.state)}, ${json(summary)}, ${json(detail)});`;
}

const statements = [
  "BEGIN TRANSACTION;",
  "DELETE FROM companies;",
  "DELETE FROM alerts;",
  "DELETE FROM groups;",
  "DELETE FROM documents;",
];

const scored = new Set<string>();
for (const file of readdirSync(join(artifacts, "scores")).sort()) {
  const detail = read(join("scores", file), companyDetailSchema);
  scored.add(detail.company_id);
  statements.push(companyRow(detail));
}

for (const company of read("companies.json", z.array(companySummarySchema))) {
  if (!scored.has(company.company_id)) {
    statements.push(companyRow({ ...company, series: [] }));
  }
}

read("alerts.json", z.array(alertSchema)).forEach((alert, position) => {
  statements.push(
    `INSERT INTO alerts (position, company_id, group_id, kind, payload) VALUES (${position}, ${text(alert.company_id)}, ${text(alert.group_id)}, ${text(alert.kind)}, ${json(alert)});`,
  );
});

for (const group of read("groups.json", z.array(groupSchema))) {
  statements.push(
    `INSERT INTO groups (group_id, tension, payload) VALUES (${text(group.group_id)}, ${flag(group.tension)}, ${json(group)});`,
  );
}

statements.push(
  `INSERT INTO documents (name, payload) VALUES ('backtest', ${json(read("backtest.json", backtestSchema))});`,
  `INSERT INTO documents (name, payload) VALUES ('meta', ${json(read("meta.json", metaSchema))});`,
  "COMMIT;",
);

const sqlPath = join(artifacts, "xray.sql");
writeFileSync(sqlPath, statements.join("\n"));
console.log(`${statements.length} statements written to ${sqlPath}`);

for (const args of [
  ["d1", "migrations", "apply", "DB", ...target],
  ["d1", "execute", "DB", "--file", sqlPath, "-y", ...target],
]) {
  const result = spawnSync("bunx", ["wrangler", ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
