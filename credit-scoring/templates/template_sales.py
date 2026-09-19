from __future__ import annotations

import io
import re
from pathlib import Path

from reportlab.pdfgen.canvas import Canvas

from src.copilot import pointer_value, validate_artifacts
from templates import design_system as ds
from templates.pdf_utils import (
    format_score,
    load_company_data,
    months_to_spanish,
    persistence_to_spanish,
    trajectory_to_spanish,
)

__all__ = ["render_report", "render_sales"]

ROLE = "SALES · USO INTERNO EMBAT"
POLICY = "sales-opportunity-v1"
DISCLAIMER = (
    "Este informe se genera automáticamente a partir del motor de scoring de Embat. "
    "No constituye una evaluación crediticia."
)
HEADLINES = {
    "GREEN": "GREEN — MOMENTO FAVORABLE PARA PROPUESTA",
    "AMBER": "AMBER — MONITORIZAR ANTES DE PROPUESTA",
    "RED": "RED — NO RECOMENDADO EN ESTE MOMENTO",
}
STATUS_COLORS = {"GREEN": ds.POSITIVE, "AMBER": ds.WARNING, "RED": ds.NEGATIVE}
COMPONENT_WORDS = {
    "inflow_outflow_ratio": r"entradas|salidas|cobros|pagos",
    "chargeback_score": r"devoluci[oó]n|devoluciones",
    "fee_score": r"comisi[oó]n|comisiones",
    "debt_score": r"deuda",
}
ALERT_WORDS = {
    "DETERIORATION_CONFIRMED": r"deterioro (?:reciente )?confirmado",
    "DRIFT_DETECTED": r"largo plazo|deriva|drift",
    "LOW_COVERAGE": r"cobertura|meses completos",
    "STALE_DATA": r"desactualiz|antigüedad",
    "INSUFFICIENT_DATA": r"historial|insuficien",
    "SCORE_FLOOR": r"umbral|suelo|score bajo",
}
NUMBER_WORDS = re.compile(
    r"\d|%|\b(?:cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|"
    r"trece|catorce|quince|diecis\w+|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|"
    r"setenta|ochenta|noventa|cien|ciento|doscient\w*|trescient\w*|cuatrocient\w*|"
    r"quinient\w*|seiscient\w*|setecient\w*|ochocient\w*|novecient\w*|mil|mill[oó]n\w*|"
    r"primer\w*|segund\w*|tercer\w*|cuart[oa]s?|quint[oa]s?|sext[oa]s?|s[eé]ptim\w*|"
    r"octav\w*|noven\w*|d[eé]cim\w*|mitad|doble|triple)\b|"
    r"\b(?:un|una)\s+(?:mes|año|trimestre|semestre|punto|por ciento)\b",
    re.IGNORECASE,
)


class _LayoutError(ValueError):
    pass


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _checked_text(value):
    _require(isinstance(value, str) and bool(value.strip()), "Narrative entries must be nonempty strings.")
    ds.measure_text(value, ds.CONTENT_WIDTH)
    _require(not re.search(r"\{\{|\}\}|\b(?:TODO|TBD)\b", value), "Unresolved narrative placeholder.")
    _require(not re.search(r"media del (?:portfolio|sector)|ranking|probabilidad de impago|"
                           r"comisiones bancarias en reducci[oó]n|cobros superan pagos", value, re.IGNORECASE),
             "Narrative claim is not supported by normalized company evidence.")
    return value


def _health_state(score):
    format_score(score)
    if score is None:
        return "No calculada", ds.NEUTRAL
    if score > 65:
        return "Buena", ds.POSITIVE
    return ("Frágil", ds.NEGATIVE) if score < 45 else ("Regular", ds.WARNING)


def _recommendation_class(company):
    score, trajectory, persistence = (company.get(key) for key in ("final_score", "trajectory", "persistence"))
    format_score(score)
    _require(isinstance(company.get("alerts"), list), "An evaluated alert list is required.")
    high = [alert for alert in company["alerts"] if alert["severity"] == "HIGH"]
    if ((score is not None and score < 45)
            or (trajectory == "deteriorating" and persistence == "confirmed")
            or any(alert["alert_type"] in ("DETERIORATION_CONFIRMED", "SCORE_FLOOR") for alert in high)):
        return "RED"
    if (score is not None and score > 65 and trajectory in ("improving", "stable")
            and persistence == "confirmed" and not high):
        return "GREEN"
    return "AMBER"


