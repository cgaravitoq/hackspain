from __future__ import annotations

import copy
import io
import json
import shutil
import socket
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from reportlab.pdfgen.canvas import Canvas
from test_copilot import artifacts

from templates import design_system as ds
from templates import pdf_utils as pu


class PdfUtilities(unittest.TestCase):
    def test_maps_continuous_score_boundaries_and_absence_without_gaps(self):
        for score, color in ((0, "#E53935"), (40, "#E53935"), (40.1, "#FFB300"),
                             (65, "#FFB300"), (65.1, "#00C9B1"), (85, "#00C9B1"),
                             (85.1, "#1DB954"), (100, "#1DB954"), (None, "#6B7280")):
            with self.subTest(score=score):
                self.assertEqual(pu.score_to_color(score), color)
        self.assertEqual(pu.format_score(None), "—")
        self.assertEqual(pu.format_score(0), "0.0")
        self.assertEqual(pu.format_score(77.4), "77.4")
        for invalid in (-1, 101, True, "77.4", float("nan"), float("inf"), -float("inf")):
            for function in (pu.score_to_color, pu.format_score):
                with self.subTest(value=invalid, function=function), self.assertRaises(ValueError):
                    function(invalid)

    def test_translates_all_enums_and_months_without_locale_dependencies(self):
        for value, expected in (("improving", "Mejorando"), ("deteriorating", "Empeorando"),
                                ("stable", "Estable"), ("insufficient_data", "Datos insuficientes")):
            self.assertEqual(pu.trajectory_to_spanish(value), expected)
        for value, expected in (("confirmed", "Confirmada"), ("unconfirmed", "Sin confirmar")):
            self.assertEqual(pu.persistence_to_spanish(value), expected)
        for value in (None, "unknown", [], {}):
            self.assertEqual(pu.trajectory_to_spanish(value), "No disponible")
            self.assertEqual(pu.persistence_to_spanish(value), "No disponible")
        for month, label in enumerate(("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"), 1):
            self.assertEqual(pu.months_to_spanish(f"2026-{month:02d}"), f"{label} 2026")
        for invalid in (None, "2026-00", "2026-13", "0000-01", "2026-6", "2026-06-01", "2026-06\n"):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                pu.months_to_spanish(invalid)

    def test_nested_access_preserves_zero_false_and_empty_values(self):
        for value in (0, False, [], ""):
            self.assertEqual(pu.safe_get({"a": {"b": value}}, "a", "b"), value)
        for document in ({}, {"a": None}, {"a": []}, {"a": {"b": None}}, None):
            self.assertEqual(pu.safe_get(document, "a", "b"), "—")
            self.assertEqual(pu.safe_get(document, "a", "b", default="missing"), "missing")


