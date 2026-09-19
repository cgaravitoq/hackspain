from __future__ import annotations

import math
import re
import unicodedata
from contextlib import contextmanager
from datetime import date as iso_date
from decimal import Decimal
from itertools import pairwise
from xml.sax.saxutils import escape

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph

from templates.pdf_utils import _number, format_score, months_to_spanish, score_to_color

COLORS = {
    "primary": "#0B1F4B", "accent": "#00C9B1", "positive": "#1DB954",
    "negative": "#E53935", "warning": "#FFB300", "neutral": "#6B7280",
    "background": "#FFFFFF", "surface": "#F8FAFC",
    "text_primary": "#111827", "text_secondary": "#6B7280",
}
PRIMARY, ACCENT, POSITIVE, NEGATIVE, WARNING, NEUTRAL, BACKGROUND, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY = (
    HexColor(value) for value in COLORS.values()
)
PAGE_SIZE = (595, 842)
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE
MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT = 80, 60, 48, 48
CONTENT_WIDTH, CONTENT_BOTTOM, CONTENT_TOP = 499, 60, 762
COLUMN_GUTTER = 16
COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GUTTER) / 2
KPI_COLUMN_WIDTH = (CONTENT_WIDTH - 2 * COLUMN_GUTTER) / 3
HEADER_HEIGHT, FOOTER_HEIGHT = 64, 48
GAUGE_WIDTH, GAUGE_HEIGHT = 200, 140
SECTION_HEADER_HEIGHT = 28
SIGNAL_BAR_HEIGHT, SIGNAL_SCALE = 56, 100
BADGE_WIDTH, BADGE_HEIGHT = 144, 36
CONFIDENCE_BAR_HEIGHT = 36

STYLES = {
    name: ParagraphStyle(name, fontName=font, fontSize=size, leading=leading, textColor=color,
                         spaceBefore=0, spaceAfter=0, splitLongWords=True)
    for name, font, size, leading, color in (
        ("H1", "Helvetica-Bold", 24, 28, PRIMARY),
        ("H2", "Helvetica-Bold", 16, 20, PRIMARY),
        ("H3", "Helvetica-Bold", 12, 15, PRIMARY),
        ("Body", "Helvetica", 10, 13, TEXT_PRIMARY),
        ("Small", "Helvetica", 8, 10, TEXT_SECONDARY),
        ("Label", "Helvetica-Bold", 8, 10, TEXT_SECONDARY),
        ("Accent", "Helvetica-Bold", 10, 13, ACCENT),
    )
}
COMPONENT_LABELS = {
    "inflow_outflow_ratio": "Entradas/salidas", "chargeback_score": "Devoluciones",
    "fee_score": "Comisiones", "debt_score": "Servicio de deuda",
}
ALERT_LABELS = {
    "DETERIORATION_CONFIRMED": "Deterioro confirmado", "DRIFT_DETECTED": "Deterioro a largo plazo",
    "STALE_DATA": "Datos desactualizados", "LOW_COVERAGE": "Cobertura baja",
    "INSUFFICIENT_DATA": "Datos insuficientes", "SCORE_FLOOR": "Score bajo el umbral",
}

__all__ = [
    "ACCENT", "ALERT_LABELS", "BACKGROUND", "BADGE_HEIGHT", "BADGE_WIDTH", "COLORS",
    "COLUMN_GUTTER", "COLUMN_WIDTH", "COMPONENT_LABELS", "CONFIDENCE_BAR_HEIGHT", "CONTENT_BOTTOM",
    "CONTENT_TOP", "CONTENT_WIDTH", "FOOTER_HEIGHT", "GAUGE_HEIGHT", "GAUGE_WIDTH", "HEADER_HEIGHT",
    "KPI_COLUMN_WIDTH", "MARGIN_BOTTOM", "MARGIN_LEFT", "MARGIN_RIGHT", "MARGIN_TOP", "NEGATIVE",
    "NEUTRAL", "PAGE_HEIGHT", "PAGE_SIZE", "PAGE_WIDTH", "POSITIVE", "PRIMARY", "SECTION_HEADER_HEIGHT",
    "SIGNAL_BAR_HEIGHT", "SIGNAL_SCALE", "STYLES", "SURFACE", "TEXT_PRIMARY", "TEXT_SECONDARY", "WARNING",
    "draw_alert_badge", "draw_confidence_bar", "draw_footer", "draw_forecast_chart", "draw_header",
    "draw_kpi_box", "draw_limitations_box", "draw_score_gauge", "draw_section_header", "draw_signal_bar",
    "draw_text", "measure_limitations_box", "measure_text",
]


