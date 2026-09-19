import type { Explain, State } from "@hackspain/shared";

const euroFormat = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function euro(value: number): string {
  return euroFormat.format(value);
}

export function points(value: number | null): string {
  if (value === null) {
    return "–";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("es-ES")}`;
}

export function monthLabel(month: string | null): string {
  if (!month) {
    return "sin datos";
  }
  const [year, index] = month.split("-");
  const date = new Date(Number(year), Number(index) - 1, 1);
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

const componentLabels = new Map([
  ["balance", "Cobros frente a pagos"],
  ["fees", "Comisiones e intereses"],
  ["refunds", "Devoluciones de cobros"],
  ["momentum", "Tendencia"],
  ["cap", "Tope 0-100"],
]);

export const COMPONENT_CODES: ReadonlySet<string> = new Set(
  componentLabels.keys(),
);

export function componentLabel(code: string): string {
  return componentLabels.get(code) ?? code;
}

const eventLabels = new Map([
  ["E1", "Tensión de caja: tres meses pagando más de lo que cobra"],
  ["E2", "Factura emitida vencida hace más de 90 días"],
  ["E3", "Cuota de deuda ausente tras seis meses pagándola"],
  ["E4", "Recuperación: tres meses cubriendo pagos"],
]);

export function eventLabel(code: string): string {
  return eventLabels.get(code) ?? code;
}

export const CONFIDENCE_LABELS: Record<Explain["confidence"], string> = {
  none: "sin evidencia",
  low: "evidencia baja",
  medium: "evidencia media",
  high: "evidencia alta",
};

export const STATE_COLORS: Record<State, string> = {
  healthy: "var(--healthy)",
  improving: "var(--improving)",
  stable: "var(--stable)",
  slipping: "var(--slipping)",
  falling: "var(--falling)",
  not_evaluable: "var(--muted)",
};