class ArtifactLoading(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.company, cls.forecast = artifacts()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "companies").mkdir()
        (self.root / "forecasts").mkdir()
        self.no_network = patch.object(socket, "create_connection", side_effect=AssertionError("network"))
        self.no_network.start()
        self.addCleanup(self.no_network.stop)

    def write_pair(self, company=None, forecast=None, suffix=""):
        company = self.company if company is None else company
        forecast = self.forecast if forecast is None else forecast
        (self.root / "companies/COMP_TEST.json").write_text(json.dumps(company), encoding="utf-8")
        path = self.root / f"forecasts/COMP_TEST{suffix}.json"
        path.write_text(json.dumps(forecast), encoding="utf-8")
        return path

    def test_loads_both_filename_conventions_with_absolute_source_paths(self):
        for suffix in ("", "_forecast"):
            with self.subTest(suffix=suffix):
                path = self.write_pair(suffix=suffix)
                loaded = pu.load_company_data("COMP_TEST", self.root)
                self.assertEqual(loaded["company"], self.company)
                self.assertEqual(loaded["forecast"], self.forecast)
                self.assertEqual(loaded["source_paths"]["forecast"], str(path))
                self.assertEqual(loaded["source_paths"]["results_dir"], str(self.root))
                self.assertTrue(all(Path(p).is_absolute() for p in loaded["source_paths"].values()))
                self.assertEqual(json.loads(path.read_text()), self.forecast)
                path.unlink()

    def test_accepts_equivalent_duplicates_and_rejects_conflicting_forecasts(self):
        self.write_pair()
        preferred = self.write_pair(suffix="_forecast")
        self.assertEqual(pu.load_company_data("COMP_TEST", self.root)["source_paths"]["forecast"], str(preferred))
        self.write_pair(forecast=self.forecast | {"reason": "conflicting artifact"}, suffix="_forecast")
        with self.assertRaisesRegex(ValueError, "[Aa]mbigu|[Cc]onflict"):
            pu.load_company_data("COMP_TEST", self.root)

    def test_missing_forecasts_are_errors_not_insufficient_data(self):
        (self.root / "companies/COMP_TEST.json").write_text(json.dumps(self.company))
        with self.assertRaisesRegex(ValueError, "forecast|[Pp]royección"):
            pu.load_company_data("COMP_TEST", self.root)

    def test_preserves_valid_refusals_and_unmeasured_scores(self):
        for count in (0, 7, 11):
            company, forecast = artifacts(count)
            self.write_pair(company, forecast)
            result = pu.load_company_data("COMP_TEST", self.root)
            self.assertEqual(result["forecast"]["forecast_status"], "insufficient_data")
            self.assertIsNone(result["forecast"]["scenarios"])
            self.assertEqual(result["forecast"]["months_missing"], 12 - count)
            self.assertEqual(result["company"]["final_score"], company["final_score"])

    def test_rejects_unsafe_ids_symlinks_and_mismatched_identity(self):
        self.write_pair()
        for company_id in ("../COMP_TEST", "/tmp/COMP_TEST", "COMP_TEST/other", "", None):
            with self.subTest(company_id=company_id), self.assertRaises(ValueError):
                pu.load_company_data(company_id, self.root)
        self.write_pair(company=self.company | {"company_id": "COMP_OTHER"})
        with self.assertRaises(ValueError):
            pu.load_company_data("COMP_TEST", self.root)
        self.write_pair()
        (self.root / "forecasts/COMP_TEST_forecast.json").symlink_to(self.root / "forecasts/COMP_TEST.json")
        with self.assertRaises(ValueError):
            pu.load_company_data("COMP_TEST", self.root)

    def test_rejects_non_objects_duplicate_keys_and_nonfinite_json(self):
        self.write_pair()
        for text in ('[]', 'null', '{"a":1,"a":2}', '{"a":NaN}', '{"a":1e999}', '{'):
            (self.root / "companies/COMP_TEST.json").write_text(text)
            with self.subTest(text=text), self.assertRaises(ValueError):
                pu.load_company_data("COMP_TEST", self.root)

    def test_reuses_v2_consistency_checks_and_requires_evidence(self):
        cases = [("company", {"rule_version": "v1.0.0"}),
                 ("company", {"alerts": None}), ("company", {"evidence_records": {}}),
                 ("forecast", {"scoring_date": "2026-09-18"}),
                 ("forecast", {"data_cutoff": "2026-08-01"}),
                 ("forecast", {"latest_observed_month": "2026-07"})]
        for target, updates in cases:
            company, forecast = copy.deepcopy((self.company, self.forecast))
            (company if target == "company" else forecast).update(updates)
            self.write_pair(company, forecast)
            with self.subTest(target=target, updates=updates), self.assertRaises(ValueError):
                pu.load_company_data("COMP_TEST", self.root)
        for field in ("weights", "observed_window_usage", "windows", "comparison_horizons"):
            forecast = copy.deepcopy(self.forecast)
            forecast["provenance"][field] = {}
            self.write_pair(forecast=forecast)
            with self.assertRaises(ValueError):
                pu.load_company_data("COMP_TEST", self.root)
        company, forecast = artifacts(1)
        company["alerts"][0]["evidence"][0]["value"] = "stale evidence"
        self.write_pair(company, forecast)
        with self.assertRaises(ValueError):
            pu.load_company_data("COMP_TEST", self.root)

    def test_matches_configured_forecast_horizons_to_observed_windows_and_version(self):
        updates = {
            "windows": self.forecast["provenance"]["windows"] | {"short": 6},
            "comparison_horizons": self.forecast["provenance"]["comparison_horizons"] | {"primary": "long"},
        }
        for field, value in updates.items():
            forecast = copy.deepcopy(self.forecast)
            forecast["provenance"][field] = value
            self.write_pair(forecast=forecast)
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "configuration"):
                pu.load_company_data("COMP_TEST", self.root)

    def test_rejects_malformed_forecast_arrays_even_when_they_are_empty(self):
        company, forecast = artifacts(7)
        for field in ("forecast_months", "training_periods", "backtest_periods", "backtest_training_periods"):
            self.write_pair(company, forecast | {field: {}})
            with self.subTest(field=field), self.assertRaises(ValueError):
                pu.load_company_data("COMP_TEST", self.root)
        forecast = copy.deepcopy(self.forecast)
        forecast["scenarios"]["base"]["scores"] = {"0": 50, "1": 50, "2": 50}
        self.write_pair(forecast=forecast)
        with self.assertRaises(ValueError):
            pu.load_company_data("COMP_TEST", self.root)

    def test_validates_the_three_selected_real_pairs_without_mutation(self):
        root = Path(__file__).resolve().parents[1] / "results-v2-agent6-20260919"
        for company_id in ("COMP_0216", "COMP_0874", "COMP_0114"):
            paths = [root / folder / f"{company_id}.json" for folder in ("companies", "forecasts")]
            before = [path.read_bytes() for path in paths]
            result = pu.load_company_data(company_id, root)
            self.assertEqual(result["company"]["company_id"], company_id)
            self.assertEqual([path.read_bytes() for path in paths], before)