def _trend_state(company):
    trajectory, persistence = company.get("trajectory"), company.get("persistence")
    subtitle = {"confirmed": "Persistencia confirmada", "unconfirmed": "Sin confirmar"}.get(
        persistence, "Confirmación no disponible")
    color = ds.NEUTRAL
    label = trajectory_to_spanish(trajectory)
    if trajectory == "improving":
        color = ds.POSITIVE if persistence == "confirmed" else ds.WARNING
        if persistence in ("confirmed", "unconfirmed"):
            label += " (confirmado)" if persistence == "confirmed" else " (sin confirmar)"
    elif trajectory == "deteriorating":
        color = ds.NEGATIVE
    return label, color, subtitle


def _projection_state(data):
    forecast, score = data["forecast"], data["company"].get("final_score")
    if forecast["forecast_status"] == "insufficient_data":
        return "Sin datos suficientes", ds.NEUTRAL, "Sin escenario calculado"
    terminal = forecast["scenarios"]["base"]["scores"][-1]
    format_score(terminal)
    format_score(score)
    confidence = "Confianza baja: cautela" if forecast["confidence"] == "low" else "Confianza media"
    subtitle = f"Al cierre: {months_to_spanish(forecast['forecast_months'][-1])}.\n{confidence}"
    if score is None:
        return "Sin referencia actual", ds.NEUTRAL, subtitle
    if terminal > score:
        return "Al alza", ds.POSITIVE, subtitle
    return ("A la baja", ds.NEGATIVE, subtitle) if terminal < score else ("Sin cambio", ds.WARNING, subtitle)


def _forecast_facts(data):
    company, forecast = data["company"], data["forecast"]
    if forecast["forecast_status"] == "insufficient_data":
        pending = "pendiente" if forecast["months_missing"] == 1 else "pendientes"
        return (f"{forecast['observed_operational_months']} meses operativos disponibles · "
                f"{forecast['min_months_required']} requeridos · {forecast['months_missing']} {pending}. "
                "Son requisitos de historial, no un plazo de espera garantizado.")
    terminal = forecast["scenarios"]["base"]["scores"][-1]
    text = (f"Actual: {format_score(company['final_score'])}/100 · "
            f"Final base ({months_to_spanish(forecast['forecast_months'][-1])}): {format_score(terminal)}/100.")
    if company["final_score"] is not None:
        text += f" Dirección al cierre: {_projection_state(data)[0].lower()}."
    return text


def _recommendation_reason(data):
    company = data["company"]
    status = _recommendation_class(company)
    score = f"Score {format_score(company['final_score'])}/100" if company["final_score"] is not None else "Score no calculado"
    if status == "RED":
        triggers = []
        if company["final_score"] is not None and company["final_score"] < 45:
            triggers.append("nivel actual bajo")
        if company.get("trajectory") == "deteriorating" and company.get("persistence") == "confirmed":
            triggers.append("deterioro confirmado")
        for alert in company["alerts"]:
            if alert["severity"] == "HIGH" and alert["alert_type"] in ("DETERIORATION_CONFIRMED", "SCORE_FLOOR"):
                triggers.append(f"alerta HIGH: {ds.ALERT_LABELS[alert['alert_type']].lower()}")
        return f"{score} con {'; '.join(triggers)}. Pendiente de mejora sostenida."
    if status == "GREEN":
        trend = "mejora" if company["trajectory"] == "improving" else "estabilidad"
        future = {
            "Al alza": "El escenario base cerraría por encima del nivel actual.",
            "A la baja": "El escenario base cerraría por debajo del nivel actual.",
            "Sin cambio": "El escenario base cerraría sin cambio frente al nivel actual.",
        }.get(_projection_state(data)[0], "La proyección no está disponible.")
        return f"{score}, {trend} confirmada y sin alertas HIGH. {future}"
    reasons = []
    if company["final_score"] is None:
        reasons.append("salud actual sin medir")
    elif company["final_score"] <= 65:
        reasons.append("salud fuera de la banda comercial buena")
    if company.get("trajectory") not in ("improving", "stable"):
        reasons.append(f"trayectoria: {trajectory_to_spanish(company.get('trajectory')).lower()}")
    if company.get("persistence") != "confirmed":
        reasons.append(f"persistencia: {persistence_to_spanish(company.get('persistence')).lower()}")
    if any(alert["severity"] == "HIGH" for alert in company["alerts"]):
        reasons.append("alerta HIGH que impide una propuesta favorable")
    return f"{score}; {'; '.join(reasons)}. Revisar al disponer de nueva información."


