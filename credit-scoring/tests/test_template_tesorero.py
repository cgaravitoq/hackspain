from __future__ import annotations

import copy
import socket
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

from test_copilot import artifacts

from templates import design_system as ds
from templates import template_tesorero as template
from templates.pdf_utils import load_company_data

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "results-v2-agent6-20260919"
MOCK_NARRATIVE = {
    "resumen_tendencia": (
        "La comparación reciente muestra una mejora del índice de entradas/salidas "
        "(+5.0495 puntos normalizados). La persistencia de la trayectoria está confirmada, "
        "sin garantizar que la mejora continúe."
    ),
    "que_vigilar": [
        "Revisar la alerta MEDIUM de deriva: delta -13.9186 puntos, por debajo del umbral -2.0.",
        "Las comisiones aportan -0.0036 puntos al ajuste de trayectoria; revisar este componente.",
        "Contrastar el escenario adverso: mínimo 49.7 frente al score actual 77.4.",
    ],
    "escenario_adverso_texto": (
        "En el escenario adverso el score podría descender hasta 49.7 en diciembre de 2026, "
        "una caída de 27.7 puntos respecto al actual."
    ),
}


def synthetic_data(count=18, **kwargs):
    company, forecast = artifacts(count, **kwargs)
    return {"company": company, "forecast": forecast, "source_paths": {}}


def simple_narrative(data):
    company, forecast = data["company"], data["forecast"]
    return {
        "resumen_tendencia": "La lectura describe los periodos observados, no garantiza su continuidad.",
        "que_vigilar": [
            f"Revisar la cobertura observada: {company['confidence']['months_complete']} meses completos."
        ],
        "escenario_adverso_texto": (
            "El escenario es condicional, no una predicción de saldo de caja."
            if forecast["scenarios"] else "El historial operativo no permite proyectar un escenario adverso."
        ),
    }


