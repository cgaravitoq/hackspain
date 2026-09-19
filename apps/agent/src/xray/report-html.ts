import { REPORT_HEADINGS, type Report, ROLE_LABELS } from "@hackspain/shared";
import { companyName } from "./report.ts";

export const REPORT_DISCLOSURE =
  "Índice orientativo de salud de tesorería; no constituye una evaluación crediticia.";

const STATE_COLORS: Record<Report["state"], string> = {
  healthy: "#1f7a4d",
  improving: "#0f766e",
  stable: "#475569",
  slipping: "#b45309",
  falling: "#b91c1c",
  not_evaluable: "#94a3b8",
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function reportId(report: Report): string {
  return `${report.company_id} / ${report.month} / ${report.role}`;
}

function monthName(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1] ?? month} de ${year}`;
}

function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

export function renderReportHtml(report: Report): string {
  const name = escapeHtml(companyName(report.company_id));
  const headings = REPORT_HEADINGS[report.role];
  const audience =
    report.role === "tesorero"
      ? "Confidencial · empresa propia"
      : "Confidencial · uso interno Embat";
  const caveat = report.caveat.trim()
    ? `<aside class="caveat"><h2>${escapeHtml(headings.caveat)}</h2>${paragraphs(report.caveat)}</aside>`
    : "";
  const steps = report.next_steps.length
    ? `<section><h2>${escapeHtml(headings.next_steps)}</h2><ul>${report.next_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></section>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Salud de tesorería · ${name}</title>
<style>
@page { size: A4; }
* { box-sizing: border-box; }
body { font-family: "Open Sans", Arial, sans-serif; color: #122c38; font-size: 11pt; line-height: 1.55; margin: 0; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; border-top: 5px solid #087f83; padding-top: 7mm; }
.brand { color: #087f83; font-size: 9pt; font-weight: 700; letter-spacing: .12em; margin: 0 0 2mm; }
h1 { font-size: 20pt; line-height: 1.2; margin: 0; }
.meta { color: #4d6470; font-size: 9pt; margin: 2mm 0 0; }
.score { text-align: right; min-width: 32mm; }
.score strong { display: block; font-size: 30pt; line-height: 1; color: #087f83; }
.score span { color: #4d6470; font-size: 9pt; }
.headline { font-size: 14pt; font-weight: 700; margin: 8mm 0 2mm; }
.summary { margin: 0 0 6mm; }
h2 { color: #087f83; font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2.5mm; orphans: 3; widows: 3; }
ul { margin: 0; padding-left: 5mm; }
li { margin-bottom: 1.5mm; }
.caveat { margin-top: 6mm; border-left: 3px solid #087f83; background: #f2f7f7; padding: 3mm 4mm; }
.caveat h2 { margin-top: 0; }
footer { margin-top: 10mm; border-top: 1px solid #bfdbdb; padding-top: 3mm; color: #4d6470; font-size: 8pt; }
@media screen { body { max-width: 210mm; padding: 16mm; margin: auto; background: white; } html { background: #eaf0f2; } }
@media print { body { margin: 0; } a { text-decoration: none; } }
</style></head><body>
<header><div><p class="brand">X RAY · EMBAT</p><h1>${name}</h1><p class="meta">${escapeHtml(monthName(report.month))} · ${escapeHtml(ROLE_LABELS[report.role])} · ${audience}</p></div>
<div class="score"><strong style="color:${STATE_COLORS[report.state]}">${report.score === null ? "–" : String(report.score)}</strong>${report.role === "ventas" ? "" : `<span>${escapeHtml(report.state_label)}</span>`}</div></header>
<p class="headline">${escapeHtml(report.headline)}</p>
<div class="summary">${paragraphs(report.summary)}</div>
<section><h2>${escapeHtml(headings.score_explanation)}</h2>${paragraphs(report.score_explanation)}</section>
<section><h2>${escapeHtml(headings.outlook)}</h2>${paragraphs(report.outlook)}</section>
${caveat}
${steps}
<footer>${escapeHtml(REPORT_DISCLOSURE)}</footer>
</body></html>`;
}