def _evidence(sources, operation, policy=None):
    result = {"sources": sources, "operation": operation}
    if policy:
        result["policy"] = policy
    return result


def _signal_sources(company, text, positive):
    sources = []
    for index, signal in enumerate(company["signals"]):
        if re.search(COMPONENT_WORDS[signal["component"]], text, re.IGNORECASE):
            _require(signal["contribution"] > 0 if positive else signal["contribution"] < 0,
                     "Signal wording conflicts with the observed contribution sign.")
            sources.extend([f"company:/signals/{index}/component", f"company:/signals/{index}/contribution"])
    if not positive:
        for index, alert in enumerate(company["alerts"]):
            pattern = ALERT_WORDS.get(alert["alert_type"])
            if pattern and re.search(pattern, text, re.IGNORECASE):
                sources.append(f"company:/alerts/{index}")
    _require(bool(sources), "Signal text must identify a supported component or active alert in Spanish.")
    return sources


def _to_report_narrative(data, narrative):
    _require(isinstance(narrative, dict), "narrative must be a mapping.")
    required = {"resumen_linea_1", "resumen_linea_2", "resumen_linea_3", "senales_positivas",
                "senales_negativas", "recomendacion_comercial"}
    _require(required <= narrative.keys(), "Missing required Sales narrative fields.")
    company = data["company"]
    summary = [_checked_text(narrative[f"resumen_linea_{index}"]) for index in (1, 2, 3)]
    recommendation = _checked_text(narrative["recomendacion_comercial"])
    match = re.match(r"^(GREEN|AMBER|RED)\b", recommendation)
    _require(match is not None, "recomendacion_comercial must start with GREEN, AMBER or RED.")
    _require(match[1] == _recommendation_class(company), "Narrative recommendation conflicts with the deterministic class.")
    reason = recommendation[match.end():].lstrip(" —–:-+.\n") or _recommendation_reason(data)
    sections = {"summary_lines": summary, "positive_signals": narrative["senales_positivas"],
                "pressure_signals": narrative["senales_negativas"], "recommendation_text": reason,
                "forecast_explanation": summary[2]}
    forecast_sources = ["forecast:/forecast_status", "forecast:/confidence", "forecast:/observed_operational_months",
                        "forecast:/min_months_required", "forecast:/months_missing"]
    if data["forecast"]["forecast_status"] != "insufficient_data":
        last = len(data["forecast"]["forecast_months"]) - 1
        forecast_sources += ["company:/final_score", f"forecast:/scenarios/base/scores/{last}",
                             f"forecast:/forecast_months/{last}"]
    evidence = {
        "sections.summary_lines[0]": _evidence(["company:/final_score"], "Apply the strict commercial health bands.", POLICY),
        "sections.summary_lines[1]": _evidence(["company:/trajectory", "company:/persistence", "company:/alerts"],
                                               "Describe observed direction and confirmation; retain active alerts."),
        "sections.summary_lines[2]": _evidence(forecast_sources, "Terminal base score minus current final_score; otherwise report unavailable history."),
        "sections.forecast_explanation": _evidence(forecast_sources, "Describe the conditional terminal direction, not the intermediate peak."),
        "sections.recommendation_text": _evidence(
            ["company:/final_score", "company:/trajectory", "company:/persistence", "company:/alerts"] + forecast_sources,
            "Apply RED precedence, then GREEN eligibility, otherwise AMBER; disclose the terminal base direction.", POLICY),
    }
    for key in ("positive_signals", "pressure_signals"):
        _require(isinstance(sections[key], list), f"{key} must be a list.")
        for index, item in enumerate(sections[key]):
            _checked_text(item)
            evidence[f"sections.{key}[{index}]"] = _evidence(
                _signal_sources(company, item, key == "positive_signals"),
                "Interpret the supplied component contribution sign or stored active alert; no raw-cash inference.")
    return {"company_id": company["company_id"], "role": "sales", "sections": sections, "evidence": evidence}


def _reference_indices(sources, collection):
    return {int(match[1]) for source in sources
            if (match := re.match(rf"company:/{collection}/(0|[1-9][0-9]*)(?:/|$)", source))}


