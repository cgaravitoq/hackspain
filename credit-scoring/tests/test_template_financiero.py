from __future__ import annotations

import copy
import re
import socket
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_copilot import artifacts

from src.copilot import _limitation_sources, pointer_value
from templates import design_system as ds
from templates import template_financiero as tf
from templates.pdf_utils import load_company_data

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results-v2-agent6-20260919"
MOCK_NARRATIVE = {
    "interpretacion_componentes": (
        "La base 67.4 pondera el nivel reciente: entradas/salidas pesa 40%, pero "
        "devoluciones aporta más puntos base (25.0000). El ajuste confirmado +10.0 "
        "es independiente: deuda aporta +7.6017 al ajuste y 10.4818 a la base."
    ),
    "interpretacion_forecast": (
        "La regresión gana en devoluciones y comisiones; naive en entradas/salidas "
        "y deuda. Tres observaciones reservadas seleccionan el método; no son validación externa."
    ),
    "nota_limitaciones": (
        "La ventana de evidencia mar–ago 2026 incluye 2.105 transacciones. "
        "El artefacto registra 3.430 excluidas sin categoría; no permite deducir "
        "un porcentaje de exclusión sobre todo el historial."
    ),
}


def narrative_for(data):
    return tf._prepare_narrative(data, {
        "interpretacion_componentes": "La base ponderada y el ajuste confirmado son magnitudes distintas.",
        "interpretacion_forecast": "La selección por MAE reservado no constituye validación externa.",
        "nota_limitaciones": "Las exclusiones y la cobertura describen evidencia, no riesgo crediticio.",
    })


