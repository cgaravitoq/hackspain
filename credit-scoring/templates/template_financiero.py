from __future__ import annotations

import io
import re
from datetime import date
from pathlib import Path

from reportlab.pdfgen.canvas import Canvas

from src.copilot import _limitation_sources, pointer_value, translate_limitation
from templates import design_system as ds
from templates.pdf_utils import (
    _validate_display_evidence,
    format_score,
    load_company_data,
    months_to_spanish,
    persistence_to_spanish,
    trajectory_to_spanish,
)

__all__ = ["TABLE_SCHEMAS", "render_financiero", "render_report"]

TABLE_SCHEMAS = {
    "components": ("Componente / media reciente", "Peso", "Contribución al score base", "Cambio reciente"),
    "adjustments": ("Componente", "Ajuste de trayectoria (pt)"),
    "coverage": ("Concepto", "Valor observado"),
    "alerts": ("Alerta / severidad", "Disparador registrado", "Umbral registrado"),
    "methods": ("Componente", "Método elegido", "MAE regresión", "MAE naive", "Ganador"),
    "training": ("Fase", "Meses", "Periodos completos (rangos sin huecos)"),
    "configuration": ("Parámetro", "Valor registrado"),
    "projection_components": ("Componente", "Desv. histórica", "Reserva reg.", "Reserva naive",
                              "Pred. base", "Esc. base", "Esc. favorable", "Esc. adverso"),
}
PARAMETER_NOTE = (
    "Estos parámetros están versionados. Un cambio en la configuración no afecta "
    "retroactivamente a scores anteriores."
)
MISSING = "No consta en el artefacto"
METHODS = {"regression": "Regresión lineal", "naive": "Naive"}
SCENARIOS = {"base": "base", "favorable": "favorable", "adverse": "adverso"}
COMPACT_LIMITATIONS = {
    "transfer category excluded (ambiguous internal/external)":
        "Transferencias excluidas: alcance interno/externo ambiguo.",
    "settlement and investment categories count as evidence but feed no component; the audit could not prove they are operational":
        "Liquidación/inversión cuentan como evidencia, sin alimentar componentes; operatividad no acreditada en auditoría.",
    "amounts are EUR product-currency only; no FX conversion and no non-EUR activity":
        "Solo moneda del producto EUR; sin conversión ni actividad no-EUR.",
    "observations span calendar gaps; windows use observed months without zero filling":
        "Huecos de calendario: ventanas de meses observados, sin rellenar ceros.",
    "component averages, base contributions and signals are exported to four decimal places; base contributions reconcile to the unrounded base within 0.001 points; comparison deltas retain calculation precision for directional thresholds":
        "Medias, contribuciones base y señales: 4 decimales; conciliación con base sin redondear: 0.001 pt; deltas con precisión de cálculo para umbrales direccionales.",
    "Method not externally validated": "Método no validado externamente.",
    "Projected scores use same weights as observed — no recalibration":
        "Proyecciones con los mismos pesos observados, sin recalibrar.",
    "Favorable/adverse scenarios based on historical std, not causal model":
        "Favorable/adverso: desviación estándar histórica, no modelo causal.",
    "Linear regression is a candidate method; only three held-out observations are used for method selection, not validation":
        "Regresión candidata: solo 3 observaciones reservadas seleccionan, no validan, el método.",
    "Outputs project normalized components, not cash balances or default probabilities":
        "Se proyectan componentes normalizados, no saldos ni probabilidades de impago.",
    "Seasonality is unsupported: no seasonal adjustment or seasonal predictor is fitted":
        "Sin ajuste ni predictor estacional estimado.",
    "Scenarios are input perturbations, not calibrated probability bounds; nonlinear engine adjustments may change their score ordering":
        "Escenarios: perturbaciones, no límites probabilísticos calibrados; ajustes no lineales pueden alterar su orden.",
    "Scoring windows use the original full observed history plus explicit target projections only; no hidden bridge months or zero filling; projected rows are not observation evidence":
        "Ventanas: historial observado original completo más objetivos explícitos; sin meses puente ni ceros; proyecciones no son evidencia observada.",
    "Component clipping to [0, 100] occurred; per-component backtest/deployment flags are in provenance.clipping":
        "Hubo recortes [0, 100]; indicadores por componente y fase en provenance.clipping.",
}


def _number(value, digits=4, signed=False):
    if value is None:
        return "—"
    return format(value, f"{'+' if signed else ''}.{digits}f")


def _count(value):
    return f"{value:,}".replace(",", ".")


def _percent(value):
    return "—" if value is None else f"{value * 100:g}%"