def _validate_forecast_text(data, text):
    pattern = {
        "Al alza": r"por encima|al alza|superior|subir|subida|mejora|aument",
        "A la baja": r"por debajo|a la baja|inferior|descen|caer|caída|bajar|bajada",
        "Sin cambio": r"sin cambio|mismo nivel|igual al|igualaría",
        "Sin datos suficientes": r"no hay|insuficiente|no se dispone|no disponible|sin (?:datos|historial|proyecci)",
        "Sin referencia actual": r"sin referencia|no calculad|no disponible",
    }[_projection_state(data)[0]]
    _require(re.search(pattern, text, re.IGNORECASE) is not None,
             "Forecast narrative must disclose the actual terminal direction or unavailable data.")


def _validate_narrative(data, narrative):
    _require(isinstance(narrative, dict), "Narrative must be a mapping.")
    _require(narrative.get("company_id") == data["company"]["company_id"] and narrative.get("role") == "sales",
             "Narrative company identity or role does not match the report.")
    sections, evidence = narrative.get("sections"), narrative.get("evidence")
    _require(isinstance(sections, dict) and isinstance(evidence, dict), "Narrative requires sections and evidence mappings.")
    _require(isinstance(sections.get("summary_lines"), list) and len(sections["summary_lines"]) == 3,
             "summary_lines must contain exactly three entries.")
    leaves = []
    for key in ("summary_lines", "positive_signals", "pressure_signals"):
        _require(isinstance(sections.get(key), list), f"{key} must be a list.")
        leaves.extend((f"sections.{key}[{index}]", text) for index, text in enumerate(sections[key]))
    leaves.extend((f"sections.{key}", sections.get(key)) for key in ("recommendation_text", "forecast_explanation"))
    for path, text in leaves:
        _checked_text(text)
        positive_forecast = re.search(
            r"\b(?:con|la|el)\s+(?:(?:una|un)\s+)?(?:proyección|escenario base)\s+"
            r"(?:(?:es|sería|será)\s+)?(?:positiva|positivo|al alza|favorable)\b", text, re.IGNORECASE)
        _require(not positive_forecast or _projection_state(data)[0] == "Al alza",
                 "A positive forecast claim contradicts the terminal base direction or unavailable data.")
        record = evidence.get(path)
        _require(isinstance(record, dict) and isinstance(record.get("sources"), list) and bool(record["sources"]),
                 f"Missing evidence sources for {path}.")
        _require(isinstance(record.get("operation"), str) and bool(record["operation"].strip()),
                 f"Missing evidence operation for {path}.")
        for source in record["sources"]:
            _require(isinstance(source, str), "Evidence pointers must be strings.")
            artifact, _, pointer = source.partition(":")
            _require(artifact in ("company", "forecast"), "Unknown evidence artifact.")
            pointer_value(data[artifact], pointer)
        if path.startswith("sections.summary_lines["):
            _require(NUMBER_WORDS.search(text) is None and not any(char.isnumeric() for char in text),
                     "Summary lines must not contain numbers or numeric words.")
        if path.startswith(("sections.positive_signals[", "sections.pressure_signals[")):
            positive = path.startswith("sections.positive_signals[")
            indices = _reference_indices(record["sources"], "signals")
            alerts = _reference_indices(record["sources"], "alerts")
            _require(bool(indices) if positive else bool(indices or alerts), f"No signal or alert evidence for {path}.")
            _require(all(data["company"]["signals"][index]["contribution"] > 0 if positive
                         else data["company"]["signals"][index]["contribution"] < 0 for index in indices),
                     "Signal evidence has the wrong contribution sign.")
    for path in ("sections.summary_lines[0]", "sections.recommendation_text"):
        _require(isinstance(evidence[path].get("policy"), str) and bool(evidence[path]["policy"].strip()),
                 f"Commercial classifications need an explicit display policy at {path}.")
    for text in (sections["summary_lines"][2], sections["forecast_explanation"]):
        _validate_forecast_text(data, text)
    match = re.match(r"^(GREEN|AMBER|RED)\b", sections["recommendation_text"])
    if match:
        _require(match[1] == _recommendation_class(data["company"]), "Narrative recommendation conflicts with the deterministic class.")
    return sections


