import type {
  CompanyDetail,
  Diagnosis,
  Driver,
  MonthEntry,
} from "@hackspain/shared";
import { addMonths } from "./cash-engine.ts";

type Advice = {
  hypothesis: string;
  alternative: string;
  check: string;
  action: string;
};

const ADVICE: Record<Driver["code"], Advice> = {
  balance: {
    hypothesis:
      "Podría haber menor generación de cobros o mayor presión de pagos en la ventana observada.",
    alternative:
      "También puede responder a estacionalidad, pagos extraordinarios o cambios de cuentas conectadas.",
    check:
      "Conciliar los cobros y pagos por categoría y comparar periodos con la misma cobertura.",
    action:
      "Tesorería: revisar obligaciones y preparar escenarios antes de negociar cambios; no retrasar pagos unilateralmente.",
  },
  fees: {
    hypothesis:
      "Las comisiones o intereses identificados podrían estar reduciendo el equilibrio observado.",
    alternative:
      "Un cargo puntual o una clasificación errónea puede explicar la señal sin deterioro estructural.",
    check:
      "Contrastar movimientos con contratos, tarifas y periodicidad; no equiparar toda comisión con financiación.",
    action:
      "Tesorería: revisar condiciones y errores de cargo con evidencia antes de proponer una renegociación.",
  },
  refunds: {
    hypothesis:
      "Las devoluciones de cobros podrían señalar incidencias de cobro que conviene revisar.",
    alternative:
      "Pueden ser correcciones operativas o devoluciones legítimas; no prueban impago.",
    check:
      "Enlazar cada devolución con su operación original y confirmar si sigue pendiente.",
    action:
      "Cobros: priorizar la revisión de incidencias confirmadas y evitar reclamar documentos ya liquidados.",
  },
  momentum: {
    hypothesis:
      "Las señales incluidas en el índice han empeorado respecto al periodo de comparación.",
    alternative:
      "El momentum resume otros componentes y no es una causa económica independiente.",
    check:
      "Separar cambios económicos de cambios de cobertura, política y estacionalidad.",
    action:
      "Finanzas: comprobar persistencia y revisar los componentes que explican el cambio, no sólo el score.",
  },
  inflow_vs_prev6: {
    hypothesis:
      "El cambio en entradas podría reflejar menos cobros o un desplazamiento de su calendario.",
    alternative:
      "No demuestra una caída de ventas; puede haber cobros concentrados, financiación o cobertura distinta.",
    check:
      "Contrastar facturación y cobros conciliados, separando financiación y periodos incompletos.",
    action:
      "Finanzas y cobros: identificar operaciones realmente pendientes antes de preparar medidas.",
  },
  debt_repayment_break: {
    hypothesis:
      "La ausencia de amortización observada merece comprobar el calendario de la deuda.",
    alternative:
      "Puede haber vencido el préstamo, cambiado la cuenta de cargo o existir un periodo sin cuota.",
    check:
      "Revisar calendario contractual, productos activos y conciliación; el hueco no prueba impago.",
    action:
      "Tesorería: confirmar la obligación con la documentación antes de escalar una incidencia.",
  },
  withdrawals: {
    hypothesis:
      "Las retiradas de efectivo pueden requerir una explicación adicional de su uso.",
    alternative:
      "Pueden ser operativa habitual o recategorizaciones; no prueban fraude ni desvío de fondos.",
    check:
      "Revisar justificantes, recurrencia y clasificación de los movimientos.",
    action:
      "Contabilidad: documentar el destino de las retiradas y corregir categorías si procede.",
  },
};

function stateSince(company: CompanyDetail, entry: MonthEntry): string | null {
  if (entry.score === null) {
    return null;
  }
  let since = entry.month;
  let expected = entry.month;
  const previous = company.series
    .filter((month) => month.month <= entry.month)
    .sort((a, b) => b.month.localeCompare(a.month));
  for (const month of previous) {
    if (
      !month.observed ||
      month.month !== expected ||
      month.state !== entry.state
    ) {
      break;
    }
    since = month.month;
    expected = addMonths(`${month.month}-01`, -1).slice(0, 7);
  }
  return since;
}

export function diagnose(company: CompanyDetail, entry: MonthEntry): Diagnosis {
  const insufficient = entry.score === null || entry.confidence === "none";
  const retrospective = entry.month !== company.latest.month;
  const limitations = [
    "Diagnóstico parcial de tesorería: las señales y las contribuciones al índice no prueban una causa económica.",
    "El inicio del estado observado no es la fecha demostrada del problema ni prueba de anticipación en producción.",
    "El saldo contable y las cifras agregadas no acreditan caja libre, solvencia o capacidad de pago futura.",
    "Las facturas y la deuda de extracción necesitan contraste de estado, moneda y cobertura; no reconstruyen por sí solas la historia.",
  ];
  if (retrospective) {
    limitations.unshift(
      "Se muestra un periodo anterior: el último periodo requiere revisar su cobertura antes de aplicar estas hipótesis.",
    );
  }
  if (entry.confidence === "low") {
    limitations.unshift(
      "Cobertura o categorización limitada: revisar los datos antes de concluir deterioro.",
    );
  }
  const findings: Diagnosis["findings"] = insufficient
    ? []
    : entry.drivers
        .filter(
          (driver) =>
            driver.contribution < 0 ||
            ["inflow_vs_prev6", "debt_repayment_break", "withdrawals"].includes(
              driver.code,
            ),
        )
        .slice(0, 3)
        .map((driver) => ({
          code: driver.code,
          certainty: "HYPOTHESIS",
          observed: driver.text,
          ...ADVICE[driver.code],
          evidence_ref: `${entry.evidence.rule_version}:${entry.month}:explain.drivers.${driver.code}`,
        }));
  return {
    status: insufficient
      ? "INSUFFICIENT_EVIDENCE"
      : retrospective
        ? "RETROSPECTIVE"
        : "CURRENT",
    scope: "PARTIAL_TREASURY_DIAGNOSIS",
    state_since: stateSince(company, entry),
    findings,
    next_steps:
      insufficient || retrospective
        ? [
            "Comprobar sincronización, cobertura y periodos comparables antes de emitir un diagnóstico actual.",
          ]
        : findings.length
          ? findings.map((finding) => finding.action)
          : [
              "Mantener el seguimiento mensual; no se han identificado nuevas señales de revisión en los componentes disponibles. Esto no garantiza ausencia de dificultades.",
            ],
    limitations,
  };
}