def _periods(months, compact=True):
    if not months:
        return "—"
    for month in months:
        months_to_spanish(month)
    if not compact:
        return ", ".join(months)
    groups = []
    start = previous = months[0]
    for month in months[1:]:
        ordinal = lambda value: int(value[:4]) * 12 + int(value[5:])
        if ordinal(month) != ordinal(previous) + 1:
            groups.append(start if start == previous else f"{start} a {previous}")
            start = month
        previous = month
    groups.append(start if start == previous else f"{start} a {previous}")
    return "; ".join(groups)


def _component_rows(data):
    signals = {item["component"]: item for item in data["company"]["signals"]}
    return [
        (f"{label}\nMedia {_number(entry['recent_average'])}", _percent(entry["weight"]),
         _number(entry["base_contribution"]), _number(signals.get(key, {}).get("change"), signed=True))
        for key, label in ds.COMPONENT_LABELS.items()
        for entry in (data["company"]["component_summary"][key],)
    ]


def _adjustment_rows(data):
    signals = {item["component"]: item for item in data["company"]["signals"]}
    return [(label, _number(signals.get(key, {}).get("contribution"), signed=True))
            for key, label in ds.COMPONENT_LABELS.items()]


def _coverage_rows(data):
    company = data["company"]
    confidence, evidence = company["confidence"], company["evidence_records"]
    return [
        ("Meses disponibles", _count(confidence["months_available"])),
        ("Meses completos", f"{_count(confidence['months_complete'])} ({_percent(confidence['coverage_pct'])})"),
        ("Transacciones incluidas", _count(evidence["count"])),
        ("Excluidas sin categoría", _count(evidence["excluded_no_category"])),
        ("Excluidas no-EUR", _count(evidence["excluded_non_eur"])),
        ("Excluidas producto desconocido", _count(evidence["excluded_unknown_product"])),
        ("Rango de fechas de la evidencia", re.sub(r"^(\d{4}-\d{2}) to (\d{4}-\d{2})$", r"\1 a \2", evidence.get("date_range") or MISSING)),
        ("Periodos comparados (reciente)", _periods(company["periods_compared"]["recent"], False)),
        ("Periodos comparados (base)", _periods(company["periods_compared"]["baseline"], False)),
    ]


def _method_rows(data):
    forecast = data["forecast"]
    if forecast["forecast_status"] == "insufficient_data":
        return [(label, "No calculado", "—", "—", "—") for label in ds.COMPONENT_LABELS.values()]
    return [(label, METHODS[forecast["method_per_component"][key]],
             _number(comparison["regression_mae"]), _number(comparison["naive_mae"]),
             "Regresión" if comparison["winner"] == "regression" else "Naive")
            for key, label in ds.COMPONENT_LABELS.items()
            for comparison in (forecast["baseline_vs_regression"][key],)]


def _projection_component_rows(data):
    forecast = data["forecast"]
    if forecast["forecast_status"] == "insufficient_data":
        return [(label, *("—" for _ in range(7))) for label in ds.COMPONENT_LABELS.values()]
    return [(label, _number(forecast["historical_std_per_component"].get(key)),
             *(_value(forecast["provenance"].get("clipping", {}).get(key, {}).get(flag))
               for flag in ("backtest_regression", "backtest_naive", "future_base", "base", "favorable", "adverse")))
            for key, label in ds.COMPONENT_LABELS.items()]


def _training_rows(data):
    forecast = data["forecast"]
    return [
        ("Ajuste final", str(forecast["months_used_for_training"]), _periods(forecast["training_periods"])),
        ("Entrenamiento de selección", str(forecast["backtest_training_months"]),
         _periods(forecast["backtest_training_periods"])),
        ("Reserva para selección", str(len(forecast["backtest_periods"])),
         _periods(forecast["backtest_periods"], False)),
    ]


def _value(value):
    if value is None:
        return MISSING
    if type(value) is bool:
        return "sí" if value else "no"
    if isinstance(value, dict):
        if set(value) == {"trajectory", "persistence"}:
            return f"{trajectory_to_spanish(value['trajectory'])}; {persistence_to_spanish(value['persistence'])}"
        return "; ".join(f"{key}: {_value(item)}" for key, item in value.items())
    if isinstance(value, list):
        return ", ".join(map(_value, value)) or "No aplicable"
    return str(value)