def _alert_explanation(company, alert):
    kind, severity = alert["alert_type"], alert["severity"]
    text = {
        "DETERIORATION_CONFIRMED": "Deterioro reciente confirmado en los datos observados.",
        "DRIFT_DETECTED": "Deterioro a largo plazo pese a la mejora o estabilidad reciente.",
        "LOW_COVERAGE": (f"Cobertura limitada: {company['confidence']['months_complete']} de "
                         f"{company['confidence']['months_available']} meses completos; no implica deterioro."),
        "STALE_DATA": f"Datos desactualizados; último mes observado: {company['latest_observed_month']}.",
        "INSUFFICIENT_DATA": "Historial insuficiente para determinar la trayectoria; no implica deterioro.",
        "SCORE_FLOOR": "El score observado está por debajo del umbral de atención de la alerta.",
    }.get(kind, f"Alerta {kind}: revisar su evidencia antes de una propuesta.")
    return f"{severity} · {text}"


def _signal_items(data, narrative, positive):
    company = data["company"]
    key = "positive_signals" if positive else "pressure_signals"
    items = list(narrative["sections"][key])
    sources = [source for index in range(len(items))
               for source in narrative["evidence"][f"sections.{key}[{index}]"]["sources"]]
    covered = _reference_indices(sources, "signals")
    for index, signal in enumerate(company["signals"]):
        selected = signal["contribution"] > 0 if positive else signal["contribution"] < 0
        if selected and index not in covered:
            label = ds.COMPONENT_LABELS[signal["component"]].lower()
            direction = "positiva" if positive else "negativa"
            items.append(f"El índice normalizado de {label} tiene una contribución {direction} a la trayectoria.")
    if not positive:
        covered_alerts = _reference_indices(sources, "alerts")
        items += [_alert_explanation(company, alert) for index, alert in enumerate(company["alerts"])
                  if index not in covered_alerts]
    return items or ["No se han identificado señales positivas." if positive
                     else "No se han identificado señales bajo presión."]


def _space(top, height):
    if top - height < ds.CONTENT_BOTTOM:
        raise _LayoutError("Sales content does not fit two pages without overflow; shorten the supplied narrative.")
    return top - height


def _text(canvas, x, top, width, text, style="Body", color=None):
    height = ds.measure_text(text, width, style)
    bottom = _space(top, height)
    ds.draw_text(canvas, x, bottom, width, text, style, color=color)
    return bottom


def _section(canvas, top, title):
    bottom = _space(top, ds.SECTION_HEADER_HEIGHT)
    ds.draw_section_header(canvas, ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, title)
    return bottom - 8


def _page_one(canvas, data, narrative, report_date):
    company, sections = data["company"], narrative["sections"]
    x, width, top = ds.MARGIN_LEFT, ds.CONTENT_WIDTH, ds.CONTENT_TOP
    ds.draw_header(canvas, company["company_id"], "Ficha comercial", ROLE, report_date)
    ds.draw_score_gauge(canvas, x, top - ds.GAUGE_HEIGHT, company["final_score"], "Salud de tesorería")
    trend, trend_color, trend_note = _trend_state(company)
    badge_x, badge_width = x + 234, width - 234
    ds.draw_kpi_box(canvas, badge_x, top - 72, badge_width, 72, "Trayectoria observada",
                    trajectory_to_spanish(company.get("trajectory")), None, trend_color)
    confirmed = company.get("persistence") == "confirmed"
    ds.draw_kpi_box(canvas, badge_x, top - 148, badge_width, 64, "Persistencia observada",
                    persistence_to_spanish(company.get("persistence")), None, ds.POSITIVE if confirmed else ds.NEUTRAL)
    top -= 164
    top = _section(canvas, top, "Semáforo de oportunidad")
    health, health_color = _health_state(company["final_score"])
    projection, projection_color, projection_note = _projection_state(data)
    states = [("Salud actual", health, health_color, "Bandas de presentación comercial."),
              ("Tendencia", trend, trend_color, trend_note),
              ("Proyección", projection, projection_color, projection_note)]
    card_height = 94
    bottom = _space(top, card_height)
    caption_bottom = bottom
    for index, (label, value, color, note) in enumerate(states):
        left = x + index * (ds.KPI_COLUMN_WIDTH + ds.COLUMN_GUTTER)
        ds.draw_kpi_box(canvas, left, bottom, ds.KPI_COLUMN_WIDTH, card_height, label, value, None, color)
        caption_bottom = min(caption_bottom, _text(canvas, left, bottom - 6, ds.KPI_COLUMN_WIDTH, note, "Small"))
    top = _section(canvas, caption_bottom - 14, "Resumen en 3 líneas")
    for label, sentence in zip(("Salud actual", "Tendencia", "Proyección"), sections["summary_lines"], strict=True):
        _text(canvas, x, top - 1, 82, label, "Label")
        top = _text(canvas, x + 96, top, width - 96, sentence) - 12
    top = _section(canvas, top - 2, "Alertas relevantes para Sales")
    top = _text(canvas, x, top, width, "Puntos de atención antes de una propuesta comercial") - 10
    high = [alert for alert in company["alerts"] if alert["severity"] == "HIGH"]
    if not high:
        top = _text(canvas, x, top, width, "Sin alertas de riesgo para propuesta comercial") - 8
    for alert in high:
        explanation = _alert_explanation(company, alert)
        height = max(ds.BADGE_HEIGHT, ds.measure_text(explanation, width - ds.BADGE_WIDTH - 16))
        bottom = _space(top, height)
        ds.draw_alert_badge(canvas, x, top - ds.BADGE_HEIGHT, alert["alert_type"], alert["severity"])
        _text(canvas, x + ds.BADGE_WIDTH + 16, top - 3, width - ds.BADGE_WIDTH - 16, explanation)
        top = bottom - 10
    _text(canvas, x, top, width,
          "Esta sección filtra solo alertas HIGH. Las de menor severidad se conservan entre las señales "
          "bajo presión. No es una garantía de ausencia de riesgo.", "Small")
    ds.draw_footer(canvas, 1, 2)
    canvas.showPage()