class TreasuryTemplate(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name) / "tesorero.pdf"
        no_network = patch.object(socket, "create_connection", side_effect=AssertionError("network"))
        no_network.start()
        self.addCleanup(no_network.stop)

    def render(self, data, narrative=None, **kwargs):
        narrative = template._adapt_narrative(data, narrative or simple_narrative(data))
        result = template.render_report(data, narrative, self.output, **kwargs)
        self.assertEqual(result, str(self.output.resolve()))
        return self.pdf_text()

    def pdf_text(self):
        return subprocess.run(
            ["pdftotext", "-raw", str(self.output), "-"],
            check=True, capture_output=True, text=True,
        ).stdout

    def assert_two_pages(self):
        info = subprocess.run(
            ["pdfinfo", str(self.output)], check=True, capture_output=True, text=True,
        ).stdout
        self.assertRegex(info, r"Pages:\s+2\b")
        self.assertRegex(info, r"Page size:\s+595 x 842 pts")
        text = self.pdf_text()
        for heading in ("Resumen ejecutivo", "Proyección y riesgos", "TESORERO"):
            self.assertIn(heading, text)
        for number in (1, 2):
            self.assertRegex(text, rf"{number}\s*/\s*2")
        self.assertEqual(text.count("Generado por Embat · Confidencial"), 2)
        self.assertNotIn("■", text)
        self.assertNotRegex(text, r"\{(?:narrative|score|company)|TODO|PLACEHOLDER")

    def assert_no_text_overlap(self):
        xml = subprocess.run(
            ["pdftotext", "-bbox", str(self.output), "-"],
            check=True, capture_output=True, text=True,
        ).stdout
        for page in ET.fromstring(xml).iter("{http://www.w3.org/1999/xhtml}page"):
            words = list(page.iter("{http://www.w3.org/1999/xhtml}word"))
            for i, word in enumerate(words):
                box = [float(word.attrib[key]) for key in ("xMin", "yMin", "xMax", "yMax")]
                self.assertGreaterEqual(box[0], 47.9, word.text)
                self.assertLessEqual(box[2], 547.1, word.text)
                self.assertGreaterEqual(box[1], 0, word.text)
                self.assertLessEqual(box[3], 842, word.text)
                self.assertGreaterEqual(box[3] - box[1], 7.3, word.text)
                for other in words[i + 1:]:
                    b = [float(other.attrib[key]) for key in ("xMin", "yMin", "xMax", "yMax")]
                    overlap = min(box[2], b[2]) - max(box[0], b[0]), min(box[3], b[3]) - max(box[1], b[1])
                    self.assertFalse(overlap[0] > 0.3 and overlap[1] > 0.3, (word.text, other.text))

    def test_renders_the_requested_simple_interface_with_real_v2_values(self):
        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart, \
                patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badge:
            result = template.render_tesorero("COMP_0216", SOURCE, self.output, MOCK_NARRATIVE)
        self.assertEqual(result, str(self.output.resolve()))
        self.assert_two_pages()
        self.assert_no_text_overlap()
        badge.assert_called_once()
        self.assertEqual(badge.call_args.args[-2:], ("DRIFT_DETECTED", "MEDIUM"))
        self.assertEqual(chart.call_args.args[-4:], (
            ["2026-10", "2026-11", "2026-12"], [69.4, 80.2, 67.4], [73.9, 89.4, 91.2], [63.5, 58.4, 49.7],
        ))
        text = self.pdf_text()
        for value in ("77.4/100", "49.7", "27.7", "Dic 2026", "100%", "20 / 20", "-0.0036", "3430"):
            self.assertIn(value, text)
        for field in ("resumen_tendencia", "escenario_adverso_texto"):
            self.assertIn(" ".join(MOCK_NARRATIVE[field].split()), " ".join(text.split()))
        self.assertNotIn("Sin alertas activas", text)
        self.assertNotIn("635860", text)

    def test_replaces_unavailable_forecasts_with_exact_history_warnings(self):
        for company_id, score, complete, available, missing in (
            ("COMP_0874", "62.0", 11, 11, 1), ("COMP_0114", "56.7", 0, 7, 5),
        ):
            with self.subTest(company_id=company_id):
                data = load_company_data(company_id, SOURCE)
                data["company"]["alerts"].reverse()
                with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart, \
                        patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badges:
                    text = self.render(data)
                chart.assert_not_called()
                expected = [("DETERIORATION_CONFIRMED", "HIGH")]
                if company_id == "COMP_0114":
                    expected.append(("LOW_COVERAGE", "LOW"))
                    self.assertIn("0%", text)
                self.assertEqual([call.args[-2:] for call in badges.call_args_list], expected)
                for value in (score, f"{complete} / {available}", f"{available} meses operativos EUR observados",
                              "12 requeridos", f"{missing} por completar", "Escenario adverso no disponible"):
                    self.assertIn(value, text)
                self.assert_two_pages()
                self.assert_no_text_overlap()

    def test_uses_shared_signal_bars_by_component_key_and_preserves_precision(self):
        data = load_company_data("COMP_0216", SOURCE)
        data["company"]["signals"].reverse()
        with patch.object(ds, "draw_signal_bar", wraps=ds.draw_signal_bar) as bars:
            text = self.render(data, MOCK_NARRATIVE)
        self.assertEqual([call.args[-3] for call in bars.call_args_list], list(ds.COMPONENT_LABELS))
        self.assertEqual(bars.call_args_list[2].args[-2:], (-0.0231, -0.0036))
        self.assertIn("normalizados", text)
        self.assertIn("Ajuste de trayectoria", text)
        self.assertNotIn("-0.0000", text)

    def test_shows_reassurance_only_for_a_genuinely_empty_evaluated_alert_list(self):
        data = synthetic_data(values=[100] * 18)
        self.assertEqual(data["company"]["alerts"], [])
        narrative = simple_narrative(data) | {"que_vigilar": []}
        with patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badge:
            text = self.render(data, narrative)
        badge.assert_not_called()
        self.assertIn("Sin alertas activas", text)
        self.assertIn("No se identifican señales de riesgo inmediato", text)
        data["company"].pop("alerts")
        with self.assertRaises(ValueError):
            self.render(data, narrative)

    def test_preserves_stable_unconfirmed_and_insufficient_trajectories(self):
        for count, values in ((18, [100] * 18), (5, [80, 80, 100, 120, 140]), (3, [100] * 3), (0, [])):
            with self.subTest(count=count):
                data = synthetic_data(count, values=values)
                text = self.render(data)
                if count == 18:
                    self.assertIn("Estable", text)
                if count < 4:
                    self.assertIn("Datos insuficientes", text)
                self.assertIn("Sin confirmar", text)
                if not count:
                    self.assertIn("No calculado", text)
                    self.assertNotIn("0.0/100", text)
                    self.assertIn("Cobertura observada no disponible", text)
                self.assert_two_pages()
                self.assert_no_text_overlap()

    def test_keeps_the_chart_and_explicit_warning_for_low_confidence(self):
        data = synthetic_data(12)
        self.assertEqual(data["forecast"]["forecast_status"], "low_confidence")
        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart, \
                patch.object(template, "_panel", wraps=template._panel) as panels:
            text = self.render(data)
        chart.assert_called_once()
        self.assertTrue(any("Confianza baja" in call.args[2] for call in panels.call_args_list))
        self.assertIn("12 meses operativos", text)
        self.assertNotIn("confianza alta", text.lower())
        self.assert_two_pages()
        self.assert_no_text_overlap()

    def test_selects_the_earliest_adverse_minimum_and_never_calls_an_increase_a_fall(self):
        data = synthetic_data(values=[20] * 18)
        for scores in ([90.0, 85.0, 85.0], [data["company"]["final_score"]] * 3):
            forecast = copy.deepcopy(data["forecast"])
            forecast["scenarios"]["adverse"]["scores"] = scores
            for score, detail in zip(scores, forecast["scenarios"]["adverse"]["score_details"], strict=True):
                detail["final_score"] = score
            changed = data | {"forecast": forecast}
            text, sources = template._adverse_comparison(changed)
            index = 1 if scores[0] != scores[1] else 0
            self.assertIn(f"forecast:/scenarios/adverse/scores/{index}", sources)
            self.assertIn("company:/final_score", sources)
            self.assertIn("Nov 2026" if index else "Oct 2026", text)
            self.assertNotIn("bajar", text)
            self.assertNotIn("deterioro", text)
            self.assertIn("por encima" if index else "igual", text)
            with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart:
                rendered = self.render(changed)
            self.assertEqual(chart.call_args.args[-1], scores)
            self.assertIn("por encima" if index else "igual", rendered)
            self.assertNotIn("podría bajar", rendered)
            self.assert_two_pages()
            self.assert_no_text_overlap()

    def test_distinguishes_report_date_from_source_scoring_date(self):
        data = load_company_data("COMP_0216", SOURCE)
        text = self.render(data, MOCK_NARRATIVE, report_date="2026-09-20")
        self.assertIn("2026-09-20", text)
        self.assertIn("Fecha de evaluación: 2026-09-19", text)
        self.assert_two_pages()
        self.assert_no_text_overlap()

    def test_rejects_wrong_identity_role_missing_sections_and_unresolvable_evidence(self):
        data = load_company_data("COMP_0216", SOURCE)
        narrative = template._adapt_narrative(data, MOCK_NARRATIVE)
        cases = [narrative | {"company_id": "COMP_OTHER"}, narrative | {"role": "sales"},
                 narrative | {"sections": {}}, narrative | {"evidence": {}}]
        bad = copy.deepcopy(narrative)
        bad["evidence"]["sections.trend_summary"]["sources"] = ["company:/missing"]
        cases.append(bad)
        for bad in cases:
            with self.subTest(narrative=bad), self.assertRaises(ValueError):
                template.render_report(data, bad, self.output)
            self.assertFalse(self.output.exists())

    def test_rejects_missing_simple_fields_and_more_than_three_watch_items(self):
        for narrative in ({}, MOCK_NARRATIVE | {"que_vigilar": "Not a list"},
                          MOCK_NARRATIVE | {"que_vigilar": ["Métrica 1"] * 4},
                          MOCK_NARRATIVE | {"resumen_tendencia": ""}):
            with self.subTest(narrative=narrative), self.assertRaises(ValueError):
                template.render_tesorero("COMP_0216", SOURCE, self.output, narrative)
            self.assertFalse(self.output.exists())

    def test_refuses_missing_forecast_files_without_falling_back_to_another_snapshot(self):
        with self.assertRaisesRegex(ValueError, "Missing forecast"):
            template.render_tesorero("COMP_0216", ROOT / "results", self.output, MOCK_NARRATIVE)
        self.assertFalse(self.output.exists())

    def test_renders_long_supported_text_and_rejects_overflow_without_partial_files(self):
        data = synthetic_data(values=[100] * 18)
        narrative = simple_narrative(data)
        narrative["resumen_tendencia"] = "La lectura resume los periodos observados y no predice su continuidad. " * 4
        text = self.render(data, narrative)
        self.assertEqual(" ".join(text.split()).count("La lectura resume"), 4)
        self.assert_two_pages()
        self.assert_no_text_overlap()
        self.output.unlink()
        narrative["resumen_tendencia"] *= 100
        with self.assertRaisesRegex(ValueError, "no cabe|espacio|fit"):
            self.render(data, narrative)
        self.assertFalse(self.output.exists())

    def test_preserves_medium_stale_alerts_and_their_exact_trigger(self):
        periods = ([f"2024-{month:02d}" for month in (10, 11, 12)]
                   + [f"2025-{month:02d}" for month in range(1, 13)]
                   + [f"2026-{month:02d}" for month in (1, 2, 3)])
        data = synthetic_data(periods=periods, values=[100] * 18)
        with patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badges:
            text = self.render(data)
        self.assertIn(("STALE_DATA", "MEDIUM"), [call.args[-2:] for call in badges.call_args_list])
        self.assertIn("Mar 2026", text)
        self.assertIn("6 meses > umbral 3", text)
        self.assertNotIn("Sin alertas activas", text)
        self.assert_two_pages()
        self.assert_no_text_overlap()

    def test_rejects_empty_attention_items_when_actual_risks_are_present(self):
        with self.assertRaisesRegex(ValueError, "attention points"):
            template.render_tesorero("COMP_0216", SOURCE, self.output, MOCK_NARRATIVE | {"que_vigilar": []})
        self.assertFalse(self.output.exists())

    def test_rejects_unknown_refusal_reasons_instead_of_silently_rewording_them(self):
        data = load_company_data("COMP_0874", SOURCE)
        data["forecast"]["reason"] = "Unknown operational limitation"
        with self.assertRaisesRegex(ValueError, "faithful Spanish translation"):
            self.render(data)
        self.assertFalse(self.output.exists())

    def test_rejects_overlong_warnings_instead_of_truncating_them(self):
        data = load_company_data("COMP_0216", SOURCE)
        narrative = template._adapt_narrative(data, MOCK_NARRATIVE)
        narrative["sections"]["limitations"][0] *= 100
        with self.assertRaisesRegex(ValueError, "espacio"):
            template.render_report(data, narrative, self.output)
        self.assertFalse(self.output.exists())

    def test_does_not_mutate_inputs_or_render_on_import(self):
        data = load_company_data("COMP_0216", SOURCE)
        narrative = template._adapt_narrative(data, MOCK_NARRATIVE)
        before = copy.deepcopy((data, narrative))
        template.render_report(data, narrative, self.output)
        self.assertEqual((data, narrative), before)
        result = subprocess.run(
            [str(ROOT / ".venv/bin/python"), "-c", "import templates.template_tesorero"],
            cwd=self.temporary.name, env={"PYTHONPATH": str(ROOT)},
            check=True, capture_output=True, text=True,
        )
        self.assertEqual(result.stdout, "")
        self.assertEqual(list(Path(self.temporary.name).iterdir()), [self.output])


if __name__ == "__main__":
    unittest.main()