def _configuration_rows(data):
    company, forecast = data["company"], data["forecast"]
    provenance = forecast["provenance"]
    windows, horizons = provenance["windows"], provenance["comparison_horizons"]
    thresholds = provenance.get("thresholds", {})
    alert_versions = list(dict.fromkeys(alert.get("alert_rule_version", MISSING) for alert in company["alerts"]))
    rows = [
        ("Versiones score / forecast / alertas", " / ".join([
            company["rule_version"], forecast["forecast_rule_version"], ", ".join(alert_versions) or MISSING])),
        ("Pesos: entradas / devol. / comis. / deuda",
         " / ".join(_percent(provenance["weights"][key]) for key in ds.COMPONENT_LABELS)),
        ("Ventanas corta / media / larga", " / ".join(_value(windows.get(key)) for key in ("short", "medium", "long")) + " meses"),
        ("Horizontes primaria / deriva", f"{horizons['primary']} / {horizons['drift_detection']}; "
         + ("media no seleccionada" if "medium" not in horizons.values() else "media seleccionada")),
        ("Frecuencia / mínimo comparación / forecast", " / ".join([
            {"monthly": "mensual"}.get(provenance.get("evaluation_frequency"), _value(provenance.get("evaluation_frequency"))),
            _value(provenance.get("min_months_for_window")), str(forecast["min_months_required"]) ])),
        ("Mejora / deterioro / ajuste máx. / mes completo",
         " / ".join(_value(thresholds.get(key)) for key in ("improving", "deteriorating", "max_adjustment", "complete_month"))),
    ]
    for key, label in (("primary", "Primaria"), ("drift_detection", "Deriva")):
        usage = company["window_usage"][key]
        rows.append((f"{label}: configurada / reciente / base",
                     (f"{usage['configured_months']} / {usage['recent_months']} / {usage['baseline_months']}; "
                      f"Ventana acortada: {_value(usage['fallback_used'])}")))
    clipping = provenance.get("clipping_policy")
    rows.append(("Desviación estándar (ddof) / recorte", f"{_value(provenance.get('std_ddof'))}; " + (
        "predicciones evaluadas y finales [0, 100]" if clipping == "clip all evaluated and deployed component predictions to [0, 100]"
        else _value(clipping))))
    convention = provenance.get("window_convention")
    rows.append(("Ventanas de proyección", "Historial original + objetivos explícitos; sin puentes" if convention ==
                 "original observed rows plus explicit target projections; no bridge months" else _value(convention)))
    rows.append(("Distancia objetivo desde último mes operativo",
                 _value(provenance.get("target_gaps_from_latest_operational_month")) + " (meses)"))
    for key, value in thresholds.items():
        if key not in ("improving", "deteriorating", "max_adjustment", "complete_month"):
            rows.append((f"Umbral: {key}", _value(value)))
    return rows


def _compact_limitation(original):
    if original in COMPACT_LIMITATIONS:
        return COMPACT_LIMITATIONS[original]
    patterns = (
        (r"(\d+) transactions system-wide have no usable category",
         lambda m: f"{_count(int(m[1]))} transacciones sin categoría en todo el sistema, no en esta empresa."),
        (r"months_complete threshold set at (\d+) transactions \(not validated\)",
         lambda m: f"Mes completo: umbral {m[1]} transacciones, no validado."),
        (r"scoring cutoff (\d{4}-\d{2}-\d{2}): the trailing partial calendar month is excluded, not scored as a short month",
         lambda m: f"Corte {m[1]}: último mes parcial excluido, no puntuado como corto."),
        (r"persistence windows share the baseline (quarter|window); the two comparisons are consecutive endpoints, not independent samples",
         lambda m: "Persistencia: referencia compartida; extremos consecutivos, no muestras independientes."),
        (r"(primary|drift_detection) shortened windows: configured (\d+) observed months per side; actual recent (\d+), baseline (\d+)",
         lambda m: f"{'Primaria' if m[1] == 'primary' else 'Deriva'} acortada: {m[2]} meses observados/lado configurados; reales reciente/base {m[3]}/{m[4]}."),
        (r"Latest operational month (\d{4}-\d{2}); targets ([0-9, -]+) are (\[[0-9, ]+\]) calendar months later; intervening months are not observations",
         lambda m: f"Desde último mes operativo {m[1]}, objetivos {m[2]} a {m[3]} meses calendario; intermedios no observados."),
        (r"(inflow_outflow_ratio|chargeback_score|fee_score|debt_score): naive baseline selected because held-out MAE is no greater than regression MAE; ties select naive",
         lambda m: f"{ds.COMPONENT_LABELS[m[1]]}: MAE naive <= regresión; empate elige naive."),
    )
    for pattern, render in patterns:
        match = re.fullmatch(pattern, original)
        if match:
            return render(match)
    translated = translate_limitation(original)
    if translated is None:
        raise ValueError(f"A faithful Spanish translation is required for limitation: {original}")
    return translated


