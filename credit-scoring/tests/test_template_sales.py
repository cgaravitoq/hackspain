from __future__ import annotations

import copy
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

from reportlab.pdfgen.canvas import Canvas
from test_copilot import artifacts

from templates import design_system as ds
from templates import template_sales as sales
from templates.pdf_utils import load_company_data

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "results-v2-agent6-20260919"
GREEN_NARRATIVE = {
    "resumen_linea_1": "La salud actual de tesorería se sitúa en la banda comercial buena.",
    "resumen_linea_2": "La mejora reciente está confirmada, aunque persiste deterioro a largo plazo.",
    "resumen_linea_3": "El escenario base cerraría por debajo del nivel actual si se cumplen sus supuestos.",
    "senales_positivas": [
        "El índice normalizado de entradas y salidas contribuye positivamente a la mejora reciente.",
        "El índice normalizado de devoluciones contribuye positivamente al ajuste de trayectoria.",
        "El índice normalizado de servicio de deuda aporta a la mejora reciente.",
    ],
    "senales_negativas": [
        "El índice normalizado de comisiones tiene una pequeña contribución negativa.",
        "Persiste deterioro a largo plazo, con alerta de severidad MEDIUM.",
    ],
    "recomendacion_comercial": "GREEN",
}
RED_NARRATIVE = {
    "resumen_linea_1": "La salud actual de tesorería se sitúa en la banda comercial regular.",
    "resumen_linea_2": "La trayectoria reciente presenta deterioro confirmado y requiere atención.",
    "resumen_linea_3": "No hay historial operativo suficiente para calcular la proyección.",
    "senales_positivas": [],
    "senales_negativas": [
        "El índice normalizado de entradas y salidas contribuye negativamente a la trayectoria.",
        "El índice normalizado de devoluciones contribuye negativamente a la trayectoria.",
        "El índice normalizado de comisiones también está bajo presión.",
    ],
    "recomendacion_comercial": "RED",
}


def policy_company(score=70, trajectory="improving", persistence="confirmed", alerts=None):
    return {"final_score": score, "trajectory": trajectory, "persistence": persistence,
            "alerts": [] if alerts is None else alerts}


class SalesPolicy(unittest.TestCase):
    def test_applies_strict_score_boundaries_without_rounding(self):
        for score, expected in ((0, "RED"), (44.9999, "RED"), (45, "AMBER"),
                                (65, "AMBER"), (65.0001, "GREEN"), (100, "GREEN"), (None, "AMBER")):
            with self.subTest(score=score):
                self.assertEqual(sales._recommendation_class(policy_company(score)), expected)
        for score, label, color in ((None, "No calculada", ds.NEUTRAL), (44.9999, "Frágil", ds.NEGATIVE),
                                     (45, "Regular", ds.WARNING), (65, "Regular", ds.WARNING),
                                     (65.0001, "Buena", ds.POSITIVE)):
            self.assertEqual(sales._health_state(score), (label, color))

    def test_prioritizes_confirmed_deterioration_over_high_scores(self):
        for score in (45, 65, 90, None):
            self.assertEqual(sales._recommendation_class(policy_company(score, "deteriorating")), "RED")
        for severity in ("LOW", "MEDIUM", "INFO"):
            company = policy_company(alerts=[{"alert_type": "SCORE_FLOOR", "severity": severity}])
            self.assertEqual(sales._recommendation_class(company), "GREEN")
        for alert_type in ("SCORE_FLOOR", "DETERIORATION_CONFIRMED"):
            company = policy_company(alerts=[{"alert_type": alert_type, "severity": "HIGH"}])
            self.assertEqual(sales._recommendation_class(company), "RED")
        company = policy_company(alerts=[{"alert_type": "OTHER", "severity": "HIGH"}])
        self.assertEqual(sales._recommendation_class(company), "AMBER")

    def test_requires_confirmation_and_never_promotes_missing_states(self):
        for trajectory in ("improving", "stable", "deteriorating", "insufficient_data", None, "unknown"):
            for persistence in ("confirmed", "unconfirmed", None):
                company = policy_company(70, trajectory, persistence)
                expected = ("RED" if trajectory == "deteriorating" and persistence == "confirmed"
                            else "GREEN" if trajectory in ("improving", "stable") and persistence == "confirmed"
                            else "AMBER")
                with self.subTest(trajectory=trajectory, persistence=persistence):
                    self.assertEqual(sales._recommendation_class(company), expected)
        self.assertEqual(sales._trend_state(policy_company(70, "stable"))[1], ds.NEUTRAL)
        self.assertEqual(sales._trend_state(policy_company(70, "improving", None))[1], ds.WARNING)
        self.assertIn("no disponible", sales._trend_state(policy_company(70, "improving", None))[2])
        self.assertIn("Sin confirmar", sales._trend_state(policy_company(70, "deteriorating", "unconfirmed"))[2])

    def test_compares_the_terminal_forecast_not_the_peak_or_rounded_values(self):
        for terminal, label, color in ((69.9999, "A la baja", ds.NEGATIVE), (70, "Sin cambio", ds.WARNING),
                                        (70.0001, "Al alza", ds.POSITIVE)):
            data = {"company": policy_company(), "forecast": {
                "forecast_status": "low_confidence", "confidence": "low",
                "forecast_months": ["2026-10", "2026-11", "2026-12"],
                "scenarios": {"base": {"scores": [80, 95, terminal]}},
            }}
            state = sales._projection_state(data)
            self.assertEqual(state[:2], (label, color))
            self.assertIn("Dic 2026", state[2])
            self.assertIn("Confianza baja", state[2])
            self.assertEqual(sales._recommendation_class(data["company"]), "GREEN")


