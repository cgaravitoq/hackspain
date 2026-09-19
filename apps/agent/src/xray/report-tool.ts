import { roleSchema } from "@hackspain/shared";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { loadReport } from "./report.ts";
import { type ReportBrowser, reportFilename, reportPdf } from "./report-pdf.ts";

export const reportInput = z.object({
  company: z.string().min(1).describe("Company name or Embat id"),
  role: roleSchema,
});

export const reportDescription =
  "Generate a role-aware historical treasury report and a downloadable PDF. Figures come from loaded data; this is not a credit rating, forecast or solvency certification.";

export function createReportTool(
  db: D1Database,
  model: () => LanguageModel,
  browser: ReportBrowser,
  baseUrl: string,
) {
  return async (input: z.infer<typeof reportInput>) => {
    const report = await loadReport(db, model, input.company, input.role);
    const companyId = report.company_id;
    const pdf = await reportPdf(db, browser, report);
    return {
      url: `${baseUrl}/companies/${encodeURIComponent(companyId)}/report.pdf?role=${input.role}`,
      filename: reportFilename(report),
      mimeType: "application/pdf",
      sizeBytes: pdf.byteLength,
      generatedAt: report.generated_at,
    };
  };
}

export type ReportTool = ReturnType<typeof createReportTool>;