def _limitation_entries(data):
    grouped = {}
    for artifact in ("company", "forecast"):
        for pointer, original in _limitation_sources(data[artifact]):
            prefix = re.fullmatch(r"(base|favorable|adverse) (\d{4}-\d{2}): (.+)", original)
            body = prefix[3] if prefix else original
            entry = grouped.setdefault(body, {"sources": [], "affected": {}})
            entry["sources"].append(f"{artifact}:{pointer}")
            detail = re.fullmatch(r"/scenarios/(base|favorable|adverse)/score_details/(\d+)/limitations/\d+", pointer)
            if prefix or detail:
                scenario = prefix[1] if prefix else detail[1]
                month = prefix[2] if prefix else data["forecast"]["forecast_months"][int(detail[2])]
                entry["affected"].setdefault(scenario, set()).add(month)
    entries, shortened = [], {}
    for original, entry in grouped.items():
        match = re.fullmatch(r"(primary|drift_detection) shortened windows: configured (\d+) observed months per side; actual recent (\d+), baseline (\d+)", original)
        if match:
            shortened.setdefault((match[1], match[2]), []).append((match[3], match[4], entry))
            continue
        text = _compact_limitation(original)
        if entry["affected"]:
            text += " Escenarios: " + _affected_text(entry["affected"]) + "."
        entries.append((text, entry["sources"]))
    for (horizon, configured), records in shortened.items():
        scopes, sources = [], []
        for recent, baseline, entry in records:
            if any(source.startswith("company:") for source in entry["sources"]) or not entry["affected"]:
                scopes.append(f"observada {recent}/{baseline}")
            if entry["affected"]:
                scopes.append(f"{_affected_text(entry['affected'])}: {recent}/{baseline}")
            sources.extend(entry["sources"])
        label = "Primaria" if horizon == "primary" else "Deriva"
        entries.append((f"{label} acortada: configurada {configured} meses observados/lado; reales reciente/base: "
                        + "; ".join(scopes) + ".", sources))
    return entries


def _affected_text(affected):
    identical = {}
    for scenario, months in affected.items():
        identical.setdefault(tuple(sorted(months)), []).append(SCENARIOS[scenario])
    return "; ".join(f"{', '.join(names)} ({', '.join(months)})" for months, names in identical.items())


def _forecast_reason(forecast):
    expected = (f"{forecast['observed_operational_months']} observed EUR operational months; "
                f"{forecast['min_months_required']} required; {forecast['months_missing']} months missing")
    if forecast["reason"] != expected:
        raise ValueError("Forecast reason needs an explicit faithful Spanish translation.")
    return (f"{forecast['observed_operational_months']} meses operativos EUR observados; "
            f"{forecast['min_months_required']} requeridos. Faltan {forecast['months_missing']} meses.")


def _confidence_text(forecast):
    label = {"medium": "media", "low": "baja", None: "no calculada"}[forecast["confidence"]]
    return (f"Confianza de la predicción: {label}. {_forecast_reason(forecast)} "
            f"Ajuste final: {forecast['months_used_for_training']} meses.")


def _prepare_narrative(data, narrative):
    fields = ("interpretacion_componentes", "interpretacion_forecast", "nota_limitaciones")
    if not isinstance(narrative, dict) or any(not isinstance(narrative.get(key), str) or not narrative[key].strip() for key in fields):
        raise ValueError("Narrative requires three nonempty Spanish strings: " + ", ".join(fields))
    sections = {
        "score_explanation": narrative["interpretacion_componentes"],
        "method_explanation": narrative["interpretacion_forecast"],
        "forecast_confidence_explanation": "La cobertura observada no mide confianza predictiva.",
        "limitations": [],
        "parameter_note": PARAMETER_NOTE,
    }
    sources = {
        "score_explanation": ["company:/base_score", "company:/final_score", "company:/trajectory_adjustment",
                              "company:/component_summary", "company:/signals", "company:/persistence"],
        "method_explanation": ["forecast:/forecast_status", "forecast:/method_per_component",
                               "forecast:/baseline_vs_regression", "forecast:/backtest_periods"],
        "forecast_confidence_explanation": ["forecast:/forecast_status", "forecast:/confidence",
                                            "forecast:/observed_operational_months", "company:/confidence"],
        "parameter_note": ["company:/rule_version", "forecast:/forecast_rule_version", "forecast:/provenance"],
    }
    evidence = {f"sections.{key}": {"sources": pointers, "operation": "Supplied Spanish narrative; source context, not automated factual certification"}
                for key, pointers in sources.items()}
    entries = _limitation_entries(data)
    entries.append((narrative["nota_limitaciones"], ["company:/evidence_records", "company:/confidence"]))
    missing = [label for label, value in _configuration_rows(data) if MISSING in value]
    if missing:
        entries.append((f"{MISSING}: {'; '.join(missing)}.", ["forecast:/provenance", "company:/alerts"]))
    for index, (text, pointers) in enumerate(entries):
        sections["limitations"].append(text)
        evidence[f"sections.limitations[{index}]"] = {
            "sources": pointers,
            "operation": "Spanish translation / exact deduplication / lossless grouping with every scenario and month",
        }
    evidence.update(_display_evidence(data))
    return {"company_id": data["company"]["company_id"], "role": "financiero", "sections": sections, "evidence": evidence}