class FinancialTemplate(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.output = Path(self.directory.name) / "financial.pdf"
        self.data = load_company_data("COMP_0216", RESULTS)
        network = patch.object(socket, "create_connection", side_effect=AssertionError("network"))
        network.start()
        self.addCleanup(network.stop)

    def extracted(self):
        return subprocess.run(["pdftotext", "-layout", str(self.output), "-"],
                              check=True, capture_output=True, text=True).stdout

    def test_joins_signals_by_key_and_keeps_base_and_adjustment_attribution_separate(self):
        self.data["company"]["signals"].reverse()
        rows = tf._component_rows(self.data)
        self.assertEqual(rows[-1][2], "10.4818")
        self.assertIn("69.8785", rows[-1][0])
        self.assertIn("+64.6623", rows[-1][3])
        self.assertNotIn("7.6017", rows[-1][2])
        adjustments = tf._adjustment_rows(self.data)
        self.assertEqual(adjustments[-1][1], "+7.6017")

    def test_method_table_preserves_real_zero_and_uses_full_precision_winners(self):
        rows = tf._method_rows(self.data)
        self.assertEqual(rows[1][2], "0.0000")
        comparison = self.data["forecast"]["baseline_vs_regression"]["fee_score"]
        comparison.update(regression_mae=0.813541, naive_mae=0.813549)
        rows = tf._method_rows(self.data)
        self.assertEqual(rows[2][2], rows[2][3])
        self.assertEqual(rows[2][-1], "Regresión")
        comparison.update(naive_mae=comparison["regression_mae"], winner="naive")
        self.data["forecast"]["method_per_component"]["fee_score"] = "naive"
        self.assertEqual(tf._method_rows(self.data)[2][-1], "Naive")
        self.data["forecast"]["method_per_component"]["fee_score"] = "regression"
        with self.assertRaises(ValueError):
            tf.render_report(self.data, narrative_for(self.data), self.output)

    def test_narrative_maps_every_limitation_source_and_all_grouped_scenario_months(self):
        payload = narrative_for(self.data)
        expected = {f"{name}:{pointer}" for name in ("company", "forecast")
                    for pointer, _ in _limitation_sources(self.data[name])}
        actual = {source for key, item in payload["evidence"].items()
                  if key.startswith("sections.limitations[") for source in item["sources"]}
        self.assertTrue(expected.issubset(actual))
        for item in payload["evidence"].values():
            self.assertTrue(item["operation"])
            for source in item["sources"]:
                name, pointer = source.split(":", 1)
                pointer_value(self.data[name], pointer)
        text = " ".join(payload["sections"]["limitations"])
        for value in ("base", "favorable", "adverso", "2026-10", "2026-11", "2026-12", "0.001"):
            self.assertIn(value, text)
        payload["evidence"]["sections.limitations[0]"]["sources"] = ["company:/company_id"]
        with self.assertRaisesRegex(ValueError, "limitation|limitaci"):
            tf.render_report(self.data, payload, self.output)

    def test_renders_the_requested_mock_as_two_a4_pages_over_40_kib(self):
        before = copy.deepcopy(self.data)
        result = tf.render_financiero("COMP_0216", RESULTS, self.output, MOCK_NARRATIVE)
        self.assertEqual(result, str(self.output.resolve()))
        self.assertGreater(self.output.stat().st_size, 40 * 1024)
        info = subprocess.run(["pdfinfo", str(self.output)], check=True, capture_output=True, text=True).stdout
        self.assertRegex(info, r"Pages:\s+2\b")
        self.assertIn("595 x 842", info)
        text = self.extracted()
        for value in ("FINANCIERO / ANALISTA", "Scoring detallado", "Predicción y validación",
                      "10.4818", "+7.6017", "67.4", "77.4", "2.105", "3.430", "media",
                      "DRIFT_DETECTED", "MEDIUM", "v2.0.0-w3-h9", "forecast-v1.0.0",
                      "alerts-v1.0.0", "Confidencial"):
            self.assertIn(value, text)
        for page in (1, 2):
            self.assertRegex(text, rf"\b{page}\s*/\s*2\b")
        self.assertNotIn("■", text)
        self.assertNotIn("confianza alta", text)
        self.assertEqual(before, self.data)

    def test_unavailable_forecasts_and_zero_coverage_do_not_become_fictional_measurements(self):
        for company in ("COMP_0874", "COMP_0114"):
            data = load_company_data(company, RESULTS)
            with self.subTest(company=company), patch.object(ds, "draw_forecast_chart") as chart:
                tf.render_report(data, narrative_for(data), self.output)
                chart.assert_not_called()
                text = self.extracted()
                self.assertIn("No calculado: historial insuficiente", text)
                self.assertIn("no calculada", text)
                self.assertIn("Ventana acortada: sí", text)
                self.assertIn(f"Faltan {data['forecast']['months_missing']}", text)
                self.assertEqual(tf._method_rows(data)[0][2:], ("—", "—", "—"))
        self.assertIn("0%", text)
        self.assertIn("Meses completos", text)

    def test_chart_receives_exact_scenarios_and_forecast_confidence_is_not_coverage(self):
        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart:
            tf.render_report(self.data, narrative_for(self.data), self.output)
        args = chart.call_args.args
        self.assertEqual(args[-4], ["2026-10", "2026-11", "2026-12"])
        self.assertEqual(args[-3], [69.4, 80.2, 67.4])
        self.assertEqual(args[-2], [73.9, 89.4, 91.2])
        self.assertEqual(args[-1], [63.5, 58.4, 49.7])
        self.assertIn("Confianza de la predicción: media", self.extracted())

    def test_rejects_invalid_narratives_and_overflow_before_creating_an_output(self):
        good = narrative_for(self.data)
        bad = [good | {"company_id": "OTHER"}, good | {"role": "sales"}, good | {"sections": {}},
               good | {"evidence": {}}]
        for payload in bad:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                tf.render_report(self.data, payload, self.output)
            self.assertFalse(self.output.exists())
        good["sections"]["limitations"][0] *= 100
        with self.assertRaisesRegex(ValueError, "fit|overflow|caben|desbordamiento"):
            tf.render_report(self.data, good, self.output)
        self.assertFalse(self.output.exists())

    def test_low_confidence_and_missing_optional_parameters_are_explicit(self):
        company, forecast = artifacts(12)
        data = {"company": company, "forecast": forecast}
        forecast["provenance"].pop("std_ddof")
        forecast["provenance"].pop("evaluation_frequency")
        tf.render_report(data, narrative_for(data), self.output)
        text = self.extracted()
        self.assertIn("Confianza de la predicción: baja", text)
        self.assertIn("12 meses", text)
        self.assertIn("No consta en el artefacto", text)

    def test_projection_audit_copies_dispersion_and_each_clipping_flag(self):
        rows = tf._projection_component_rows(self.data)
        self.assertEqual(rows[1], ("Devoluciones", "12.1154", "sí", "no", "sí", "no", "sí", "no"))
        self.assertEqual(rows[3], ("Servicio de deuda", "36.2810", "sí", "no", "no", "no", "sí", "no"))
        for company in ("COMP_0874", "COMP_0114"):
            rows = tf._projection_component_rows(load_company_data(company, RESULTS))
            self.assertTrue(all(row[1:] == ("—",) * 7 for row in rows))

    def test_lossless_grouping_covers_each_source_once_for_every_demo_and_short_history(self):
        cases = [load_company_data(company, RESULTS) for company in ("COMP_0216", "COMP_0874", "COMP_0114")]
        company, forecast = artifacts(12)
        cases.append({"company": company, "forecast": forecast})
        for data in cases:
            entries = tf._limitation_entries(data)
            sources = [pointer for _, pointers in entries for pointer in pointers]
            expected = {f"{name}:{pointer}" for name in ("company", "forecast")
                        for pointer, _ in _limitation_sources(data[name])}
            self.assertEqual(set(sources), expected)
            self.assertEqual(len(sources), len(expected))
        grouped = next(text for text, _ in entries if "Deriva acortada:" in text)
        for month, sizes in (("2026-10", "9/4"), ("2026-11", "9/5"), ("2026-12", "9/6")):
            self.assertIn(f"base, favorable, adverso ({month}): {sizes}", grouped)
        self.assertIn("observada 9/3", grouped)

    def test_missing_optional_range_and_absent_score_remain_unavailable_not_zero(self):
        company, forecast = artifacts(0)
        data = {"company": company, "forecast": forecast}
        company["evidence_records"].pop("date_range")
        tf.render_report(data, narrative_for(data), self.output)
        text = self.extracted()
        self.assertIn("No calculado", text)
        self.assertIn("Cobertura observada: no calculada", text)
        self.assertIn("No consta en el artefacto", text)
        self.assertNotIn("Score final: 0.0", text)

    def test_training_ranges_never_hide_calendar_gaps(self):
        self.assertEqual(tf._periods(["2025-01", "2025-02", "2025-04", "2025-05", "2025-08"]),
                         "2025-01 a 2025-02; 2025-04 a 2025-05; 2025-08")
        self.assertEqual(tf._periods(["2026-06", "2026-07", "2026-08"], False),
                         "2026-06, 2026-07, 2026-08")

    def test_keeps_caller_data_unchanged_and_uses_explicit_report_date_without_hiding_scoring_date(self):
        narrative = narrative_for(self.data)
        before = copy.deepcopy((self.data, narrative))
        tf.render_report(self.data, narrative, self.output, report_date="2026-10-03")
        self.assertEqual(before, (self.data, narrative))
        text = self.extracted()
        self.assertEqual(text.count("2026-10-03"), 2)
        self.assertIn("Scoring: 2026-09-19", text)

    def test_unknown_limitations_and_unsafe_text_fail_instead_of_being_omitted(self):
        self.data["company"]["limitations"].append("A previously unknown caveat")
        self.data["forecast"]["limitations"].append("A previously unknown caveat")
        with self.assertRaisesRegex(ValueError, "translation"):
            narrative_for(self.data)
        data = load_company_data("COMP_0216", RESULTS)
        narrative = narrative_for(data)
        narrative["sections"]["score_explanation"] = "Unsafe" + chr(0) + "text"
        with self.assertRaises(ValueError):
            tf.render_report(data, narrative, self.output)
        self.assertFalse(self.output.exists())

    def test_overflow_does_not_replace_an_existing_pdf(self):
        self.output.write_bytes(b"previous report")
        narrative = narrative_for(self.data)
        narrative["sections"]["limitations"][0] *= 100
        with self.assertRaisesRegex(ValueError, "overflow"):
            tf.render_report(self.data, narrative, self.output)
        self.assertEqual(self.output.read_bytes(), b"previous report")

    def test_tables_and_chart_audit_pointers_resolve_to_the_copied_source_fields(self):
        narrative = narrative_for(self.data)
        evidence = narrative["evidence"]
        self.assertIn("company:/component_summary/debt_score/base_contribution", evidence["tables.components[3]"]["sources"])
        self.assertIn("company:/signals/3/contribution", evidence["tables.adjustments[3]"]["sources"])
        for name in tf.TABLE_SCHEMAS:
            self.assertTrue(any(key.startswith(f"tables.{name}") for key in evidence))
        self.assertIn("forecast:/scenarios", evidence["chart.scenarios"]["sources"])
        evidence["chart.scenarios"]["sources"] = ["forecast:/missing/scenarios"]
        with self.assertRaises(ValueError):
            tf.render_report(self.data, narrative, self.output)

    def test_importing_the_module_does_not_render_any_reports(self):
        subprocess.run([str(ROOT / ".venv/bin/python"), "-B", "-c",
                        f"import sys; sys.path.insert(0, {str(ROOT)!r}); import templates.template_financiero"],
                       cwd=self.directory.name, check=True, capture_output=True)
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_all_content_stays_in_the_frame_with_no_text_smaller_than_eight_points(self):
        tf.render_report(self.data, narrative_for(self.data), self.output)
        xml = subprocess.run(["pdftotext", "-bbox", str(self.output), "-"],
                             check=True, capture_output=True, text=True).stdout
        for x0, y0, x1, y1, _ in re.findall(
                r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', xml):
            self.assertGreaterEqual(float(x0), 47)
            self.assertLessEqual(float(x1), 548)
            if 65 < float(y0) < 793:
                self.assertGreaterEqual(float(y0), 79)
                self.assertLessEqual(float(y1), 783)
        for page in re.findall(r"<page\b.*?</page>", xml, re.DOTALL):
            words = [tuple(map(float, match)) for match in re.findall(
                r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">', page)]
            for index, (x0, y0, x1, y1) in enumerate(words):
                for other_x0, other_y0, other_x1, other_y1 in words[index + 1:]:
                    overlap_x = min(x1, other_x1) - max(x0, other_x0)
                    overlap_y = min(y1, other_y1) - max(y0, other_y0)
                    self.assertFalse(overlap_x > 0.5 and overlap_y > 0.5, "Overlapping PDF text")
        raw = self.output.read_bytes()
        sizes = [float(value) for value in re.findall(rb"/F\d+ ([\d.]+) Tf", raw)]
        self.assertTrue(sizes)
        self.assertGreaterEqual(min(sizes), 8)


if __name__ == "__main__":
    unittest.main()