def _color(value):
    if isinstance(value, Color):
        for channel in (value.red, value.green, value.blue, value.alpha):
            _number(channel, 0, 1)
        return value
    if isinstance(value, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        return HexColor(value)
    raise ValueError("Color must be a ReportLab Color or a six-digit hex string.")


def _tint(color, amount=0.12):
    return Color(*(1 - amount + amount * channel for channel in (color.red, color.green, color.blue)))


def _text(value):
    if not isinstance(value, str):
        raise TypeError("Display text must be a string.")
    if any(unicodedata.category(char).startswith("C") and char != "\n" for char in value):
        raise ValueError("Unsupported control character in display text.")
    try:
        value.encode("cp1252")
    except UnicodeEncodeError as error:
        raise ValueError("Text contains a character unsupported by built-in Helvetica.") from error
    return value


def _paragraph(text, width, style="Body", align="left", color=None):
    _number(width, 1)
    text = _text(text)
    if style not in STYLES or align not in ("left", "center", "right"):
        raise ValueError("Unknown text style or alignment.")
    if style == "Label":
        text = _text(text.upper())
    parent = STYLES[style]
    if any(stringWidth(char, parent.fontName, parent.fontSize) > width for char in text if char != "\n"):
        raise ValueError("Text width cannot accommodate a single glyph; increase the width.")
    paragraph_style = ParagraphStyle("measured", parent=parent,
                                    alignment={"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}[align],
                                    textColor=parent.textColor if color is None else _color(color))
    paragraph = Paragraph(escape(text).replace("\n", "<br/>"), paragraph_style)
    _, height = paragraph.wrap(width, 1000000)
    return paragraph, height


def measure_text(text, width, style="Body"):
    return _paragraph(text, width, style)[1]


def _fit(text, width, height, style="Body", align="left", color=None):
    paragraph, measured = _paragraph(text, width, style, align, color)
    if measured > height:
        raise ValueError(f"Text needs {measured:g} pt, but only {height:g} pt are available; nothing was truncated.")
    return paragraph, measured


def _geometry(x, y, width, height):
    _number(x)
    _number(y)
    _number(width, 1)
    _number(height, 1)


@contextmanager
def _saved(canvas):
    canvas.saveState()
    try:
        canvas.setDash()
        canvas.setLineWidth(1)
        canvas.setLineCap(0)
        canvas.setFillAlpha(1)
        canvas.setStrokeAlpha(1)
        yield
    finally:
        canvas.restoreState()


def draw_text(canvas, x, y, width, text, style="Body", *, align="left", color=None):
    paragraph, height = _paragraph(text, width, style, align, color)
    _geometry(x, y, width, max(1, height))
    with _saved(canvas):
        paragraph.drawOn(canvas, x, y)
    return height


def _polygon(canvas, points, *, stroke=0):
    path = canvas.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    path.close()
    canvas.drawPath(path, fill=1, stroke=stroke)


def _signed(value):
    _number(value)
    if value == 0:
        return "0.0"
    if abs(value) < 0.0001:
        return f"{value:+.4g}"
    text = f"{value:+.4f}".rstrip("0").rstrip(".")
    return text + ".0" if "." not in text else text


def _arrow(canvas, x, y, direction):
    points = [(0, 0), (3, 0), (3, 5), (6, 5), (1.5, 10), (-3, 5), (0, 5)]
    _polygon(canvas, [(x + dx, y + (dy if direction > 0 else 10 - dy)) for dx, dy in points])


def draw_header(canvas, company_id, report_type, role, date):
    if not isinstance(date, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", date):
        raise ValueError("Report date must use YYYY-MM-DD.")
    iso_date.fromisoformat(date)
    title, title_height = _fit(report_type, 279, 40, "H2", "center", BACKGROUND)
    metadata, _ = _fit(f"{_text(company_id)} · {_text(role)}", 279, 10, "Small", "center", BACKGROUND)
    width, height = canvas._pagesize
    with _saved(canvas):
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, height - HEADER_HEIGHT, width, HEADER_HEIGHT, fill=1, stroke=0)
        canvas.setFillColor(BACKGROUND)
        canvas.setFont("Helvetica-Bold", 24)
        canvas.drawString(MARGIN_LEFT, height - 40, "Embat")
        title.drawOn(canvas, 159, height - 8 - title_height)
        metadata.drawOn(canvas, 159, height - 60)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(width - MARGIN_RIGHT, height - 26, date)
    return HEADER_HEIGHT


def draw_footer(canvas, page_num, total_pages):
    if type(page_num) is not int or type(total_pages) is not int or not 1 <= page_num <= total_pages:
        raise ValueError("Page numbers must satisfy 1 <= page_num <= total_pages.")
    width = canvas._pagesize[0]
    with _saved(canvas):
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(0.8)
        canvas.line(MARGIN_LEFT, FOOTER_HEIGHT, width - MARGIN_RIGHT, FOOTER_HEIGHT)
        canvas.setFillColor(TEXT_SECONDARY)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(MARGIN_LEFT, 30, "Generado por Embat · Confidencial")
        canvas.drawRightString(width - MARGIN_RIGHT, 30, f"{page_num} / {total_pages}")
    return FOOTER_HEIGHT


def draw_score_gauge(canvas, x, y, score, label):
    color = _color(score_to_color(score))
    _geometry(x, y, GAUGE_WIDTH, GAUGE_HEIGHT)
    caption, _ = _fit(label, GAUGE_WIDTH, 26, "Body", "center")
    cx, cy, radius = x + 100, y + 44, 84
    with _saved(canvas):
        canvas.setLineWidth(12)
        bands = [(0, 100)] if score is None else [(0, 40), (40, 65), (65, 85), (85, 100)]
        for lower, upper in bands:
            canvas.setStrokeColor(NEUTRAL if score is None else _color(score_to_color((lower + upper) / 2)))
            canvas.arc(cx - radius, cy - radius, cx + radius, cy + radius,
                       startAng=180 - lower * 1.8, extent=-(upper - lower) * 1.8)
        if score is not None:
            angle = math.radians(180 - score * 1.8)
            tip = (cx + 79 * math.cos(angle), cy + 79 * math.sin(angle))
            center = (cx + 68 * math.cos(angle), cy + 68 * math.sin(angle))
            canvas.setFillColor(PRIMARY)
            _polygon(canvas, [tip, (center[0] - 4 * math.sin(angle), center[1] + 4 * math.cos(angle)),
                              (center[0] + 4 * math.sin(angle), center[1] - 4 * math.cos(angle))])
        canvas.setFillColor(PRIMARY if score is not None else color)
        canvas.setFont("Helvetica-Bold", 30 if score is not None else 16)
        canvas.drawCentredString(cx, cy + 9, format_score(score) if score is not None else "No calculado")
        canvas.setFillColor(TEXT_SECONDARY)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(x + 10, y + 29, "0")
        canvas.drawRightString(x + 190, y + 29, "100")
        caption.drawOn(canvas, x, y)
    return GAUGE_HEIGHT


def draw_section_header(canvas, x, y, width, title):
    _geometry(x, y, width, SECTION_HEADER_HEIGHT)
    paragraph, height = _fit(title, width - 24, 20, "H3")
    with _saved(canvas):
        canvas.setFillColor(SURFACE)
        canvas.rect(x, y, width, SECTION_HEADER_HEIGHT, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.rect(x, y, 3, SECTION_HEADER_HEIGHT, fill=1, stroke=0)
        paragraph.drawOn(canvas, x + 12, y + (SECTION_HEADER_HEIGHT - height) / 2)
    return SECTION_HEADER_HEIGHT


def draw_kpi_box(canvas, x, y, width, height, label, value, delta, color):
    _geometry(x, y, width, height)
    color = _color(color)
    heading, heading_height = _fit(label, width - 24, 20, "Label", "center")
    if type(value) in (int, float):
        _number(value)
    value = "—" if value is None else str(value)
    _text(value)
    if delta is not None:
        if isinstance(delta, str):
            if not re.fullmatch(r"[+-]?[0-9]+(?:\.[0-9]+)?", delta):
                raise ValueError("Delta must be a signed finite number or absent.")
            delta = float(delta)
        delta_text = _signed(delta)
        if stringWidth(delta_text, "Helvetica-Bold", 8) + 24 > width - 24:
            raise ValueError("Delta does not fit the KPI footprint.")
    bottom = 28 if delta is not None else 12
    value_top = height - 18 - heading_height
    available = value_top - bottom
    chosen = None
    for size in (28, 24, 20, 16, 12):
        style = ParagraphStyle("kpi", fontName="Helvetica-Bold", fontSize=size, leading=size * 1.15,
                               alignment=TA_CENTER, textColor=PRIMARY, splitLongWords=True)
        paragraph = Paragraph(escape(value).replace("\n", "<br/>"), style)
        _, measured = paragraph.wrap(width - 24, 1000000)
        if measured <= available:
            chosen = paragraph, measured
            break
    if chosen is None:
        raise ValueError("KPI content does not fit; increase the supplied width or height.")
    with _saved(canvas):
        canvas.setFillColor(SURFACE)
        canvas.setStrokeColor(color)
        canvas.roundRect(x + 0.5, y + 0.5, width - 1, height - 1, 8, fill=1, stroke=1)
        heading.drawOn(canvas, x + 12, y + height - 12 - heading_height)
        chosen[0].drawOn(canvas, x + 12, y + bottom + (available - chosen[1]) / 2)
        if delta is not None:
            text_width = stringWidth(delta_text, "Helvetica-Bold", 8)
            start = x + (width - text_width - (14 if delta else 0)) / 2
            if delta:
                canvas.setFillColor(POSITIVE if delta > 0 else NEGATIVE)
                _arrow(canvas, start + 3, y + 10, delta)
                start += 14
            canvas.setFillColor(TEXT_PRIMARY if delta else NEUTRAL)
            canvas.setFont("Helvetica-Bold", 8)
            canvas.drawString(start, y + 11, delta_text)
    return height


def draw_signal_bar(canvas, x, y, width, component, change, contribution):
    _geometry(x, y, width, SIGNAL_BAR_HEIGHT)
    _number(width, 200)
    _number(change, -SIGNAL_SCALE, SIGNAL_SCALE)
    _number(contribution)
    label = COMPONENT_LABELS.get(component, component) if isinstance(component, str) else component
    heading, _ = _fit(label, 104, 20, "Small", color=TEXT_PRIMARY)
    change_text, _ = _fit(f"Cambio: {_signed(change)} pt normalizados", width, 10, "Small", color=TEXT_PRIMARY)
    contribution_text, _ = _fit(f"Ajuste: {_signed(contribution)} pt de trayectoria", width, 10, "Small")
    half = (width - 120) / 2
    zero = x + 112 + half
    with _saved(canvas):
        heading.drawOn(canvas, x, y + 32)
        change_text.drawOn(canvas, x, y + 15)
        contribution_text.drawOn(canvas, x, y + 2)
        canvas.setStrokeColor(_tint(NEUTRAL, 0.3))
        canvas.line(zero - half, y + 41, zero + half, y + 41)
        canvas.setStrokeColor(NEUTRAL)
        canvas.line(zero, y + 34, zero, y + 48)
        if change:
            length = abs(change) / SIGNAL_SCALE * half
            canvas.setFillColor(ACCENT if change > 0 else NEGATIVE)
            canvas.rect(zero if change > 0 else zero - length, y + 37, length, 8, fill=1, stroke=0)
    return SIGNAL_BAR_HEIGHT


def _scenario_band(canvas, xs, favorable, adverse):
    canvas.setFillColor(_tint(ACCENT))
    for index in range(len(xs) - 1):
        x0, x1 = xs[index:index + 2]
        f0, f1 = favorable[index:index + 2]
        a0, a1 = adverse[index:index + 2]
        if (f0 - a0) * (f1 - a1) < 0:
            fraction = (f0 - a0) / ((f0 - a0) - (f1 - a1))
            crossing = (x0 + fraction * (x1 - x0), f0 + fraction * (f1 - f0))
            _polygon(canvas, [(x0, f0), crossing, (x0, a0)])
            _polygon(canvas, [crossing, (x1, f1), (x1, a1)])
        else:
            _polygon(canvas, [(x0, f0), (x1, f1), (x1, a1), (x0, a0)])


def draw_forecast_chart(canvas, x, y, width, height, months, base, favorable, adverse):
    _geometry(x, y, width, height)
    _number(width, 200)
    _number(height, 160)
    if not isinstance(months, (list, tuple)) or not months:
        raise ValueError("A chart requires nonempty forecast months; use a warning panel for unavailable data.")
    labels = [months_to_spanish(month) for month in months]
    if list(months) != sorted(set(months)):
        raise ValueError("Forecast months must be unique and chronological.")
    if (favorable is None) != (adverse is None):
        raise ValueError("Both conditional scenarios must be present or both absent.")
    series = [("Base", base, PRIMARY, ())]
    if favorable is not None:
        series += [("Favorable", favorable, ACCENT, (5, 2)), ("Adverso", adverse, NEGATIVE, (2, 2))]
    for name, values, _, _ in series:
        if not isinstance(values, (list, tuple)) or len(values) != len(months):
            raise ValueError(f"{name} scores must match the month array length.")
        for value in values:
            _number(value, 0, 100)
    left, right, bottom, top = x + 36, x + width - 22, y + 62, y + height - 18
    ordinals = [int(month[:4]) * 12 + int(month[5:]) for month in months]
    span = ordinals[-1] - ordinals[0]
    xs = [left + (right - left) * (ordinal - ordinals[0]) / span for ordinal in ordinals] if span else [(left + right) / 2]
    label_widths = [stringWidth(label, "Helvetica", 8) for label in labels]
    if any(xs[i + 1] - xs[i] < (label_widths[i] + label_widths[i + 1]) / 2 + 6 for i in range(len(xs) - 1)):
        raise ValueError("Month labels overlap; increase chart width.")
    positions = [[bottom + value / 100 * (top - bottom) for value in values] for _, values, _, _ in series]
    note = "Banda de escenarios; no intervalo de confianza." if favorable is not None else "Proyección condicional del escenario base."
    caption, _ = _fit(note, width, 20, "Small", "center")
    with _saved(canvas):
        if favorable is not None:
            _scenario_band(canvas, xs, positions[1], positions[2])
        canvas.setFont("Helvetica", 8)
        for tick in (0, 25, 50, 75, 100):
            tick_y = bottom + tick / 100 * (top - bottom)
            canvas.setStrokeColor(_tint(NEUTRAL, 0.2))
            canvas.setLineWidth(0.5)
            canvas.line(left, tick_y, right, tick_y)
            canvas.setFillColor(TEXT_SECONDARY)
            canvas.drawRightString(left - 8, tick_y - 3, str(tick))
        for at_x, label in zip(xs, labels, strict=True):
            canvas.drawCentredString(at_x, bottom - 15, label)
        canvas.setFillColor(TEXT_SECONDARY)
        canvas.drawString(x, y + height - 8, "Score / 100")
        legend_widths = [stringWidth(name, "Helvetica", 8) + 27 for name, _, _, _ in series]
        legend_x = x + (width - sum(legend_widths)) / 2
        for index, (name, _, color, dash) in enumerate(series):
            canvas.setStrokeColor(color)
            canvas.setFillColor(color)
            canvas.setLineWidth(1.8)
            canvas.setDash(dash)
            points = list(zip(xs, positions[index], strict=True))
            canvas.lines([(*start, *end) for start, end in pairwise(points)])
            for at_x, at_y in points:
                if index == 0:
                    canvas.circle(at_x, at_y, 2.5, fill=1, stroke=0)
                elif index == 1:
                    canvas.rect(at_x - 2.5, at_y - 2.5, 5, 5, fill=1, stroke=0)
                else:
                    _polygon(canvas, [(at_x, at_y + 3), (at_x - 3, at_y - 2), (at_x + 3, at_y - 2)], stroke=1)
            canvas.line(legend_x, y + 30, legend_x + 14, y + 30)
            canvas.setFillColor(TEXT_PRIMARY)
            canvas.drawString(legend_x + 18, y + 27, name)
            legend_x += legend_widths[index]
        caption.drawOn(canvas, x, y + 2)
    return height


def draw_alert_badge(canvas, x, y, alert_type, severity):
    _geometry(x, y, BADGE_WIDTH, BADGE_HEIGHT)
    alert_type = _text(alert_type)
    severity = _text(severity) if severity is not None else "No disponible"
    color = {"HIGH": NEGATIVE, "MEDIUM": WARNING, "LOW": POSITIVE, "INFO": NEUTRAL}.get(severity, NEUTRAL)
    severity_text = severity if severity in ("HIGH", "MEDIUM", "LOW", "INFO") else f"Desconocida: {severity}"
    heading, _ = _fit(severity_text, BADGE_WIDTH - 34, 10, "Small", color=PRIMARY)
    caption, _ = _fit(ALERT_LABELS.get(alert_type, f"Alerta: {alert_type}"), BADGE_WIDTH - 16, 10, "Small", "center", PRIMARY)
    with _saved(canvas):
        canvas.setFillColor(_tint(color, 0.2))
        canvas.roundRect(x, y, BADGE_WIDTH, BADGE_HEIGHT, BADGE_HEIGHT / 2, fill=1, stroke=0)
        canvas.setFillColor(color)
        canvas.circle(x + 14, y + 24, 3, fill=1, stroke=0)
        heading.drawOn(canvas, x + 23, y + 19)
        caption.drawOn(canvas, x + 8, y + 5)
    return BADGE_HEIGHT


def draw_confidence_bar(canvas, x, y, width, coverage_pct, months_available):
    _geometry(x, y, width, CONFIDENCE_BAR_HEIGHT)
    _number(coverage_pct, 0, 1)
    if type(months_available) is not int or months_available < 0:
        raise ValueError("months_available must be a nonnegative integer.")
    percentage = format(Decimal(str(coverage_pct)) * 100, "f")
    if "." in percentage:
        percentage = percentage.rstrip("0").rstrip(".")
    label, _ = _fit(f"Cobertura observada: {percentage}% · {months_available} meses disponibles", width, 20, "Small", color=TEXT_PRIMARY)
    with _saved(canvas):
        label.drawOn(canvas, x, y + 14)
        canvas.setFillColor(_tint(NEUTRAL, 0.15))
        canvas.roundRect(x, y, width, 6, 3, fill=1, stroke=0)
        if coverage_pct:
            canvas.setFillColor(ACCENT)
            canvas.roundRect(x, y, width * coverage_pct, 6, min(3, width * coverage_pct / 2), fill=1, stroke=0)
    return CONFIDENCE_BAR_HEIGHT


def _limitations_layout(width, limitations_list):
    _number(width, 100)
    if not isinstance(limitations_list, (list, tuple)):
        raise TypeError("Limitations must be a list of complete strings.")
    items = list(limitations_list) or ["No se han facilitado limitaciones."]
    if any(not isinstance(item, str) or not item.strip() for item in items):
        raise ValueError("Limitations must contain nonempty strings.")
    paragraphs = [_paragraph(item, width - 36, "Small", color=TEXT_PRIMARY) for item in items]
    height = 42 + sum(measured for _, measured in paragraphs) + 4 * (len(paragraphs) - 1)
    return paragraphs, height


def measure_limitations_box(width, limitations_list):
    return _limitations_layout(width, limitations_list)[1]


def draw_limitations_box(canvas, x, y, width, limitations_list):
    paragraphs, height = _limitations_layout(width, limitations_list)
    _geometry(x, y, width, height)
    with _saved(canvas):
        canvas.setFillColor(_tint(WARNING))
        canvas.roundRect(x, y, width, height, 6, fill=1, stroke=0)
        canvas.setFillColor(WARNING)
        _polygon(canvas, [(x + 12, y + height - 25), (x + 24, y + height - 25), (x + 18, y + height - 13)])
        canvas.setStrokeColor(PRIMARY)
        canvas.setLineWidth(1.2)
        canvas.line(x + 18, y + height - 21, x + 18, y + height - 17)
        canvas.setFillColor(PRIMARY)
        canvas.circle(x + 18, y + height - 23, 0.7, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(x + 32, y + height - 23, "LIMITACIONES")
        remaining = y + height - 32
        for paragraph, measured in paragraphs:
            remaining -= measured
            canvas.setFillColor(PRIMARY)
            canvas.circle(x + 15, remaining + measured - 5, 1.3, fill=1, stroke=0)
            paragraph.drawOn(canvas, x + 24, remaining)
            remaining -= 4
    return height