def _display_evidence(data):
    company = data["company"]
    signal_indices = {item["component"]: index for index, item in enumerate(company["signals"])}
    evidence = {}
    for row, key in enumerate(ds.COMPONENT_LABELS):
        prefix = f"company:/component_summary/{key}"
        sources = [f"{prefix}/{field}" for field in ("weight", "recent_average", "base_contribution")]
        if key in signal_indices:
            sources.extend(f"company:/signals/{signal_indices[key]}/{field}" for field in ("component", "change"))
        evidence[f"tables.components[{row}]"] = {
            "sources": sources, "operation": "Weight × 100 for percent; copy base attribution; join change by component key; signed vector arrow",
        }
        evidence[f"tables.adjustments[{row}]"] = {
            "sources": [f"company:/signals/{signal_indices[key]}/{field}" for field in ("component", "contribution")]
            if key in signal_indices else ["company:/signals", "company:/trajectory"],
            "operation": "Copy trajectory attribution, not base attribution; unavailable remains absent",
        }
    for name, sources, operation in (
        ("coverage", ["company:/confidence", "company:/evidence_records", "company:/periods_compared"],
         "Exact observed counts; Spanish thousands separators; coverage fraction × 100; list every compared month"),
        ("alerts", ["company:/alerts"], "Copy each active type, severity, trigger and threshold; no inferred rules"),
        ("methods", ["forecast:/method_per_component", "forecast:/baseline_vs_regression", "forecast:/forecast_status"],
         "Copy recorded method and winner; compare MAEs at full precision before four-decimal display; null is not zero"),
        ("training", ["forecast:/" + key for key in ("months_used_for_training", "backtest_training_months",
          "training_periods", "backtest_training_periods", "backtest_periods")],
         "Copy training counts; count held-out periods; compress only consecutive calendar runs"),
        ("configuration", ["company:/rule_version", "company:/alerts", "company:/window_usage",
          "forecast:/forecast_rule_version", "forecast:/min_months_required", "forecast:/provenance"],
         "Copy persisted configuration and actual window usage; absent parameters explicitly unavailable; never current YAML"),
        ("projection_components", ["forecast:/historical_std_per_component", "forecast:/provenance", "forecast:/forecast_status"],
         "Historical standard deviation to four decimals; copy every clipping flag, without treating false as missing"),
    ):
        evidence[f"tables.{name}"] = {"sources": sources, "operation": operation}
    evidence["chart.scenarios"] = {
        "sources": ["forecast:/forecast_months", "forecast:/scenarios", "forecast:/forecast_status"],
        "operation": "Copy original scenario arrays on a 0–100 scale without sorting or changing crossings",
        "policy": "Conditional scenario band, not a confidence interval",
    }
    evidence["score.reconciliation"] = {
        "sources": ["company:/component_summary", "company:/base_score", "company:/trajectory_adjustment", "company:/final_score"],
        "operation": "Sum base_contribution; compare to one-decimal exported base within 0.051 points; base + applied adjustment is final within exported rounding tolerance",
    }
    return evidence


