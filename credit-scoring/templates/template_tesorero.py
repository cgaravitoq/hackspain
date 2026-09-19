from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from reportlab.pdfgen.canvas import Canvas

from src.copilot import pointer_value
from templates import design_system as ds
from templates import pdf_utils as pu

__all__ = ["render_report", "render_tesorero"]

_TEXT_SECTIONS = ("trend_summary", "persistence_explanation", "forecast_explanation", "adverse_summary")
_LIST_SECTIONS = ("watch_items", "limitations")
_SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INFO": 3}


def _validate_data(data):
    if not isinstance(data, Mapping) or not all(isinstance(data.get(key), Mapping) for key in (
        "company", "forecast", "source_paths",
    )):
        raise ValueError("Expected the shared load_company_data result.")
    pu._validate_display_evidence(data["company"], data["forecast"])


def _require_text(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Narrative fields must contain nonempty Spanish text.")
    ds.measure_text(text, ds.CONTENT_WIDTH)


def _validate_narrative(data, narrative):
    if not isinstance(narrative, Mapping) or narrative.get("company_id") != data["company"]["company_id"]:
        raise ValueError("Narrative company identity does not match the data.")
    if narrative.get("role") != "tesorero":
        raise ValueError("Narrative role must be tesorero.")
    sections, evidence = narrative.get("sections"), narrative.get("evidence")
    if not isinstance(sections, Mapping) or not isinstance(evidence, Mapping):
        raise TypeError("Narrative sections and evidence are required.")
    fields = {}
    for name in _TEXT_SECTIONS:
        fields[f"sections.{name}"] = sections.get(name)
    for name in _LIST_SECTIONS:
        values = sections.get(name)
        if not isinstance(values, list) or (name == "watch_items" and len(values) > 3):
            raise ValueError(f"Invalid narrative list: {name}; at most three watch_items are allowed.")
        fields.update({f"sections.{name}[{index}]": text for index, text in enumerate(values)})
    for field, text in fields.items():
        _require_text(text)
        entry = evidence.get(field)
        if not isinstance(entry, Mapping) or not isinstance(entry.get("sources"), list) or not entry["sources"]:
            raise ValueError(f"Missing evidence sources for {field}.")
        _require_text(entry.get("operation"))
        for source in entry["sources"]:
            if not isinstance(source, str) or ":/" not in source:
                raise ValueError(f"Invalid evidence pointer for {field}.")
            artifact, pointer = source.split(":", 1)
            if artifact not in ("company", "forecast"):
                raise ValueError(f"Unknown evidence artifact: {artifact}.")
            pointer_value(data[artifact], pointer)
    return sections


def _percentage(coverage):
    if coverage is None:
        return "—"
    text = format(Decimal(str(coverage)) * 100, "f")
    return (text.rstrip("0").rstrip(".") if "." in text else text) + "%"


def _signed(value):
    if value and abs(value) < 0.0001:
        return f"{value:+.4g}"
    text = f"{value:+.4f}".rstrip("0").rstrip(".")
    return text if "." in text else text + ".0"


def _history_warning(forecast):
    expected = (f"{forecast['observed_operational_months']} observed EUR operational months; "
                f"{forecast['min_months_required']} required; {forecast['months_missing']} months missing")
    if forecast["reason"] != expected:
        raise ValueError("Unknown forecast refusal reason; a faithful Spanish translation is required.")
    return (
        f"{forecast['observed_operational_months']} meses operativos EUR observados; "
        f"{forecast['min_months_required']} requeridos; {forecast['months_missing']} por completar. "
        "El historial es insuficiente para calcular proyecciones."
    )


def _adverse_comparison(data):
    company, forecast = data["company"], data["forecast"]
    if forecast["forecast_status"] == "insufficient_data":
        return "No se calcula un escenario adverso por historial operativo insuficiente.", [
            "forecast:/forecast_status", "forecast:/observed_operational_months", "forecast:/min_months_required",
            "forecast:/months_missing", "forecast:/reason",
        ]
    scores = forecast["scenarios"]["adverse"]["scores"]
    index = min(range(len(scores)), key=lambda i: scores[i])
    score = scores[index]
    month = pu.months_to_spanish(forecast["forecast_months"][index])
    difference = Decimal(str(company["final_score"])) - Decimal(str(score))
    if difference > 0:
        text = (f"En el escenario adverso, el score podría bajar a {pu.format_score(score)} en {month}. "
                f"Esto representaría un deterioro de {difference:.1f} puntos respecto al actual.")
    else:
        comparison = "igual al score actual" if difference == 0 else f"{-difference:.1f} puntos por encima del actual"
        text = f"El mínimo del escenario adverso sería {pu.format_score(score)} en {month}, {comparison}."
    return text, ["company:/final_score", f"forecast:/scenarios/adverse/scores/{index}",
                  f"forecast:/forecast_months/{index}"]


def _operational_limitations(company):
    confidence = company["confidence"]
    coverage = confidence["coverage_pct"]
    limitations = []
    if coverage is None or coverage < 1:
        limitations.append((
            (f"Cobertura observada {_percentage(coverage)}: {confidence['months_complete']} de "
             f"{confidence['months_available']} meses completos. La evidencia disponible limita la interpretación."),
            ["company:/confidence/coverage_pct", "company:/confidence/months_complete", "company:/confidence/months_available"],
        ))
    latest = company["latest_observed_month"]
    limitations.append((
        (f"Corte de datos: {company['data_cutoff']}; último mes observado: "
         f"{pu.months_to_spanish(latest) if latest else 'no disponible'}. No se incluye el mes parcial del corte."),
        ["company:/data_cutoff", "company:/latest_observed_month"],
    ))
    exclusions = company["evidence_records"]
    for key, label in (("excluded_no_category", "sin categoría utilizable"),
                       ("excluded_non_eur", "por moneda distinta de EUR"),
                       ("excluded_unknown_product", "por producto desconocido")):
        if exclusions[key]:
            limitations.append((
                f"Se excluyeron {exclusions[key]} transacciones de esta empresa {label}.",
                [f"company:/evidence_records/{key}"],
            ))
    return limitations


def _adapt_narrative(data, narrative):
    _validate_data(data)
    if not isinstance(narrative, Mapping):
        raise TypeError("Narrative must be a mapping.")
    for name in ("resumen_tendencia", "escenario_adverso_texto"):
        _require_text(narrative.get(name))
    watch = narrative.get("que_vigilar")
    if not isinstance(watch, list) or len(watch) > 3:
        raise ValueError("que_vigilar must be a list of at most three items.")
    for item in watch:
        _require_text(item)
    company, forecast = data["company"], data["forecast"]
    persistence = (
        "La confirmación corrobora la dirección observada; no garantiza su continuidad ni mide trimestres consecutivos."
        if company["persistence"] == "confirmed" else
        "La dirección no está confirmada: no hay corroboración suficiente para afirmar que persista."
    )
    if company["trajectory"] in ("stable", "insufficient_data"):
        persistence = "No se confirma una dirección de mejora o deterioro con la comparación disponible."
    forecast_text = (
        "No hay proyección disponible: faltan observaciones operativas suficientes."
        if forecast["forecast_status"] == "insufficient_data" else
        f"Proyección condicional con {forecast['observed_operational_months']} meses operativos observados "
        f"y confianza {'baja' if forecast['confidence'] == 'low' else 'media'}."
    )
    sections = {
        "trend_summary": narrative["resumen_tendencia"], "persistence_explanation": persistence,
        "forecast_explanation": forecast_text, "adverse_summary": narrative["escenario_adverso_texto"],
        "watch_items": list(watch), "limitations": [],
    }
    evidence = {}

    def cite(field, sources, operation):
        evidence[f"sections.{field}"] = {"sources": sources, "operation": operation}

    cite("trend_summary", ["company:/trajectory", "company:/persistence", "company:/periods_compared", "company:/signals"],
         "Texto del autor sobre la comparación observada; no se extraen cifras del texto para los componentes.")
    cite("persistence_explanation", ["company:/trajectory", "company:/persistence", "company:/rule_version"],
         "Traducción del estado de persistencia, sin inferir una duración.")
    cite("forecast_explanation", ["forecast:/forecast_status", "forecast:/confidence", "forecast:/observed_operational_months"],
         "Traducción del estado de proyección y su historial operativo.")
    _, adverse_sources = _adverse_comparison(data)
    cite("adverse_summary", adverse_sources,
         "Texto del autor contextualizado por el mínimo adverso; diferencia = company.final_score menos el mínimo adverso, si existe.")
    watch_sources = ["company:/alerts", "company:/signals", "company:/confidence", *adverse_sources]
    for index in range(len(watch)):
        cite(f"watch_items[{index}]", watch_sources,
             "Texto operativo del autor referido a las alertas, señales, cobertura y escenario disponibles.")
    for index, (text, sources) in enumerate(_operational_limitations(company)):
        sections["limitations"].append(text)
        cite(f"limitations[{index}]", sources, "Presentación de cobertura, corte o exclusiones de esta empresa.")
    return {"company_id": company["company_id"], "role": "tesorero", "sections": sections, "evidence": evidence}


def _reserve(top, height):
    bottom = top - height
    if bottom < ds.CONTENT_BOTTOM:
        raise ValueError("El contenido no cabe en dos páginas con texto de al menos 8 pt; se necesita una decisión de maquetación.")
    return bottom


def _text(canvas, x, top, width, text, style="Body", **kwargs):
    height = ds.measure_text(text, width, style)
    bottom = _reserve(top, height)
    ds.draw_text(canvas, x, bottom, width, text, style, **kwargs)
    return bottom


def _section(canvas, top, title):
    bottom = _reserve(top, ds.SECTION_HEADER_HEIGHT)
    ds.draw_section_header(canvas, ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, title)
    return bottom - 8


def _panel_height(text):
    return 24 + ds.STYLES["H3"].leading + 6 + ds.measure_text(text, ds.CONTENT_WIDTH - 24)


def _panel(canvas, top, title, text, color=ds.WARNING):
    height = _panel_height(text)
    bottom = _reserve(top, height)
    with ds._saved(canvas):
        canvas.setFillColor(color)
        canvas.setFillAlpha(0.1)
        canvas.roundRect(ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, height, 6, fill=1, stroke=0)
        canvas.setFillAlpha(1)
        canvas.setStrokeColor(color)
        canvas.setLineWidth(3)
        canvas.line(ds.MARGIN_LEFT, bottom + 6, ds.MARGIN_LEFT, top - 6)
    y = _text(canvas, ds.MARGIN_LEFT + 12, top - 12, ds.CONTENT_WIDTH - 24, title, "H3")
    _text(canvas, ds.MARGIN_LEFT + 12, y - 6, ds.CONTENT_WIDTH - 24, text)
    return bottom


def _alert_text(company, alert):
    kind, value, threshold = alert["alert_type"], alert["trigger_value"], alert["threshold_used"]
    if kind == "DETERIORATION_CONFIRMED":
        return "Trayectoria: empeorando; persistencia: confirmada. Se cumple el disparador categórico configurado."
    if kind == "DRIFT_DETECTED":
        usage = company["window_usage"]["drift_detection"]
        return (f"Delta largo {_signed(value)} pt < umbral {_signed(threshold)} pt; "
                f"{usage['recent_months']} meses recientes frente a {usage['baseline_months']} de referencia.")
    if kind == "LOW_COVERAGE":
        return f"Cobertura observada {_percentage(value)} < umbral {_percentage(threshold)}. Revisar suficiencia de la evidencia."
    if kind == "STALE_DATA":
        return (f"Último dato: {pu.months_to_spanish(company['latest_observed_month'])}; "
                f"antigüedad {value:g} meses > umbral {threshold:g}. El score describe actividad pasada.")
    if kind == "INSUFFICIENT_DATA":
        return f"{value:g} meses disponibles < mínimo {threshold:g}; no hay suficiente historial para evaluar la trayectoria."
    return f"Score {pu.format_score(value)} < umbral {pu.format_score(threshold)}."


def _periods_text(periods):
    return ", ".join(pu.months_to_spanish(month) for month in periods) or "sin observaciones"


def _page_one(canvas, company, sections, report_date):
    ds.draw_header(canvas, company["company_id"], "Resumen ejecutivo", "TESORERO", report_date)
    top = ds.CONTENT_TOP
    if report_date != company["scoring_date"]:
        top = _text(canvas, ds.MARGIN_LEFT, top, ds.CONTENT_WIDTH,
                    f"Fecha de evaluación: {company['scoring_date']} · Fecha del informe: {report_date}", "Small") - 6
    confidence = company["confidence"]
    coverage = confidence["coverage_pct"]
    values = [pu.format_score(company["final_score"]) + "/100" if company["final_score"] is not None else "No calculado",
              pu.trajectory_to_spanish(company["trajectory"]), _percentage(coverage)]
    captions = [f"Ajuste de trayectoria: {_signed(company['trajectory_adjustment'])} pt",
                f"Persistencia: {pu.persistence_to_spanish(company['persistence'])}",
                (f"Cobertura observada · {confidence['months_complete']} / {confidence['months_available']} meses completos"
                 if coverage is not None else "Cobertura observada no disponible")]
    colors = [pu.score_to_color(company["final_score"]), ds.ACCENT, ds.ACCENT if coverage == 1 else ds.WARNING]
    kpi_bottom = top - 88
    for index, (label, value, caption, color) in enumerate(zip(
        ("Score final", "Trayectoria", "Confianza de datos"), values, captions, colors, strict=True,
    )):
        x = ds.MARGIN_LEFT + index * (ds.KPI_COLUMN_WIDTH + ds.COLUMN_GUTTER)
        ds.draw_kpi_box(canvas, x, kpi_bottom, ds.KPI_COLUMN_WIDTH, 88, label, value, None, color)
        _text(canvas, x, kpi_bottom - 6, ds.KPI_COLUMN_WIDTH, caption, "Small", align="center")
    top = kpi_bottom - 6 - max(ds.measure_text(text, ds.KPI_COLUMN_WIDTH, "Small") for text in captions) - 10
    gauge_bottom = _reserve(top, ds.GAUGE_HEIGHT)
    ds.draw_score_gauge(canvas, (ds.PAGE_WIDTH - ds.GAUGE_WIDTH) / 2, gauge_bottom,
                        company["final_score"], f"Salud de Tesorería · {company['scoring_date']}")
    top = _section(canvas, gauge_bottom - 12, "Alertas activas")
    alerts = sorted(company["alerts"], key=lambda alert: _SEVERITY_ORDER[alert["severity"]])
    if alerts:
        for alert in alerts:
            text = _alert_text(company, alert)
            width = ds.CONTENT_WIDTH - ds.BADGE_WIDTH - ds.COLUMN_GUTTER
            height = max(ds.BADGE_HEIGHT, ds.measure_text(text, width, "Small") + 6)
            bottom = _reserve(top, height)
            ds.draw_alert_badge(canvas, ds.MARGIN_LEFT, top - ds.BADGE_HEIGHT, alert["alert_type"], alert["severity"])
            _text(canvas, ds.MARGIN_LEFT + ds.BADGE_WIDTH + ds.COLUMN_GUTTER, top - 3, width, text, "Small")
            top = bottom - 8
    else:
        height = 32
        with ds._saved(canvas):
            canvas.setFillColor(ds.POSITIVE)
            canvas.setFillAlpha(0.1)
            canvas.roundRect(ds.MARGIN_LEFT, top - height, ds.CONTENT_WIDTH, height, 6, fill=1, stroke=0)
        _text(canvas, ds.MARGIN_LEFT + 12, top - 9, ds.CONTENT_WIDTH - 24, "Sin alertas activas")
        top -= height + 8
    top = _section(canvas, top - 4, "Tendencia reciente")
    left = _text(canvas, ds.MARGIN_LEFT, top, ds.COLUMN_WIDTH,
                 f"{pu.trajectory_to_spanish(company['trajectory'])} · {pu.persistence_to_spanish(company['persistence'])}", "H3")
    left = _text(canvas, ds.MARGIN_LEFT, left - 6, ds.COLUMN_WIDTH, sections["trend_summary"])
    left = _text(canvas, ds.MARGIN_LEFT, left - 8, ds.COLUMN_WIDTH, sections["persistence_explanation"], "Small")
    for side, label in (("recent", "Recientes"), ("baseline", "Referencia")):
        left = _text(canvas, ds.MARGIN_LEFT, left - 6, ds.COLUMN_WIDTH,
                     f"{label}: {_periods_text(company['periods_compared'][side])}.", "Small")
    if "drift_alert" in company:
        _text(canvas, ds.MARGIN_LEFT, left - 8, ds.COLUMN_WIDTH,
              "La alerta de deterioro a largo plazo es una lectura separada; no sustituye la trayectoria reciente.", "Small")
    signals = {signal["component"]: signal for signal in company["signals"]}
    right_x = ds.MARGIN_LEFT + ds.COLUMN_WIDTH + ds.COLUMN_GUTTER
    if signals:
        for component in ds.COMPONENT_LABELS:
            signal = signals[component]
            top = _reserve(top, ds.SIGNAL_BAR_HEIGHT)
            ds.draw_signal_bar(canvas, right_x, top, ds.COLUMN_WIDTH, component, signal["change"], signal["contribution"])
    else:
        _text(canvas, right_x, top, ds.COLUMN_WIDTH, "Sin comparación suficiente para calcular señales de componentes.")
    ds.draw_footer(canvas, 1, 2)


def _watch_items(data, sections):
    if sections["watch_items"]:
        return sections["watch_items"]
    company, forecast = data["company"], data["forecast"]
    if (company["alerts"] or any(signal["change"] < 0 for signal in company["signals"])
            or (forecast["scenarios"] and min(forecast["scenarios"]["adverse"]["scores"]) < company["final_score"])):
        raise ValueError("watch_items cannot be empty while supported attention points exist.")
    if forecast["forecast_status"] == "insufficient_data":
        return [_history_warning(forecast)]
    return ["No se identifican señales de riesgo inmediato"]


def _page_two(canvas, data, sections, report_date):
    company, forecast = data["company"], data["forecast"]
    ds.draw_header(canvas, company["company_id"], "Proyección y riesgos", "TESORERO", report_date)
    available = forecast["forecast_status"] != "insufficient_data"
    adverse, _ = _adverse_comparison(data)
    adverse_text = adverse + "\n" + sections["adverse_summary"]
    watch = _watch_items(data, sections)
    qualifier = "Escenarios condicionales de un índice histórico; no son saldos de caja ni probabilidades de impago."
    forecast_height = ds.measure_text(sections["forecast_explanation"], ds.CONTENT_WIDTH)
    qualifier_height = ds.measure_text(qualifier, ds.CONTENT_WIDTH, "Small")
    watch_height = sum(ds.measure_text(item, ds.CONTENT_WIDTH - 18) + 8 for item in watch)
    limits_height = ds.measure_limitations_box(ds.CONTENT_WIDTH, sections["limitations"]) if sections["limitations"] else 0
    low_warning = (f"Historial de {forecast['observed_operational_months']} meses operativos; "
                   "la proyección tiene confianza baja y debe interpretarse con cautela.")
    extra = _panel_height(low_warning) + 8 if forecast["forecast_status"] == "low_confidence" else 0
    fixed = (2 * (ds.SECTION_HEADER_HEIGHT + 8) + forecast_height + 8 + qualifier_height + 16
             + _panel_height(adverse_text) + 16 + watch_height + 8 + limits_height + extra)
    chart_height = min(250, ds.CONTENT_TOP - ds.CONTENT_BOTTOM - fixed)
    if available and chart_height < 160:
        raise ValueError("La proyección y el texto no caben en dos páginas; se necesita más espacio o una decisión de contenido.")
    top = _section(canvas, ds.CONTENT_TOP, "Proyección a tres meses" if available else "Proyección no disponible")
    top = _text(canvas, ds.MARGIN_LEFT, top, ds.CONTENT_WIDTH, sections["forecast_explanation"]) - 8
    if forecast["forecast_status"] == "low_confidence":
        top = _panel(canvas, top, "Confianza baja de la proyección", low_warning) - 8
    if available:
        bottom = _reserve(top, chart_height)
        scenarios = forecast["scenarios"]
        ds.draw_forecast_chart(canvas, ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, chart_height,
                               forecast["forecast_months"], scenarios["base"]["scores"],
                               scenarios["favorable"]["scores"], scenarios["adverse"]["scores"])
        top = bottom
    else:
        top = _panel(canvas, top, "Historial operativo insuficiente", _history_warning(forecast))
    top = _text(canvas, ds.MARGIN_LEFT, top - 4, ds.CONTENT_WIDTH, qualifier, "Small") - 12
    top = _panel(canvas, top, "Escenario adverso destacado" if available else "Escenario adverso no disponible", adverse_text) - 16
    top = _section(canvas, top, "Qué vigilar")
    for item in watch:
        bottom = _text(canvas, ds.MARGIN_LEFT + 18, top, ds.CONTENT_WIDTH - 18, item)
        with ds._saved(canvas):
            canvas.setFillColor(ds.PRIMARY)
            canvas.circle(ds.MARGIN_LEFT + 5, top - 6, 2, fill=1, stroke=0)
        top = bottom - 8
    if limits_height:
        bottom = _reserve(top - 8, limits_height)
        ds.draw_limitations_box(canvas, ds.MARGIN_LEFT, bottom, ds.CONTENT_WIDTH, sections["limitations"])
    ds.draw_footer(canvas, 2, 2)


def render_report(data, narrative, output_path, report_date=None):
    _validate_data(data)
    sections = _validate_narrative(data, narrative)
    report_date = data["company"]["scoring_date"] if report_date is None else report_date
    if not isinstance(report_date, str) or date.fromisoformat(report_date).isoformat() != report_date:
        raise ValueError("Report date must use YYYY-MM-DD.")
    path = Path(output_path).resolve()
    if str(path) in data["source_paths"].values():
        raise ValueError("A report must not overwrite its input artifacts.")
    buffer = BytesIO()
    canvas = Canvas(buffer, pagesize=ds.PAGE_SIZE)
    canvas.setTitle(f"Salud de Tesorería · {data['company']['company_id']}")
    canvas.setAuthor("Embat")
    _, sources = _adverse_comparison(data)
    canvas.setSubject("TESORERO · Comparación adversa: score actual menos mínimo adverso; fuentes: " + ", ".join(sources))
    _page_one(canvas, data["company"], sections, report_date)
    canvas.showPage()
    _page_two(canvas, data, sections, report_date)
    canvas.showPage()
    canvas.save()
    path.write_bytes(buffer.getvalue())
    return str(path)


def render_tesorero(company_id, results_dir, output_path, narrative):
    data = pu.load_company_data(company_id, results_dir)
    return render_report(data, _adapt_narrative(data, narrative), output_path)