def _signal_column(canvas, x, top, heading, items, color, style):
    top = _text(canvas, x, top, ds.COLUMN_WIDTH, heading, "H3") - 8
    for item in items:
        canvas.saveState()
        canvas.setFillColor(ds.NEUTRAL if item.startswith("No se han identificado señales") else color)
        canvas.circle(x + 3, top - 6, 2, fill=1, stroke=0)
        canvas.restoreState()
        top = _text(canvas, x + 14, top, ds.COLUMN_WIDTH - 14, item, style) - 7
    return top


def _recommendation_box(canvas, top, data, narrative):
    x, width = ds.MARGIN_LEFT, ds.CONTENT_WIDTH
    status = _recommendation_class(data["company"])
    supplied, reason = narrative["sections"]["recommendation_text"], _recommendation_reason(data)
    title_height = ds.measure_text(HEADLINES[status], width - 58, "H3")
    text_height = ds.measure_text(supplied, width - 32)
    evidence_height = 0 if supplied == reason else ds.measure_text(reason, width - 32, "Small") + 6
    height = 24 + 10 + 8 + title_height + 10 + text_height + evidence_height
    bottom = _space(top, height)
    canvas.saveState()
    canvas.setFillColor(ds.PRIMARY)
    canvas.roundRect(x, bottom, width, height, 8, fill=1, stroke=0)
    canvas.setFillColor(STATUS_COLORS[status])
    canvas.circle(x + 23, top - 39, 6, fill=1, stroke=0)
    canvas.restoreState()
    cursor = _text(canvas, x + 16, top - 12, width - 32, "Recomendación comercial", "Label", ds.BACKGROUND) - 8
    cursor = _text(canvas, x + 42, cursor, width - 58, HEADLINES[status], "H3", ds.BACKGROUND) - 10
    cursor = _text(canvas, x + 16, cursor, width - 32, supplied, color=ds.BACKGROUND)
    if evidence_height:
        _text(canvas, x + 16, cursor - 6, width - 32, reason, "Small", ds.BACKGROUND)
    return bottom


def _support_box(canvas, top, company):
    score = format_score(company["final_score"])
    text = (f"Score: {score}/100 · Trayectoria: {trajectory_to_spanish(company.get('trajectory'))} · "
            f"Meses de datos: {company['confidence']['months_available']} · "
            f"Última actualización: {company['scoring_date']} · Versión: {company['rule_version']}")
    coverage = (f"Cobertura observada: {company['confidence']['months_complete']} de "
                f"{company['confidence']['months_available']} meses completos")
    if company.get("latest_observed_month"):
        coverage += f" · Último mes observado: {company['latest_observed_month']}"
    texts = [("Datos de soporte", "Label"), (text, "Small"), (coverage, "Small")]
    height = 20 + sum(ds.measure_text(value, ds.CONTENT_WIDTH - 24, style) for value, style in texts) + 8
    bottom = _space(top, height)
    canvas.saveState()
    canvas.setFillColor(ds.SURFACE)
    canvas.roundRect(ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, height, 6, fill=1, stroke=0)
    canvas.restoreState()
    cursor = top - 10
    for value, style in texts:
        cursor = _text(canvas, ds.MARGIN_LEFT + 12, cursor, ds.CONTENT_WIDTH - 24, value, style) - 4
    return _text(canvas, ds.MARGIN_LEFT, bottom - 8, ds.CONTENT_WIDTH, DISCLAIMER, "Small")