def _validate_narrative(data, narrative):
    if not isinstance(narrative, dict) or narrative.get("company_id") != data["company"]["company_id"] or narrative.get("role") != "financiero":
        raise ValueError("Narrative company_id and role must match the financial report.")
    sections, evidence = narrative.get("sections"), narrative.get("evidence")
    if not isinstance(sections, dict) or not isinstance(evidence, dict):
        raise TypeError("Narrative sections and evidence must be objects.")
    names = ("score_explanation", "method_explanation", "forecast_confidence_explanation", "parameter_note")
    texts = {f"sections.{key}": sections.get(key) for key in names}
    if not isinstance(sections.get("limitations"), list) or not sections["limitations"]:
        raise ValueError("A complete limitations list is required.")
    texts.update({f"sections.limitations[{index}]": text for index, text in enumerate(sections["limitations"])})
    covered = set()
    for key, text in texts.items():
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"Missing or invalid narrative section {key}.")
        ds.measure_text(text, ds.CONTENT_WIDTH, "Small")
        if key not in evidence:
            raise ValueError(f"Missing evidence mapping for {key}.")
    for key, entry in evidence.items():
        if (not isinstance(key, str) or not isinstance(entry, dict)
                or not isinstance(entry.get("operation"), str) or not entry["operation"].strip()
                or not isinstance(entry.get("sources"), list) or not entry["sources"]):
            raise ValueError(f"Invalid evidence mapping for {key}.")
        for source in entry["sources"]:
            if not isinstance(source, str) or not re.match(r"^(company|forecast):/", source):
                raise ValueError(f"Invalid narrative evidence pointer for {key}.")
            artifact, pointer = source.split(":", 1)
            pointer_value(data[artifact], pointer)
            if key in texts and key.startswith("sections.limitations["):
                covered.add(source)
    expected = {f"{artifact}:{pointer}" for artifact in ("company", "forecast")
                for pointer, _ in _limitation_sources(data[artifact])}
    if not expected.issubset(covered):
        raise ValueError(f"Incomplete limitation evidence coverage: {sorted(expected - covered)}")
    if sections["parameter_note"] != PARAMETER_NOTE:
        raise ValueError("parameter_note must preserve the exact versioning statement.")
    return sections


def _fit(bottom, label):
    if bottom < ds.CONTENT_BOTTOM:
        raise ValueError(f"Layout overflow: {label} does not fit in two A4 pages at 8 pt (bottom {bottom:g}, minimum 60).")
    return bottom


def _text(canvas, x, top, width, text, style="Small", warning=False):
    inset = 4 if warning else 0
    height = ds.measure_text(text, width - 2 * inset, style)
    bottom = _fit(top - height - 2 * inset, "text")
    if warning:
        canvas.saveState()
        canvas.setFillColor(ds.WARNING)
        canvas.setFillAlpha(0.12)
        canvas.rect(x, bottom, width, height + 2 * inset, fill=1, stroke=0)
        canvas.restoreState()
    ds.draw_text(canvas, x + inset, bottom + inset, width - 2 * inset, text, style, color=ds.TEXT_PRIMARY)
    return bottom


def _heading(canvas, x, top, width, text):
    bottom = _fit(top - ds.SECTION_HEADER_HEIGHT, text)
    ds.draw_section_header(canvas, x, bottom, width, text)
    return bottom - 4


def _table(canvas, x, top, widths, headers, rows, changes=None):
    rows = [headers, *rows]
    for index, row in enumerate(rows):
        cells = []
        for column, (text, width) in enumerate(zip(row, widths, strict=True)):
            arrow = 12 if changes is not None and index and column == 3 and changes[index - 1] else 0
            cells.append((str(text), width - 6 - arrow, arrow))
        height = max(ds.measure_text(text, width, "Small") for text, width, _ in cells) + 2
        bottom = _fit(top - height, "table")
        canvas.saveState()
        canvas.setFillColor(ds.SURFACE if index % 2 == 0 else ds.BACKGROUND)
        canvas.rect(x, bottom, sum(widths), height, stroke=0, fill=1)
        canvas.setStrokeColor(ds.ACCENT if index == 0 else ds.SURFACE)
        canvas.setLineWidth(0.5)
        canvas.line(x, bottom, x + sum(widths), bottom)
        cursor = x
        for column, ((text, width, arrow), cell_width) in enumerate(zip(cells, widths, strict=True)):
            measured = ds.measure_text(text, width, "Small")
            ds.draw_text(canvas, cursor + 3 + arrow, top - 2 - measured, width, text, "Small", color=ds.PRIMARY if index == 0 else ds.TEXT_PRIMARY)
            if arrow:
                canvas.setFillColor(ds.POSITIVE if changes[index - 1] > 0 else ds.NEGATIVE)
                ds._arrow(canvas, cursor + 6, top - 13, changes[index - 1])
            cursor += cell_width
        canvas.restoreState()
        top = bottom
    return top