class SalesRendering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.green = load_company_data("COMP_0216", SOURCE)
        cls.red = load_company_data("COMP_0874", SOURCE)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name) / "sales.pdf"
        for target in ("create_connection", "socket.connect"):
            network = patch(f"socket.{target}", side_effect=AssertionError("Tests must remain offline"))
            network.start()
            self.addCleanup(network.stop)

    def envelope(self, data=None, flat=None):
        return sales._to_report_narrative(self.green if data is None else data,
                                          GREEN_NARRATIVE if flat is None else flat)

    def text(self):
        return subprocess.run(["pdftotext", str(self.output), "-"], check=True,
                              capture_output=True, text=True).stdout

    def test_exposes_the_simple_entry_point_without_mutating_arguments(self):
        narrative = copy.deepcopy(GREEN_NARRATIVE)
        with patch.object(sales, "render_report", wraps=sales.render_report) as render:
            result = sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
        self.assertEqual(result, str(self.output.resolve()))
        self.assertEqual(narrative, GREEN_NARRATIVE)
        self.assertEqual(render.call_count, 1)
        self.assertEqual(render.call_args.args[1]["role"], "sales")
        self.assertTrue(self.output.read_bytes().startswith(b"%PDF-"))

    def test_preserves_the_frozen_entry_point_and_separates_report_and_scoring_dates(self):
        data, narrative = copy.deepcopy(self.green), self.envelope()
        original = copy.deepcopy((data, narrative))
        with patch.object(ds, "draw_header", wraps=ds.draw_header) as headers:
            result = sales.render_report(data, narrative, self.output, report_date="2026-09-20")
        self.assertEqual(result, str(self.output.resolve()))
        self.assertEqual((data, narrative), original)
        self.assertEqual(headers.call_count, 2)
        for call in headers.call_args_list:
            self.assertEqual(call.args[3:], ("SALES · USO INTERNO EMBAT", "2026-09-20"))

    def test_draws_only_the_supplied_base_line_and_no_scenario_band(self):
        lines = []
        original = Canvas.lines

        def record(canvas, segments):
            lines.append(segments)
            return original(canvas, segments)

        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart, \
                patch.object(ds, "_scenario_band", side_effect=AssertionError("No band in Sales")), \
                patch.object(Canvas, "lines", record):
            sales.render_sales("COMP_0216", SOURCE, self.output, GREEN_NARRATIVE)
        self.assertEqual(chart.call_count, 1)
        self.assertEqual(chart.call_args.args[5:],
                         (["2026-10", "2026-11", "2026-12"], [69.4, 80.2, 67.4], None, None))
        self.assertEqual(len(lines), 1)
        self.assertEqual(len(lines[0]), 2)

    def test_filters_alert_badges_to_the_stored_high_severity(self):
        for company_id, narrative, expected in (("COMP_0216", GREEN_NARRATIVE, []),
                                                ("COMP_0874", RED_NARRATIVE, [("DETERIORATION_CONFIRMED", "HIGH")])):
            with patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badge:
                sales.render_sales(company_id, SOURCE, self.output, narrative)
            self.assertEqual([call.args[3:] for call in badge.call_args_list], expected)

    def test_replaces_an_unavailable_forecast_instead_of_drawing_zero_scores(self):
        with patch.object(ds, "draw_forecast_chart", side_effect=AssertionError("No forecast chart")):
            sales.render_sales("COMP_0874", SOURCE, self.output, RED_NARRATIVE)
        self.assertEqual(sales._projection_state(self.red)[:2], ("Sin datos suficientes", ds.NEUTRAL))

    def test_rejects_mismatched_identity_role_and_unresolvable_evidence(self):
        for field, value in (("company_id", "COMP_0874"), ("role", "tesorero"), ("evidence", {})):
            narrative = self.envelope()
            narrative[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                sales.render_report(self.green, narrative, self.output)
            self.assertFalse(self.output.exists())
        narrative = self.envelope()
        narrative["evidence"]["sections.summary_lines[0]"]["sources"] = ["company:/absent"]
        with self.assertRaises(ValueError):
            sales.render_report(self.green, narrative, self.output)
        narrative = self.envelope()
        narrative["evidence"]["sections.positive_signals[0]"]["sources"] = ["company:/signals/2/contribution"]
        with self.assertRaises(ValueError):
            sales.render_report(self.green, narrative, self.output)

    def test_requires_three_number_free_summary_entries(self):
        for invalid in ("Score 77.4.", "Mejora durante dos trimestres.", "Previsión a tres meses.",
                        "Últimos nueve meses.", "Comparación 2026-09-19.", "Mejora de veinte puntos.",
                        "Cobertura de ½ de los meses."):
            narrative = copy.deepcopy(GREEN_NARRATIVE)
            narrative["resumen_linea_1"] = invalid
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, "numbers"):
                sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
        narrative = self.envelope()
        narrative["sections"]["summary_lines"].pop()
        with self.assertRaises(ValueError):
            sales.render_report(self.green, narrative, self.output)
        self.assertEqual(len(self.envelope()["sections"]["summary_lines"]), 3)

    def test_rejects_incorrect_classes_and_contradictory_forecast_claims(self):
        for field, value in (("recomendacion_comercial", "RED"),
                              ("recomendacion_comercial", "GREEN con proyección positiva."),
                              ("resumen_linea_3", "La proyección apunta a una mejora adicional."),
                              ("senales_positivas", ["El índice de comisiones mejora."]),
                              ("senales_negativas", ["Devoluciones por encima de la media del portfolio."])):
            narrative = copy.deepcopy(GREEN_NARRATIVE)
            narrative[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
            self.assertFalse(self.output.exists())

    def test_rejects_missing_forecasts_instead_of_searching_a_different_root(self):
        with self.assertRaisesRegex(ValueError, "Missing forecast"):
            sales.render_sales("COMP_0216", ROOT / "results", self.output, GREEN_NARRATIVE)

    def test_preserves_long_spanish_text_and_rejects_overflow_without_partial_files(self):
        narrative = copy.deepcopy(GREEN_NARRATIVE)
        narrative["senales_positivas"][0] += " Se trata del componente normalizado, no de importes en euros."
        sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
        original = self.output.read_bytes()
        narrative["resumen_linea_1"] = "La salud de tesorería requiere una lectura prudente de los datos observados. " * 150
        with self.assertRaisesRegex(ValueError, "fit|overflow|space"):
            sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
        self.assertEqual(self.output.read_bytes(), original)

    @unittest.skipUnless(shutil.which("pdftotext") and shutil.which("pdfinfo"), "Poppler required")
    def test_renders_two_nominal_a4_pages_with_exact_labels_and_visible_adverse_facts(self):
        for company_id, narrative, expected in (("COMP_0216", GREEN_NARRATIVE, "GREEN"),
                                                ("COMP_0874", RED_NARRATIVE, "RED")):
            sales.render_sales(company_id, SOURCE, self.output, narrative)
            info = subprocess.run(["pdfinfo", str(self.output)], check=True, capture_output=True, text=True).stdout
            text = self.text()
            self.assertRegex(info, r"Pages:\s+2\b")
            self.assertRegex(info, r"Page size:\s+595 x 842 pts")
            normalized = " ".join(text.split())
            self.assertRegex(text, r"1\s*/\s*2")
            self.assertRegex(text, r"2\s*/\s*2")
            for phrase in ("SALES · USO INTERNO EMBAT", "Ficha comercial",
                           "Detalle y recomendación", "Generado por Embat · Confidencial",
                           "Evolución esperada del score (escenario base)", "Última actualización: 2026-09-19",
                           "Versión: v2.0.0-w3-h9", sales.DISCLAIMER, expected):
                self.assertIn(phrase, normalized)
            self.assertNotRegex(text, r"\{\{|\}\}|TODO|None|\bnan\b|■")
            if expected == "GREEN":
                for phrase in ("A la baja", "67.4", "MEDIUM", "comisiones", "Sin alertas de riesgo para propuesta comercial"):
                    self.assertIn(phrase, normalized)
            else:
                for phrase in ("HIGH", "11 meses operativos disponibles", "12 requeridos", "1 pendiente",
                               "No se han identificado señales positivas"):
                    self.assertIn(phrase, normalized)
            bbox = subprocess.run(["pdftotext", "-bbox", str(self.output), "-"], check=True,
                                  capture_output=True, text=True).stdout
            words = ET.fromstring(bbox).findall(".//{http://www.w3.org/1999/xhtml}word")
            for word in words:
                x0, y0, x1, y1 = (float(word.attrib[key]) for key in ("xMin", "yMin", "xMax", "yMax"))
                self.assertTrue(47 <= x0 < x1 <= 548, word.text)
                self.assertTrue(0 <= y0 < y1 <= 842, word.text)
                if 64 <= y0 <= 780:
                    self.assertGreaterEqual(y0, 80, word.text)
                    self.assertLessEqual(y1, 783, word.text)

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler required")
    def test_retains_pressure_when_callers_supply_empty_lists_and_never_invents_positive_signals(self):
        narrative = copy.deepcopy(GREEN_NARRATIVE)
        narrative["senales_negativas"] = []
        sales.render_sales("COMP_0216", SOURCE, self.output, narrative)
        self.assertIn("comisiones", self.text().lower())
        self.assertIn("MEDIUM", self.text())
        sales.render_sales("COMP_0874", SOURCE, self.output, RED_NARRATIVE)
        self.assertIn("No se han identificado señales positivas", " ".join(self.text().split()))

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler required")
    def test_keeps_low_coverage_separate_from_confirmed_deterioration(self):
        narrative = copy.deepcopy(RED_NARRATIVE)
        narrative["resumen_linea_1"] = "La salud actual es regular, con cobertura observada limitada."
        narrative["senales_negativas"].pop(1)
        with patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badges:
            sales.render_sales("COMP_0114", SOURCE, self.output, narrative)
        self.assertEqual([call.args[3:] for call in badges.call_args_list], [("DETERIORATION_CONFIRMED", "HIGH")])
        text = " ".join(self.text().split())
        for phrase in ("RED", "7 meses operativos disponibles", "5 pendientes", "0 de 7 meses completos", "LOW"):
            self.assertIn(phrase, text)

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler required")
    def test_keeps_the_deteriorating_label_whole_inside_its_traffic_light_box(self):
        with patch.object(ds, "draw_kpi_box", wraps=ds.draw_kpi_box) as boxes:
            sales.render_sales("COMP_0874", SOURCE, self.output, RED_NARRATIVE)
        _, x, y, width, height, *_ = boxes.call_args_list[3].args
        text = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-r", "72",
                               "-x", str(int(x)), "-y", str(int(ds.PAGE_HEIGHT - y - height)),
                               "-W", str(int(width)), "-H", str(int(height)), str(self.output), "-"],
                              check=True, capture_output=True, text=True).stdout
        self.assertIn("Empeorando", text)
        self.assertIn("1 pendiente.", " ".join(self.text().split()))

    def test_draws_the_actual_status_color_and_exact_recommendation_headline(self):
        circles = []
        original = Canvas.circle

        def record(canvas, x, y, radius, **kwargs):
            if radius == 6:
                circles.append(canvas._fillColorObj)
            return original(canvas, x, y, radius, **kwargs)

        for company_id, narrative, expected in (("COMP_0216", GREEN_NARRATIVE, ds.POSITIVE),
                                                ("COMP_0874", RED_NARRATIVE, ds.NEGATIVE)):
            circles.clear()
            with patch.object(Canvas, "circle", record), patch.object(ds, "draw_text", wraps=ds.draw_text) as text:
                sales.render_sales(company_id, SOURCE, self.output, narrative)
            self.assertEqual(circles, [expected])
            headlines = [call.args[4] for call in text.call_args_list if call.args[4] in sales.HEADLINES.values()]
            self.assertEqual(headlines, [sales.HEADLINES[narrative["recomendacion_comercial"]]])

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler required")
    def test_retains_a_real_low_confidence_forecast_and_empty_columns(self):
        company, forecast = artifacts(15, values=[100] * 15)
        self.assertEqual(forecast["forecast_status"], "low_confidence")
        self.assertTrue(all(signal["contribution"] == 0 for signal in company["signals"]))
        data = {"company": company, "forecast": forecast, "source_paths": {}}
        delta = forecast["scenarios"]["base"]["scores"][-1] - company["final_score"]
        direction = "por encima" if delta > 0 else "por debajo" if delta < 0 else "sin cambio"
        narrative = {
            "resumen_linea_1": "La salud actual requiere una lectura prudente de los datos observados.",
            "resumen_linea_2": "La trayectoria reciente es estable según la comparación observada.",
            "resumen_linea_3": f"El escenario base cerraría {direction} respecto al nivel actual, con confianza baja.",
            "senales_positivas": [], "senales_negativas": [],
            "recomendacion_comercial": sales._recommendation_class(company),
        }
        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart:
            sales.render_report(data, self.envelope(data, narrative), self.output)
        self.assertEqual(chart.call_count, 1)
        self.assertEqual(chart.call_args.args[6], forecast["scenarios"]["base"]["scores"])
        text = " ".join(self.text().split())
        for phrase in ("Confianza baja", "No se han identificado señales positivas.",
                       "No se han identificado señales bajo presión."):
            self.assertIn(phrase, text)

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler required")
    def test_handles_unmeasured_scores_and_genuinely_empty_signal_columns(self):
        company, forecast = artifacts(0)
        data = {"company": company, "forecast": forecast, "source_paths": {}}
        narrative = {
            "resumen_linea_1": "La salud actual no está calculada.",
            "resumen_linea_2": "No hay datos suficientes para determinar la tendencia.",
            "resumen_linea_3": "No hay historial operativo suficiente para calcular la proyección.",
            "senales_positivas": [], "senales_negativas": [], "recomendacion_comercial": "AMBER",
        }
        sales.render_report(data, self.envelope(data, narrative), self.output)
        text = " ".join(self.text().split())
        for phrase in ("No calculada", "No calculado", "AMBER", "No se han identificado señales positivas",
                       "0 meses operativos disponibles", "12 pendientes"):
            self.assertIn(phrase, text)
        self.assertNotIn("Frágil", text)


if __name__ == "__main__":
    unittest.main()