def render_component_smoke(output_path):
    c = Canvas(str(output_path), pagesize=ds.PAGE_SIZE)
    ds.draw_header(c, "COMP_TEST", "Componentes compartidos", "TESORERO", "2026-09-19")
    ds.draw_footer(c, 1, 2)
    ds.draw_section_header(c, 48, 726, 499, "Salud de tesorería · política visual")
    ds.draw_score_gauge(c, 48, 572, 77.4, "Salud de Tesorería")
    ds.draw_score_gauge(c, 331, 572, None, "Sin medición disponible")
    for index, (delta, value) in enumerate((("+10.0", "77.4"), (-10, "62.0"), (0, "0.0"))):
        ds.draw_kpi_box(c, 48 + index * (ds.KPI_COLUMN_WIDTH + 16), 464,
                        ds.KPI_COLUMN_WIDTH, 92, "Ajuste de trayectoria", value, delta, ds.ACCENT)
    signals = [("inflow_outflow_ratio", 5.0495, 1.583), ("chargeback_score", 4.1797, 0.8189),
               ("fee_score", -0.0231, -0.0036), ("debt_score", 0, 0)]
    for index, (component, change, contribution) in enumerate(signals):
        ds.draw_signal_bar(c, 48, 394 - index * ds.SIGNAL_BAR_HEIGHT, ds.COLUMN_WIDTH,
                           component, change, contribution)
    ds.draw_limitations_box(c, 305.5, 282, ds.COLUMN_WIDTH, [
        "Transferencias excluidas: no se distingue su alcance interno o externo.",
        "La cobertura observada no mide la confianza de la previsión.",
        "Texto literal seguro: <b>sin formato</b> & acentos, ñ y puntuación — EUR.",
    ])
    for index, (alert, severity) in enumerate((("DETERIORATION_CONFIRMED", "HIGH"),
                                             ("STALE_DATA", "MEDIUM"), ("LOW_COVERAGE", "LOW"),
                                             ("INSUFFICIENT_DATA", "INFO"), ("DRIFT_DETECTED", "UNKNOWN"))):
        ds.draw_alert_badge(c, 48 + index % 3 * 166, 168 - index // 3 * 44, alert, severity)
    ds.draw_confidence_bar(c, 48, 72, ds.COLUMN_WIDTH, 0, 7)
    ds.draw_confidence_bar(c, 305.5, 72, ds.COLUMN_WIDTH, 1, 20)
    c.showPage()
    ds.draw_header(c, "COMP_TEST", "Escenarios y texto", "FINANCIERO / ANALISTA", "2026-09-19")
    ds.draw_footer(c, 2, 2)
    ds.draw_section_header(c, 48, 726, 499, "Escenarios que se cruzan · datos sintéticos")
    months = ["2026-10", "2026-11", "2026-12"]
    ds.draw_forecast_chart(c, 48, 436, 499, 274, months, [69.4, 80.2, 67.4], [90, 40, 75], [30, 80, 60])
    ds.draw_section_header(c, 48, 392, 499, "Solo escenario base · sin banda ni escenarios ficticios")
    ds.draw_forecast_chart(c, 48, 200, 499, 180, months, [69.4, 80.2, 67.4], None, None)
    ds.draw_limitations_box(c, 48, 68, 499, [
        ("Los escenarios son condicionales, no intervalos de confianza ni saldos de caja. "
         "Conservan su identidad aunque cambie su orden; no son promesas ni probabilidades de impago."),
        ("Solo EUR — actividad en otras divisas excluida. Las cifras sin categoría del conjunto "
         "del sistema no representan el recuento de una empresa concreta."),
        "No se omiten advertencias extensas para ajustar el diseño; se mide todo el texto antes de dibujarlo.",
    ])
    c.save()
    return str(Path(output_path).resolve())


class PdfDrawing(unittest.TestCase):
    def setUp(self):
        self.canvas = Canvas(io.BytesIO(), pagesize=ds.PAGE_SIZE, pageCompression=0)

    def test_fixed_geometry_and_all_helpers_preserve_canvas_state(self):
        self.assertEqual(ds.PAGE_SIZE, (595, 842))
        self.assertEqual(ds.CONTENT_WIDTH, 499)
        self.assertEqual(ds.COLUMN_WIDTH, 241.5)
        self.assertEqual((ds.GAUGE_WIDTH, ds.GAUGE_HEIGHT), (200, 140))
        self.assertEqual(ds.SECTION_HEADER_HEIGHT, 28)
        calls = [
            (ds.draw_header, ("COMP_TEST", "Prueba", "TESORERO", "2026-09-19")),
            (ds.draw_footer, (1, 2)), (ds.draw_score_gauge, (48, 500, 77.4, "Tesorería")),
            (ds.draw_section_header, (48, 400, 499, "Sección")),
            (ds.draw_kpi_box, (48, 300, 150, 90, "Score", "77.4", None, ds.ACCENT)),
            (ds.draw_signal_bar, (48, 230, 241.5, "fee_score", -0.0231, -0.0036)),
            (ds.draw_forecast_chart, (48, 300, 499, 200, ["2026-10"], [77.4], None, None)),
            (ds.draw_alert_badge, (48, 200, "LOW_COVERAGE", "LOW")),
            (ds.draw_confidence_bar, (48, 150, 499, 1, 9)),
            (ds.draw_limitations_box, (48, 80, 499, ["Precaución."])),
        ]
        self.canvas.setFont("Courier", 17)
        self.canvas.setLineWidth(3)
        before = self.canvas._fontname, self.canvas._fontsize, self.canvas._lineWidth
        with patch.object(self.canvas, "showPage") as page, patch.object(self.canvas, "save") as save:
            for function, args in calls:
                with self.subTest(function=function.__name__):
                    self.assertGreater(function(self.canvas, *args), 0)
                    self.assertEqual((self.canvas._fontname, self.canvas._fontsize, self.canvas._lineWidth), before)
                    self.assertEqual(len(self.canvas.state_stack), 0)
            page.assert_not_called()
            save.assert_not_called()

    def test_absent_score_has_no_needle_and_zero_has_a_real_needle(self):
        with patch.object(self.canvas, "drawPath", wraps=self.canvas.drawPath) as paths:
            ds.draw_score_gauge(self.canvas, 48, 500, None, "Tesorería")
            self.assertEqual(paths.call_count, 0)
        with patch.object(self.canvas, "drawPath", wraps=self.canvas.drawPath) as paths:
            ds.draw_score_gauge(self.canvas, 48, 500, 0, "Tesorería")
            self.assertEqual(paths.call_count, 1)

    def test_base_only_chart_has_no_band_or_extra_scenario_lines(self):
        with patch.object(self.canvas, "drawPath", wraps=self.canvas.drawPath) as paths, \
                patch.object(self.canvas, "lines", wraps=self.canvas.lines) as lines:
            ds.draw_forecast_chart(self.canvas, 48, 100, 499, 240,
                                   ["2026-10", "2026-11", "2026-12"], [69.4, 80.2, 67.4], None, None)
            paths.assert_not_called()
            self.assertEqual(lines.call_count, 1)

    def test_crossing_scenarios_keep_their_own_values_and_split_the_band(self):
        with patch.object(self.canvas, "lines", wraps=self.canvas.lines) as lines, \
                patch.object(self.canvas, "drawPath", wraps=self.canvas.drawPath) as paths:
            ds.draw_forecast_chart(self.canvas, 48, 100, 499, 240,
                                   ["2026-10", "2026-11"], [50, 50], [90, 10], [10, 90])
            self.assertEqual(lines.call_count, 3)
            favorable = lines.call_args_list[1].args[0][0]
            adverse = lines.call_args_list[2].args[0][0]
            self.assertGreater(favorable[1], favorable[3])
            self.assertLess(adverse[1], adverse[3])
            fills = [call for call in paths.call_args_list if call.kwargs.get("stroke") == 0]
            self.assertEqual(len(fills), 2)

    def test_chart_rejects_invalid_arrays_chronology_numbers_and_half_missing_scenarios(self):
        for months, base, favorable, adverse in (([], [], None, None), (["2026-10"], [], None, None),
                (["2026-10", "2026-10"], [50, 60], None, None),
                (["2026-11", "2026-10"], [50, 60], None, None),
                (["2026-13"], [50], None, None), (["2026-10"], [101], None, None),
                (["2026-10"], [float("nan")], None, None), (["2026-10"], [True], None, None),
                (["2026-10"], [50], [60], None)):
            before = list(self.canvas._code)
            with self.subTest(months=months, base=base), self.assertRaises(ValueError):
                ds.draw_forecast_chart(self.canvas, 48, 100, 499, 240, months, base, favorable, adverse)
            self.assertEqual(self.canvas._code, before)

    def test_coverage_uses_a_fraction_and_preserves_exact_percentages(self):
        for fraction in (0, 1, 0.2487):
            with patch.object(self.canvas, "roundRect", wraps=self.canvas.roundRect) as boxes:
                ds.draw_confidence_bar(self.canvas, 48, 100, 499, fraction, 9)
                self.assertEqual(boxes.call_count, 1 if fraction == 0 else 2)
                if fraction:
                    self.assertAlmostEqual(boxes.call_args.args[2], 499 * fraction)
        for invalid in (-0.1, 100, True, None, float("nan")):
            with self.assertRaises(ValueError):
                ds.draw_confidence_bar(self.canvas, 48, 100, 499, invalid, 9)

    def test_small_negative_signals_keep_their_magnitude_and_zero_is_not_directional(self):
        for change, contribution in ((-0.0231, -0.0036), (-0.000001, -0.000001), (0, 0)):
            with patch.object(self.canvas, "rect", wraps=self.canvas.rect) as rectangles:
                ds.draw_signal_bar(self.canvas, 48, 100, 241.5, "fee_score", change, contribution)
                self.assertEqual(rectangles.call_count, 0 if change == 0 else 1)
                if change:
                    self.assertAlmostEqual(rectangles.call_args.args[2], abs(change) / 100 * (241.5 - 120) / 2)
        code = " ".join(self.canvas._code)
        self.assertIn("-0.0036", code)
        self.assertNotIn("-0.0000", code)

    def test_measures_all_long_text_and_rejects_overflow_instead_of_clipping(self):
        text = "Se conserva cada advertencia y su alcance: transferencias, actividad EUR y cobertura observada. " * 4
        limitations = [text, "<b>Texto literal</b> & puntuación — ñ."]
        height = ds.measure_limitations_box(241.5, limitations)
        self.assertGreater(height, ds.measure_limitations_box(499, limitations))
        self.assertEqual(ds.draw_limitations_box(self.canvas, 48, 60, 241.5, limitations), height)
        with self.assertRaises(ValueError):
            ds.draw_section_header(self.canvas, 48, 700, 100, text)
        for invalid in ("Control\x00", "Dirección\u202e", "Unsupported \u2603"):
            with self.assertRaises(ValueError):
                ds.measure_text(invalid, 499)
        self.assertEqual(len(self.canvas.state_stack), 0)

    def test_footer_draws_the_exact_confidentiality_and_page_labels(self):
        with patch.object(self.canvas, "drawString", wraps=self.canvas.drawString) as left, \
                patch.object(self.canvas, "drawRightString", wraps=self.canvas.drawRightString) as right:
            ds.draw_footer(self.canvas, 1, 2)
            left.assert_called_once_with(48, 30, "Generado por Embat · Confidencial")
            right.assert_called_once_with(547, 30, "1 / 2")

    def test_rejects_too_narrow_text_and_restores_state_after_rendering_errors(self):
        with self.assertRaises(ValueError):
            ds.measure_text("W", 1)
        self.canvas.setLineWidth(7)
        with patch.object(self.canvas, "rect", side_effect=RuntimeError("render failure")), self.assertRaises(RuntimeError):
            ds.draw_section_header(self.canvas, 48, 700, 499, "Sección")
        self.assertEqual(self.canvas._lineWidth, 7)
        self.assertEqual(len(self.canvas.state_stack), 0)

    @unittest.skipUnless(shutil.which("pdftotext") and shutil.which("pdfinfo"), "Poppler is needed for independent PDF inspection")
    def test_renders_every_component_as_two_readable_pages_with_spanish_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "components.pdf"
            render_component_smoke(path)
            info = subprocess.run(["pdfinfo", str(path)], check=True, capture_output=True, text=True).stdout
            text = subprocess.run(["pdftotext", str(path), "-"], check=True, capture_output=True, text=True).stdout
            self.assertRegex(info, r"Pages:\s+2\b")
            self.assertRegex(info, r"Page size:\s+595 x 842 pts")
            self.assertRegex(text, r"1\s*/\s*2")
            self.assertRegex(text, r"2\s*/\s*2")
            for expected in ("Generado por Embat · Confidencial", "No calculado", "77.4", "0%", "100%",
                             "HIGH", "MEDIUM", "LOW", "INFO", "Desconocida", "Cobertura baja", "<b>sin formato</b>",
                             "Cambio", "Ajuste", "normalizados", "Base", "Favorable", "Adverso", "Oct 2026", "Dic 2026"):
                self.assertIn(expected, text)
            self.assertNotIn("■", text)
            self.assertNotIn("confianza alta", text)


if __name__ == "__main__":
    unittest.main()