def _page_one(canvas, data, sections, report_date):
    company = data["company"]
    x, width, column = ds.MARGIN_LEFT, ds.CONTENT_WIDTH, ds.COLUMN_WIDTH
    right = x + column + ds.COLUMN_GUTTER
    ds.draw_header(canvas, company["company_id"], "Scoring detallado", "FINANCIERO / ANALISTA", report_date)
    top = _heading(canvas, x, ds.CONTENT_TOP, width, "Desglose del índice de tesorería")
    ds.draw_score_gauge(canvas, x + (column - ds.GAUGE_WIDTH) / 2, top - ds.GAUGE_HEIGHT, company["final_score"], "Salud de tesorería / 100")
    left_bottom = _text(canvas, x, top - ds.GAUGE_HEIGHT - 4, column,
        f"Puntuación base: {format_score(company['base_score'])}\n"
        f"Ajuste por trayectoria: {_number(company['trajectory_adjustment'], 1, True)} ({persistence_to_spanish(company['persistence'])})\n"
        f"Score final: {format_score(company['final_score'])}\nVersión de reglas: {company['rule_version']}\n"
        f"Trayectoria primaria: {trajectory_to_spanish(company['trajectory'])}")
    signals = {item["component"]: item for item in company["signals"]}
    changes = [signals.get(key, {}).get("change") for key in ds.COMPONENT_LABELS]
    right_bottom = _table(canvas, right, top, (88, 31, 60, 62.5),
        ("Componente / media", "Peso", "Contribución al score base", "Cambio reciente"), _component_rows(data), changes)
    right_bottom = _text(canvas, right, right_bottom - 4, column, "Atribución separada del ajuste", "Small")
    right_bottom = _table(canvas, right, right_bottom - 2, (139, 102.5), TABLE_SCHEMAS["adjustments"], _adjustment_rows(data))
    top = _text(canvas, x, min(left_bottom, right_bottom) - 6, width, sections["score_explanation"])
    maximum = data["forecast"]["provenance"].get("thresholds", {}).get("max_adjustment")
    total = None if company["base_score"] is None else sum(entry["base_contribution"] for entry in company["component_summary"].values())
    top = _text(canvas, x, top - 4, width,
        f"Base = suma de peso × media reciente: {_number(total)}; base publicada a 1 decimal (tolerancia 0.051 pt). "
        f"Ajuste solo con trayectoria confirmada, límite ±{_value(maximum)} pt y score final recortado a [0, 100]; "
        "el ajuste exportado ya refleja ese recorte. Cambios: puntos normalizados, no tasas ni EUR. "
        "Índice no validado como rating crediticio ni probabilidad de impago.")
    top = _heading(canvas, x, top - 8, width, "Cobertura y calidad de datos")
    confidence = company["confidence"]
    if confidence["coverage_pct"] is None:
        top = _text(canvas, x, top, width, "Cobertura observada: no calculada; no equivale a 0%.")
    else:
        top -= ds.CONFIDENCE_BAR_HEIGHT
        _fit(top, "coverage bar")
        ds.draw_confidence_bar(canvas, x, top, width, confidence["coverage_pct"], confidence["months_available"])
    top = _table(canvas, x, top - 4, (218, 281), TABLE_SCHEMAS["coverage"], _coverage_rows(data))
    drift = company["drift_detection"]
    usage = company["window_usage"]["drift_detection"]
    top = _text(canvas, x, top - 6, width,
        f"Deriva larga: {trajectory_to_spanish(drift['trajectory'])}; delta {_number(drift.get('delta'), 8, True)} pt. "
        f"Ventana configurada {usage['configured_months']}; reales {usage['recent_months']} / {usage['baseline_months']}. "
        f"Ventana acortada: {_value(usage['fallback_used'])}. "
        f"Reciente: {_periods(drift['periods_compared']['recent'])}; base: {_periods(drift['periods_compared']['baseline'])}.")
    if company["alerts"]:
        rows = [(f"{alert['alert_type']} / {alert['severity']}", _value(alert["trigger_value"]), _value(alert["threshold_used"]))
                for alert in company["alerts"]]
        top = _table(canvas, x, top - 4, (198, 151, 150), TABLE_SCHEMAS["alerts"], rows)
    else:
        top = _text(canvas, x, top - 4, width, "Sin alertas activas registradas; no acredita ausencia de riesgo.")
    top = _text(canvas, x, top - 4, width,
        f"Solo EUR · Scoring: {company['scoring_date']} · Corte: {company['data_cutoff']} · Último mes observado: {_value(company['latest_observed_month'])}. "
        "Recuento y rango de evidencia: ventana reportada, no todo el historial. "
        "Solo se muestran umbrales de alertas activas; no se auditan reglas no registradas.")
    top = _heading(canvas, x, top - 8, width, "Proyección: variabilidad y recortes")
    top = _table(canvas, x, top, (109, 66, 52, 52, 57, 51, 56, 56),
                 TABLE_SCHEMAS["projection_components"], _projection_component_rows(data))
    _text(canvas, x, top - 4, width,
          "Desviación histórica en puntos normalizados. Sí/no: recorte a [0, 100] registrado por fase, no calidad. "
          "Reserva: selección; pred. base: antes de escenarios. —: no calculado.")
    ds.draw_footer(canvas, 1, 2)
    canvas.showPage()