def _page_two(canvas, data, narrative, report_date, compact):
    company, forecast, sections = data["company"], data["forecast"], narrative["sections"]
    x, width = ds.MARGIN_LEFT, ds.CONTENT_WIDTH
    ds.draw_header(canvas, company["company_id"], "Detalle y recomendación", ROLE, report_date)
    top = _section(canvas, ds.CONTENT_TOP, "Evolución esperada del score (escenario base)")
    if forecast["forecast_status"] == "insufficient_data":
        warnings = ["Sin datos suficientes para calcular el escenario base.", _forecast_facts(data)]
        height = ds.measure_limitations_box(width, warnings)
        ds.draw_limitations_box(canvas, x, _space(top, height), width, warnings)
        top -= height + 10
    else:
        height = 160 if compact else 180
        ds.draw_forecast_chart(canvas, x, _space(top, height), width, height,
                              forecast["forecast_months"], forecast["scenarios"]["base"]["scores"], None, None)
        top = _text(canvas, x, top - height - 6, width, _forecast_facts(data), "Small") - 6
        if forecast["confidence"] == "low":
            top = _text(canvas, x, top, width, "Confianza baja: interpretar la dirección con cautela.", "Small") - 6
    top = _text(canvas, x, top, width, sections["forecast_explanation"]) - 14
    top = _section(canvas, top, "Señales clave")
    left = _signal_column(canvas, x, top, "Lo que está funcionando bien", _signal_items(data, narrative, True),
                          ds.POSITIVE, "Small" if compact else "Body")
    right = _signal_column(canvas, x + ds.COLUMN_WIDTH + ds.COLUMN_GUTTER, top, "Lo que está bajo presión",
                           _signal_items(data, narrative, False), ds.NEGATIVE, "Small" if compact else "Body")
    top = _recommendation_box(canvas, min(left, right) - 12, data, narrative) - 12
    _support_box(canvas, top, company)
    ds.draw_footer(canvas, 2, 2)
    canvas.showPage()


def _pdf_bytes(data, narrative, report_date, compact=False):
    buffer = io.BytesIO()
    canvas = Canvas(buffer, pagesize=ds.PAGE_SIZE, pageCompression=1)
    canvas.setTitle(f"Ficha comercial · {data['company']['company_id']}")
    canvas.setAuthor("Embat")
    canvas.setSubject(ROLE)
    _page_one(canvas, data, narrative, report_date)
    _page_two(canvas, data, narrative, report_date, compact)
    canvas.save()
    return buffer.getvalue()


def render_report(data, narrative, output_path, report_date=None):
    _require(isinstance(data, dict) and isinstance(data.get("company"), dict)
             and isinstance(data.get("forecast"), dict) and isinstance(data.get("source_paths"), dict),
             "data must use the shared load_company_data contract.")
    validate_artifacts(data["company"], data["forecast"])
    _validate_narrative(data, narrative)
    path = Path(output_path).absolute()
    _require(path.suffix.lower() == ".pdf" and not path.is_symlink(), "Output must be a PDF path, not a symbolic link.")
    path = path.resolve()
    _require(path.parent.is_dir(), "Output parent directory must already exist.")
    _require(str(path) not in data["source_paths"].values(), "Output must not overwrite source artifacts.")
    report_date = data["company"]["scoring_date"] if report_date is None else report_date
    try:
        content = _pdf_bytes(data, narrative, report_date)
    except _LayoutError:
        content = _pdf_bytes(data, narrative, report_date, compact=True)
    path.write_bytes(content)
    return str(path)


def render_sales(company_id, results_dir, output_path, narrative):
    data = load_company_data(company_id, results_dir)
    return render_report(data, _to_report_narrative(data, narrative), output_path)
