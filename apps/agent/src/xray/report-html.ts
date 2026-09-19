import { driverCodeSchema, type Report, ROLE_LABELS } from "@hackspain/shared";
import { Marked } from "marked";
import { companyName, type ReportSources } from "./report.ts";
import { DISCLAIMER, EMBAT_MODULES, METHODOLOGY } from "./report-policy.ts";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const markdown = new Marked({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    image({ text }) {
      return escapeHtml(text);
    },
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return EMBAT_MODULES.some((module) => module.url === href)
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${text}</a>`
        : text;
    },
  },
});

type Cell = string | number | boolean | null | undefined;

function display(value: Cell): string {
  if (value === null || value === undefined) {
    return "No disponible";
  }
  if (value === true || value === false) {
    return value ? "Sí" : "No";
  }
  return escapeHtml(String(value));
}

function table(headers: string[], rows: Cell[][]): string {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${display(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export function reportId(report: Report): string {
  return `${report.company_id} / ${report.month} / ${report.role} / ${report.rule_version}`;
}

function quantitativeAppendix(sources: ReportSources): string {
  const { explanation: e, company, changed, group, alerts } = sources;
  const drivers = driverCodeSchema.options.map((code) => {
    const driver = e.drivers.find((item) => item.code === code);
    return [
      code,
      driver?.contribution,
      driver?.value,
      driver?.unit,
      driver?.period,
      driver?.text,
    ];
  });
  const groupTable =
    group && !("error" in group)
      ? `<p>${escapeHtml(group.group_id)} · Tensión: ${display(group.tension)} · ${display(group.tension_reason)}</p>
${table(["Sociedades", "Cayendo", "Deuda total (moneda de origen)", "Cuota máxima (ratio)", "Holdout"], [[group.n_companies, group.n_falling, group.debt_outstanding, group.debt_share_top, group.holdout]])}
${table(
  [
    "Sociedad",
    "Mes",
    "Score (puntos)",
    "Nivel",
    "Momentum",
    "Estado",
    "Confianza",
    "Deuda (moneda de origen)",
    "Cuota (ratio)",
  ],
  group.members.map((member) => [
    companyName(member.company_id),
    member.month,
    member.score,
    member.level,
    member.momentum,
    member.state_label,
    member.confidence,
    member.debt_outstanding,
    member.debt_share,
  ]),
)}
<p>El contrato de grupo no informa moneda ni corte agregado; no se infiere conversión ni obligaciones solidarias. Las cuotas se muestran como ratios, no como porcentajes.</p>`
      : `<p>${group && "error" in group ? escapeHtml(group.error) : "Sin grupo informado."}</p>`;
  return `<section class="appendix"><h2>Anexo cuantitativo · ${escapeHtml(e.month)}</h2>
<p>Fuente: explain, what_changed y group_map del dataset cargado. Ausencia no equivale a cero. Las cifras no proceden del modelo.</p>
<h3>Evolución observada</h3>
${table(
  [
    "Mes",
    "Observado",
    "Score (puntos)",
    "Nivel",
    "Momentum",
    "Ajuste",
    "Estado",
    "Confianza",
  ],
  company.series.map((entry) => [
    entry.month,
    entry.observed,
    entry.score,
    entry.level,
    entry.momentum,
    entry.adjustment,
    entry.state,
    entry.confidence,
  ]),
)}
<h3>Los siete drivers</h3>
<p>Balance, comisiones, devoluciones y momentum explican aportaciones aritméticas. Entradas frente a la ventana previa, interrupción de amortización y retiradas son contexto: no se suman como nuevos términos del índice.</p>
${table(["Código", "Puntos", "Valor", "Unidad", "Periodo", "Observación"], drivers)}
<h3>Cambios mensuales</h3>
${"error" in changed ? `<p>${display(changed.error)}</p>` : table(["Mes anterior", "Mes actual", "Score anterior", "Score actual", "Delta (puntos)", "Estado desde"], [[changed.previous_month, changed.month, changed.previous_score, changed.score, changed.delta, changed.state_since]])}
${table(
  ["Mes", "Componente", "Delta (puntos)"],
  company.series.flatMap((entry) =>
    entry.changed.map((change) => [entry.month, change.code, change.delta]),
  ),
)}
<h3>Eventos y alertas</h3>
${table(
  ["Mes", "E1", "E3"],
  company.series.map((entry) => [
    entry.month,
    entry.observed ? entry.events.E1 : null,
    entry.observed ? entry.events.E3 : null,
  ]),
)}
${
  alerts.length
    ? table(
        ["Mes", "Alerta", "Estado anterior", "Estado", "Delta (puntos)"],
        alerts.map((alert) => [
          alert.month,
          alert.kind,
          alert.previous_state,
          alert.state,
          alert.delta,
        ]),
      )
    : "<p>Sin alertas cargadas para esta empresa; no garantiza ausencia de dificultades.</p>"
}
<h3>Flujos · ${escapeHtml(e.month)} · ${escapeHtml(e.evidence.currency)}</h3>
${table(["Entrada operativa", "Salida operativa", "Entrada financiera", "Salida financiera", "Amortización"], [[e.flows.inflow, e.flows.outflow, e.flows.financing_in, e.flows.financing_out, e.flows.debt_repayment]])}
<h3>Facturas · corte ${escapeHtml(e.evidence.cutoff)}</h3>
${table(["Número vencido", `Importe vencido (${e.evidence.currency})`, "Máximo días vencidos", "Cuota top-3 pendiente (ratio)"], [[e.invoice_facts.overdue_count, e.invoice_facts.overdue_amount, e.invoice_facts.oldest_overdue_days, e.invoice_facts.top3_share_of_pending]])}
<h3>Posición grupal y deuda</h3>${groupTable}
<h3>Evidencia completa</h3>
${table(
  [
    "Mes",
    "Meses observados",
    "Transacciones en ventana",
    "Sin categorizar (ratio)",
    "Ventana",
    "Corte",
    "Moneda",
    "Reglas",
  ],
  company.series.map((entry) => [
    entry.month,
    entry.evidence.months_observed,
    entry.evidence.transactions_in_window,
    entry.evidence.share_uncategorised,
    entry.evidence.window,
    entry.evidence.cutoff,
    entry.evidence.currency,
    entry.evidence.rule_version,
  ]),
)}
${table(
  ["Mes", "Transacciones", "Facturas", "Deuda"],
  company.series.map((entry) => [
    entry.month,
    entry.evidence.sources.transactions,
    entry.evidence.sources.invoices,
    entry.evidence.sources.debt,
  ]),
)}
</section>`;
}

export function renderReportHtml(
  report: Report,
  sources: ReportSources,
): string {
  const { explanation: e } = sources;
  const name = escapeHtml(companyName(report.company_id));
  const role = ROLE_LABELS[report.role];
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Indicadores históricos de tesorería · ${name}</title>
<style>
@page { size: A4; }
* { box-sizing: border-box; }
body { font-family: "Open Sans", Arial, sans-serif; color: #122c38; font-size: 10pt; line-height: 1.5; margin: 0; }
.cover { min-height: 240mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; border-top: 6px solid #087f83; padding-top: 12mm; }
.brand { color: #087f83; font-size: 18pt; font-weight: 700; letter-spacing: .08em; }
h1 { font-size: 32pt; line-height: 1.15; max-width: 150mm; }
h2 { color: #087f83; font-size: 17pt; border-bottom: 1px solid #bfdbdb; padding-bottom: 4mm; margin-top: 10mm; break-after: avoid; }
h3 { font-size: 12pt; margin-top: 8mm; break-after: avoid; }
p { orphans: 3; widows: 3; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 4mm 0 7mm; table-layout: fixed; }
thead { display: table-header-group; }
th { background: #eaf3f3; text-align: left; font-weight: 600; }
th, td { padding: 2mm; border-bottom: 1px solid #d5e2e5; overflow-wrap: anywhere; vertical-align: top; font-variant-numeric: tabular-nums; }
tr { break-inside: avoid; }
a { color: #087f83; overflow-wrap: anywhere; }
.notice { border-left: 3px solid #087f83; background: #f2f7f7; padding: 4mm; font-size: 9pt; }
.meta, .disclaimer { color: #4d6470; font-size: 8pt; }
.appendix, .methodology { break-before: page; }
.disclaimer { white-space: pre-line; border-top: 1px solid #bfdbdb; padding-top: 5mm; }
@media screen { body { max-width: 210mm; padding: 16mm; margin: auto; background: white; } html { background: #eaf0f2; } }
@media print { a { text-decoration: none; } }
</style></head><body>
<section class="cover"><div class="brand">X RAY · EMBAT</div>
<div><p>${report.role === "tesorero" ? "Confidencial · empresa y grupo propios" : "Confidencial · uso interno · no distribuir al cliente"}</p><h1>Indicadores históricos de tesorería</h1><h2>${name}</h2><p>${escapeHtml(report.company_id)} · ${display(e.group_id)} · ${role}</p><p>Periodo analizado: ${escapeHtml(report.month)}</p></div>
<div><div class="notice">Señales históricas con cobertura limitada. No es una certificación de solvencia ni una previsión. Requiere revisión humana autorizada.</div><p class="meta">Generado: ${escapeHtml(report.generated_at)}<br>Corte de datos: ${escapeHtml(e.evidence.cutoff)}<br>Reglas: ${escapeHtml(report.rule_version)}<br>Informe: ${escapeHtml(reportId(report))}</p></div></section>
<nav><h2>Índice</h2><ol><li>Resumen ejecutivo</li>${report.sections.map((section) => `<li>${escapeHtml(section.title)}</li>`).join("")}<li>Anexo cuantitativo, eventos, facturas, grupo y evidencia</li><li>Metodología, glosario y límites</li></ol></nav>
<h2>Resumen ejecutivo</h2><p>Estado: ${escapeHtml(e.state_label)} · Confianza: ${escapeHtml(e.confidence)} · Mes: ${escapeHtml(e.month)}</p>
${markdown.parse(report.summary, { async: false })}
${report.sections
  .map(
    (section) =>
      `<section><h2>${escapeHtml(section.title)}</h2>${markdown.parse(section.body, { async: false })}${
        section.figures.length
          ? table(
              ["Dato · periodo · procedencia", "Valor", "Unidad"],
              section.figures.map((figure) => [
                figure.label,
                figure.value,
                figure.unit,
              ]),
            )
          : "<p>No hay cifras disponibles para esta sección.</p>"
      }</section>`,
  )
  .join("")}
${quantitativeAppendix(sources)}
<section class="methodology"><h2>Metodología</h2><p>${escapeHtml(METHODOLOGY).replaceAll("\n", "<br>")}</p>
<p>Versión aplicada: ${escapeHtml(report.rule_version)}. Este documento no añade umbrales ni reglas de ausencia a la versión cargada. Los valores ausentes se indican como «No disponible»; no se imputan ceros. La confianza no es una probabilidad estadística.</p>
<h3>Glosario</h3>${table(
    ["Término", "Significado"],
    [
      ["Score", "Índice histórico acotado, no calificación crediticia."],
      [
        "Nivel",
        "Balance operativo de la ventana, con las penalizaciones de la versión aplicada.",
      ],
      [
        "Momentum",
        "Diferencia frente al nivel de tres meses antes; no es previsión.",
      ],
      ["Confianza", "Cobertura y calidad observadas, no probabilidad."],
      [
        "Puntos y ratios",
        "Los puntos expresan aportaciones o diferencias; un ratio no es un porcentaje. No sumar drivers contextuales.",
      ],
      [
        "E1",
        "Entradas operativas inferiores a salidas durante tres meses consecutivos.",
      ],
      [
        "E3",
        "Mes sin amortización tras seis o más con ella; no demuestra impago.",
      ],
      [
        "Vencido",
        "Factura pasada de vencimiento según la fuente; su estado requiere contraste.",
      ],
      [
        "Concentración",
        "Cuota de deuda o de facturas pendientes; no implica contagio ni obligaciones solidarias.",
      ],
    ],
  )}
<h3>Fuentes y comprobaciones autorizadas</h3><p>Datos: transacciones, facturas y deuda según la evidencia anterior. Capacidades de Embat sujetas a disponibilidad, contratación y permisos; X Ray no las ejecuta.</p>
<ul>${EMBAT_MODULES.map((module) => `<li><a href="${escapeHtml(module.url)}">${escapeHtml(module.name)}</a>: ${escapeHtml(module.use)}</li>`).join("")}</ul>
<h3>Confidencialidad y límites</h3><p>Perímetro: esta empresa y su grupo autorizado. Para entregar al cliente, generar la versión tesorero sin notas internas. No trasladar el índice al trabajador ni utilizarlo para decisiones laborales.</p><p class="disclaimer">${escapeHtml(DISCLAIMER)}</p></section>
</body></html>`;
}