def _page_two(canvas, data, sections, report_date):
    company, forecast = data["company"], data["forecast"]
    x, width, column = ds.MARGIN_LEFT, ds.CONTENT_WIDTH, ds.COLUMN_WIDTH
    right = x + column + ds.COLUMN_GUTTER
    ds.draw_header(canvas, company["company_id"], "Predicción y validación", "FINANCIERO / ANALISTA", report_date)
    top = _heading(canvas, x, ds.CONTENT_TOP, column, "Escenarios condicionales")
    _heading(canvas, right, ds.CONTENT_TOP, column, "Validación del método")
    if forecast["forecast_status"] == "insufficient_data":
        left_bottom = _text(canvas, x, top, column, "No calculado: historial insuficiente", "Body")
        left_bottom = _text(canvas, x, left_bottom - 6, column, _forecast_reason(forecast))
        left_bottom = _text(canvas, x, left_bottom - 6, column, "Sin escenarios ni MAE; no se sustituyen por ceros.")
    else:
        left_bottom = top - 160
        scenarios = forecast["scenarios"]
        ds.draw_forecast_chart(canvas, x, left_bottom, column, 160, forecast["forecast_months"],
                               scenarios["base"]["scores"], scenarios["favorable"]["scores"], scenarios["adverse"]["scores"])
    rows = [tuple(cell.replace("Regresión lineal", "Regresión").replace("Regresión", "Reg.") if index in (1, 4) else cell
                  for index, cell in enumerate(row)) for row in _method_rows(data)]
    right_bottom = _table(canvas, right, top, (67, 42, 45, 45, 42.5),
                          ("Componente", "Método elegido", "MAE reg.", "MAE naive", "Ganador"), rows)
    training = [(label, row[1], row[2]) for label, row in zip(
        ("Ajuste final", "Entr. selección", "Reserva"), _training_rows(data), strict=True)]
    right_bottom = _table(canvas, right, right_bottom - 4, (66, 33, 142.5),
                          ("Fase", "Meses", "Periodos sin huecos"), training)
    top = _text(canvas, x, min(left_bottom, right_bottom) - 4, width, sections["method_explanation"])
    top = _text(canvas, x, top - 2, width,
        "Reg.: regresión lineal. Naive: media constante de las últimas tres observaciones de entrenamiento. "
        "MAE en puntos normalizados; menor MAE gana y los empates eligen naive, antes de redondear.")
    confidence = _confidence_text(forecast) + " " + sections["forecast_confidence_explanation"]
    top = _text(canvas, x, top - 4, width, confidence, warning=forecast["confidence"] == "low")
    top = _text(canvas, x, top - 6, width, "Parámetros de configuración usados", "H3") - 4
    top = _table(canvas, x, top, (202, 297), TABLE_SCHEMAS["configuration"], _configuration_rows(data))
    top = _text(canvas, x, top - 4, width, sections["parameter_note"] + " Regenerar explícitamente crea un resultado nuevo.")
    limitations = [" ".join(sections["limitations"])]
    height = ds.measure_limitations_box(width, limitations)
    bottom = _fit(top - 6 - height, "complete limitations")
    ds.draw_limitations_box(canvas, x, bottom, width, limitations)
    ds.draw_footer(canvas, 2, 2)
    canvas.showPage()


def render_report(data, narrative, output_path, report_date=None):
    if not isinstance(data, dict) or not isinstance(data.get("company"), dict) or not isinstance(data.get("forecast"), dict):
        raise TypeError("Expected the shared loader's company/forecast mapping.")
    _validate_display_evidence(data["company"], data["forecast"])
    sections = _validate_narrative(data, narrative)
    report_date = data["company"]["scoring_date"] if report_date is None else report_date
    if not isinstance(report_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", report_date):
        raise ValueError("report_date must use YYYY-MM-DD.")
    date.fromisoformat(report_date)
    output = Path(output_path)
    if output.suffix.lower() != ".pdf" or output.is_symlink():
        raise ValueError("Output must be a PDF path, not a symbolic link.")
    output = output.resolve()
    if not output.parent.is_dir():
        raise ValueError("Output parent directory must already exist.")
    buffer = io.BytesIO()
    canvas = Canvas(buffer, pagesize=ds.PAGE_SIZE, pageCompression=0, invariant=1)
    canvas.setTitle(f"{data['company']['company_id']} · Financiero / Analista")
    canvas.setAuthor("Embat")
    _page_one(canvas, data, sections, report_date)
    _page_two(canvas, data, sections, report_date)
    canvas.save()
    output.write_bytes(buffer.getvalue())
    return str(output)


def render_financiero(company_id, results_dir, output_path, narrative):
    data = load_company_data(company_id, results_dir)
    return render_report(data, _prepare_narrative(data, narrative), output_path)
