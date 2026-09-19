import type { Report } from "@hackspain/shared";
import { HTTPException } from "hono/http-exception";
import { companyName, reportCacheVersion } from "./report.ts";
import { escapeHtml, renderReportHtml, reportId } from "./report-html.ts";

export type ReportBrowser = {
  quickAction: (
    action: "pdf",
    options: BrowserRunPDFOptions,
  ) => Promise<Response>;
};

export function reportFilename(report: Report): string {
  return `xray-${report.company_id}-${report.month}-${report.role}.pdf`.replaceAll(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

export async function reportPdf(
  db: D1Database,
  browser: ReportBrowser,
  report: Report,
): Promise<ArrayBuffer> {
  const key = [
    report.company_id,
    report.month,
    report.role,
    reportCacheVersion(
      report.rule_version,
      report.trend_projection.rule_version,
    ),
  ];
  const cached = await db
    .prepare(
      "SELECT pdf FROM reports WHERE company_id = ? AND month = ? AND role = ? AND rule_version = ?",
    )
    .bind(...key)
    .first<{ pdf: number[] | null }>();
  if (cached?.pdf) {
    return new Uint8Array(cached.pdf).buffer;
  }
  const options: BrowserRunPDFOptions = {
    html: renderReportHtml(report),
    rejectRequestPattern: [".*"],
    pdfOptions: {
      format: "a4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-family:Arial;font-size:8px;width:100%;padding:0 16mm;color:#4d6470">X RAY · ${escapeHtml(companyName(report.company_id))} · ${escapeHtml(report.month)}</div>`,
      footerTemplate: `<div style="font-family:Arial;font-size:8px;width:100%;padding:0 16mm;color:#4d6470;display:flex;justify-content:space-between"><span>${escapeHtml(reportId(report))} · Confidencial</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
      margin: { top: "22mm", bottom: "18mm", left: "16mm", right: "16mm" },
    },
  };
  let rendered: Response;
  try {
    rendered = await browser.quickAction("pdf", options);
  } catch {
    throw new HTTPException(502, {
      message: "PDF renderer unavailable; use report.html for printing",
    });
  }
  if (!rendered.ok) {
    throw new HTTPException(502, {
      message: "PDF renderer unavailable; use report.html for printing",
    });
  }
  const pdf = await rendered.arrayBuffer();
  if (
    !rendered.headers.get("content-type")?.startsWith("application/pdf") ||
    new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-" ||
    pdf.byteLength > 1_000_000
  ) {
    throw new HTTPException(502, {
      message: "Invalid or oversized PDF; use report.html for printing",
    });
  }
  await db
    .prepare(
      "UPDATE reports SET pdf = ? WHERE company_id = ? AND month = ? AND role = ? AND rule_version = ? AND pdf IS NULL",
    )
    .bind(pdf, ...key)
    .run();
  return pdf;
}
