from __future__ import annotations

import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import replace
from datetime import date
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

from test_score_engine import CONFIG, CUTOFF, NO_EXCLUSIONS, SCORING_DATE, features, ramp
from src import data_pipeline as dp
from src import score_engine as se
from src import forecaster as fc
import run_forecast


def fixture(count, periods=None, values=None, config=CONFIG, scoring_date=SCORING_DATE):
    periods = pd.PeriodIndex(periods, freq="M") if periods is not None else pd.period_range(
        end="2026-08", periods=count, freq="M"
    )
    values = values if values is not None else np.linspace(60, 140, count)
    frame = features(dict(ramp(list(periods.astype(str)), values)))
    frame.index = pd.PeriodIndex(frame.index, freq="M", name="period")
    dataset = dp.Dataset(
        pd.concat({"COMP_TEST": frame}, names=["company_id"]),
        pd.DataFrame([NO_EXCLUSIONS], index=["COMP_TEST"]),
        {"no_category_system": 0}, CUTOFF,
    )
    report = se.score_company("COMP_TEST", frame, NO_EXCLUSIONS, config, scoring_date, 0, CUTOFF)
    return report, dataset, periods, config


def forecast(count, **kwargs):
    return fc.forecast_company(*fixture(count, **kwargs))


class ForecastGate(unittest.TestCase):
    def test_blocks_zero_and_eleven_observations_before_any_model_fitting(self):
        for count in (0, 11):
            with self.subTest(count=count), patch.object(fc, "fit_component", side_effect=AssertionError):
                result = forecast(count)
            self.assertEqual(result["forecast_status"], "insufficient_data")
            self.assertEqual(result["observed_operational_months"], count)
            self.assertEqual(result["months_missing"], 12 - count)
            self.assertIn(f"{count} observed", result["reason"])
            self.assertIn("12 required", result["reason"])
            for key in ("forecast", "confidence", "scenarios"):
                self.assertIsNone(result[key])
            for key in ("months_used_for_training", "backtest_training_months"):
                self.assertEqual(result[key], 0)
            for key in ("forecast_months", "training_periods", "backtest_periods"):
                self.assertEqual(result[key], [])
            for key in ("method_per_component", "baseline_vs_regression", "historical_std_per_component"):
                self.assertEqual(result[key], {})

    def test_assigns_only_low_or_medium_confidence_after_the_effective_gate(self):
        for count, status, confidence in ((12, "low_confidence", "low"),
                                           (17, "low_confidence", "low"), (18, "ok", "medium")):
            result = forecast(count)
            self.assertEqual((result["forecast_status"], result["confidence"]), (status, confidence))
            self.assertEqual(result["months_used_for_training"], count)
            self.assertEqual(result["backtest_training_months"], count - 3)
            self.assertEqual(result["months_missing"], 0)
            if count < 18:
                self.assertTrue(any("Short history" in text for text in result["limitations"]))
        with patch.object(fc, "fit_component", side_effect=AssertionError):
            result = fc.forecast_company(*fixture(18), min_months=20)
        self.assertEqual(result["months_missing"], 2)
        self.assertIsNone(result["confidence"])

    def test_rejects_gate_bypasses_in_public_api_and_cli(self):
        for value in (0, 11, True, 12.5):
            with self.subTest(value=value), self.assertRaises(ValueError):
                fc.forecast_company(*fixture(12), min_months=value)
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            run_forecast.parse_args(["--data-dir", ".", "--results-dir", ".", "--min-months", "11"])

    def test_filters_operational_membership_without_losing_genuine_zeroes(self):
        rows = []
        for month, product, category, amount in (
            (1, "EUR", "collection", 0), (1, "EUR", "payment", 0),
            (3, "DEBT", "collection", 100), (3, "DEBT", "collection_refund", -100),
            (4, "EUR", "fee", 10), (5, "EUR", "pos_settlement", 10),
            (6, "EUR", "investment_return", 10), (7, "USD", "collection", 10),
            (8, "UNKNOWN", "collection", 10), (9, "EUR", "collection", 10),
            (2, "EUR", "collection", np.nan), (2, "EUR", "transfer", 10),
        ):
            rows.append({"company_id": "COMP_TEST", "product_id": product, "category": category,
                         "amount": amount, "date": pd.Timestamp(2026, month, 1)})
        rows.append(rows[0] | {"date": pd.NaT})
        result = fc.operational_months(pd.DataFrame(rows),
                                       pd.Series({"EUR": "EUR", "DEBT": "EUR", "USD": "USD"}), CUTOFF)
        self.assertEqual(list(result["COMP_TEST"].astype(str)), ["2026-01", "2026-03"])

    def test_nonoperational_feature_months_never_count_towards_the_gate(self):
        args = list(fixture(18))
        args[2] = args[2][:11]
        with patch.object(fc, "fit_component", side_effect=AssertionError):
            result = fc.forecast_company(*args)
        self.assertEqual(result["observed_operational_months"], 11)
        self.assertEqual(result["months_missing"], 1)


class ForecastModels(unittest.TestCase):
    def test_uses_training_only_baseline_and_refits_on_all_observations(self):
        periods = pd.period_range("2025-01", periods=12, freq="M")
        values = np.arange(12, dtype=float) * 3 + 20
        with patch.object(fc, "_regression", wraps=fc._regression) as fit:
            result = fc.fit_component(pd.Series(values, index=periods), pd.period_range("2026-02", periods=3, freq="M"))
        self.assertEqual(result["winner"], "regression")
        self.assertAlmostEqual(result["regression_mae"], 0)
        self.assertAlmostEqual(result["naive_mae"], 9)
        self.assertEqual([len(call.args[0]) for call in fit.call_args_list], [9, 12])
        np.testing.assert_array_equal(fit.call_args_list[0].args[1], values[:9])
        np.testing.assert_allclose(result["predictions"], [59, 62, 65])
        self.assertAlmostEqual(result["historical_std"], values.std(ddof=1))

    def test_naive_wins_or_ties_and_recomputes_its_final_three_observations(self):
        periods = pd.period_range("2025-01", periods=12, freq="M")
        for values in ([50.0] * 12, [0, 10, 20, 30, 40, 50, 60, 60, 60, 60, 61, 59]):
            result = fc.fit_component(pd.Series(values, index=periods), periods[-3:] + 12)
            self.assertEqual(result["winner"], "naive")
            self.assertLessEqual(result["naive_mae"], result["regression_mae"])
            np.testing.assert_allclose(result["predictions"], [np.mean(values[-3:])] * 3)
        self.assertEqual(fc.fit_component(pd.Series([50.0]*12, index=periods), periods[-3:])["regression_mae"], 0)

    def test_respects_calendar_gaps_instead_of_compressing_time(self):
        periods = pd.PeriodIndex(["2020-01", "2020-03", "2020-06", "2021-01", "2021-08",
                                  "2022-01", "2023-01", "2023-03", "2024-01", "2024-04",
                                  "2025-01", "2026-08"], freq="M")
        values = (periods.asi8 - periods[0].ordinal) * 0.5 + 10
        result = forecast(12, periods=periods, values=values * 2)
        self.assertEqual(result["training_periods"], list(periods.astype(str)))
        self.assertEqual(result["backtest_periods"], list(periods[-3:].astype(str)))
        self.assertEqual(result["backtest_training_periods"], list(periods[:-3].astype(str)))
        self.assertAlmostEqual(result["scenarios"]["base"]["metrics"][0]["inflow_outflow_ratio"], 50.5)
        self.assertTrue(any("calendar gaps" in text for text in result["limitations"]))

    def test_clips_backtest_and_deployed_predictions_and_discloses_it(self):
        periods = pd.period_range("2025-01", periods=12, freq="M")
        values = [0, 10, 20, 30, 40, 50, 60, 70, 80, 100, 100, 100]
        result = fc.fit_component(pd.Series(values, index=periods), periods[-3:] + 12)
        self.assertAlmostEqual(result["regression_mae"], 10 / 3)
        self.assertTrue(result["clipping"]["backtest_regression"])
        self.assertTrue(result["clipping"]["future_base"])
        self.assertEqual(result["predictions"], [100.0] * 3)
        output = forecast(18, values=np.linspace(0, 200, 18))
        self.assertTrue(any("clipping" in text for text in output["limitations"]))
        for scenario in output["scenarios"].values():
            self.assertEqual(len(scenario["scores"]), 3)
            self.assertEqual(len(scenario["metrics"]), 3)
            self.assertEqual(len(scenario["score_details"]), 3)
            for row in scenario["metrics"]:
                self.assertEqual(set(row), set(se.COMPONENTS))
                self.assertTrue(all(0 <= value <= 100 for value in row.values()))

    def test_rejects_nonfinite_inputs_and_unevaluable_numerical_fits(self):
        periods = pd.period_range("2025-01", periods=12, freq="M")
        for value in (np.nan, np.inf, -np.inf):
            with self.assertRaisesRegex(ValueError, "finite"):
                fc.fit_component(pd.Series([value] + [50.0]*11, index=periods), periods[-3:])
        with patch.object(np.linalg, "lstsq", side_effect=np.linalg.LinAlgError("failed")):
            with self.assertRaisesRegex(ValueError, "regression"):
                fc.fit_component(pd.Series(np.arange(12), index=periods), periods[-3:])


class ForecastEngine(unittest.TestCase):
    def test_targets_months_after_source_scoring_month_and_is_deterministic(self):
        first = forecast(18)
        self.assertEqual(first, forecast(18))
        self.assertEqual(first["forecast_months"], ["2026-10", "2026-11", "2026-12"])
        self.assertEqual(first["latest_observed_month"], "2026-08")
        self.assertEqual(first["provenance"]["target_gaps_from_latest_operational_month"], [2, 3, 4])
        older = forecast(12, periods=pd.period_range("2024-01", periods=12, freq="M"),
                         scoring_date=date(2026, 12, 19))
        self.assertEqual(older["forecast_months"], ["2027-01", "2027-02", "2027-03"])
        self.assertEqual(older["provenance"]["target_gaps_from_latest_operational_month"], [25, 26, 27])
        self.assertTrue(any("Stale" in text for text in older["limitations"]))

    def test_calls_shared_engine_with_identical_config_and_independent_endpoint_histories(self):
        config = replace(CONFIG, windows={"short": 6, "medium": 6, "long": 9})
        args = list(fixture(20, config=config))
        args[2] = args[2][1:]
        original = args[1].features.copy(deep=True)
        engine = se.score_component_history
        with patch.object(se, "score_component_history", wraps=engine) as spy:
            result = fc.forecast_company(*args)
        self.assertEqual(spy.call_count, 10)
        observed = se.monthly_component_scores(args[1].features.xs("COMP_TEST"))
        for scenario_index, name in enumerate(("base", "favorable", "adverse")):
            scenario = result["scenarios"][name]
            for endpoint in range(3):
                call = spy.call_args_list[1 + scenario_index * 3 + endpoint]
                self.assertIs(call.args[1], config)
                projected = pd.DataFrame(scenario["metrics"][:endpoint+1],
                                         index=pd.PeriodIndex(result["forecast_months"][:endpoint+1], freq="M"))
                expected = pd.concat([observed, projected])
                pd.testing.assert_frame_equal(call.args[0], expected)
                self.assertEqual(scenario["score_details"][endpoint], engine(expected, config))
                self.assertEqual(scenario["scores"][endpoint], engine(expected, config)["final_score"])
                self.assertNotIn("confidence", scenario["score_details"][endpoint])
                self.assertNotIn("evidence_records", scenario["score_details"][endpoint])
        pd.testing.assert_frame_equal(args[1].features, original)
        self.assertEqual(result["months_used_for_training"], 19)

    def test_scenario_perturbations_use_sample_std_without_reordering_engine_scores(self):
        args = fixture(18)
        engine = se.score_component_history
        calls = 0

        def unusual_order(frame, config):
            nonlocal calls
            result = engine(frame, config)
            calls += 1
            if calls > 1:
                result["final_score"] = 80 if calls <= 4 else 20 if calls <= 7 else 50
            return result

        with patch.object(se, "score_component_history", side_effect=unusual_order):
            result = fc.forecast_company(*args)
        self.assertEqual(result["scenarios"]["base"]["scores"], [80]*3)
        self.assertEqual(result["scenarios"]["favorable"]["scores"], [20]*3)
        self.assertEqual(result["scenarios"]["adverse"]["scores"], [50]*3)
        self.assertTrue(any("ordering" in text for text in result["limitations"]))
        for name in se.COMPONENTS:
            base = result["scenarios"]["base"]["metrics"][0][name]
            std = result["historical_std_per_component"][name]
            self.assertEqual(result["scenarios"]["favorable"]["metrics"][0][name], min(100, base + std))
            self.assertEqual(result["scenarios"]["adverse"]["metrics"][0][name], max(0, base - std))

    def test_rejects_snapshot_identity_version_dates_weights_windows_and_evidence_mismatches(self):
        for key, value in (("company_id", "WRONG"), ("rule_version", "v1.0.0"),
                           ("data_cutoff", "2026-08-01"), ("scoring_date", "2026-08-19"),
                           ("scoring_date", "20260919"), ("final_score", 1),
                           ("evidence_records", {}), ("component_summary", {}),
                           ("window_usage", {}), ("confidence", {})):
            args = list(fixture(18))
            args[0] = args[0] | {key: value}
            with self.subTest(key=key), self.assertRaises(ValueError):
                fc.forecast_company(*args)
        args = list(fixture(18))
        args[1].features.iloc[0, 0] = np.inf
        with self.assertRaisesRegex(ValueError, "finite"):
            fc.forecast_company(*args)

    def test_preserves_inherited_limitations_and_ignores_downstream_alerts(self):
        args = list(fixture(18))
        args[0]["limitations"].append("extra source limitation")
        args[0]["alerts"] = [{"unrelated": True}]
        before = copy.deepcopy(args[0])
        result = fc.forecast_company(*args)
        self.assertTrue(set(args[0]["limitations"]).issubset(result["limitations"]))
        self.assertEqual(args[0], before)
        self.assertEqual(result["metric_units"], "normalized_score_points_0_100")


class ForecastPersistence(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "companies").mkdir()
        (self.root / "banking_products.csv").write_text("product_id,currency\nEUR,EUR\nUSD,USD\n")
        (self.root / "debt_products.csv").write_text("product_id,currency\n")
        rows = [f"T{i},COMP_TEST,EUR,{month}-10 00:00:00,100,collection"
                for i, month in enumerate(pd.period_range("2025-09", periods=13, freq="M"))]
        rows += ["TUSD,COMP_EMPTY,USD,2026-08-10 00:00:00,100,collection",
                 "TSHORT,COMP_SHORT,EUR,2026-08-10 00:00:00,100,collection"]
        (self.root / "transactions.csv").write_text(
            "transaction_id,company_id,product_id,date,amount,category\n" + "\n".join(rows) + "\n")
        for report in se.score_dataset(dp.build_dataset(self.root), CONFIG, SCORING_DATE):
            (self.root / "companies" / f"{report['company_id']}.json").write_text(
                json.dumps(report | {"alerts": [{"untouched": True}]}))
        (self.root / "alerts_20260919.json").write_text("[]")
        (self.root / "scores.json").write_text("[]")

    def invoke(self, *extra):
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = run_forecast.main(["--data-dir", str(self.root), "--results-dir", str(self.root), *extra])
        return code, stdout.getvalue(), stderr.getvalue()

    def test_cli_counts_portfolio_and_selected_company_without_mutating_observed_artifacts(self):
        before = {p: p.read_bytes() for p in self.root.rglob("*.json")}
        code, stdout, stderr = self.invoke("--company-id", "COMP_TEST")
        self.assertEqual(code, 0, stderr)
        self.assertIn("1 qualify / 2 scored", stderr)
        self.assertIn("3 reports; 1 unscored", stderr)
        self.assertIn("selected COMP_TEST: 12 observed", stderr)
        self.assertIn(str(self.root / "forecasts" / "COMP_TEST.json"), stdout)
        first = (self.root / "forecasts" / "COMP_TEST.json").read_bytes()
        self.assertEqual(self.invoke()[0], 0)
        self.assertEqual((self.root / "forecasts" / "COMP_TEST.json").read_bytes(), first)
        self.assertEqual(len(list((self.root / "forecasts").glob("*.json"))), 3)
        for path, content in before.items():
            self.assertEqual(path.read_bytes(), content)
        self.assertEqual(self.invoke("--min-months", "13")[0], 0)
        result = json.loads((self.root / "forecasts" / "COMP_TEST.json").read_text())
        self.assertEqual(result["months_missing"], 1)

    def test_cli_errors_are_actionable_and_no_forecasts_are_published_for_bad_sources(self):
        self.assertEqual(self.invoke("--company-id", "MISSING")[0], 1)
        path = self.root / "companies" / "COMP_TEST.json"
        report = json.loads(path.read_text())
        report["rule_version"] = "v1.0.0"
        path.write_text(json.dumps(report))
        code, _, stderr = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("rule_version", stderr)
        self.assertIn("v2", stderr)
        self.assertFalse((self.root / "forecasts").exists())

    def test_failed_fitting_preserves_every_previously_published_forecast(self):
        self.assertEqual(self.invoke()[0], 0)
        before = {p: p.read_bytes() for p in (self.root / "forecasts").glob("*.json")}
        with patch.object(fc, "fit_component", side_effect=ValueError("unevaluable regression")):
            code, _, stderr = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("unevaluable regression", stderr)
        for path, content in before.items():
            self.assertEqual(path.read_bytes(), content)

    def test_rejects_invalid_training_contract_before_publication(self):
        result = forecast(12)
        for key, value in (("training_periods", []), ("backtest_periods", []),
                           ("backtest_training_periods", []), ("reason", None),
                           ("historical_std_per_component", dict.fromkeys(se.COMPONENTS, -1))):
            with self.subTest(key=key), self.assertRaises(ValueError):
                fc.write_forecast(self.root, result | {key: value})
        self.assertFalse((self.root / "forecasts").exists())

    def test_rejects_complex_components_instead_of_discarding_imaginary_values(self):
        periods = pd.period_range("2025-01", periods=12, freq="M")
        with self.assertRaisesRegex(ValueError, "numeric"):
            fc.fit_component(pd.Series([50 + 1j] * 12, index=periods), periods[-3:])

    def test_atomic_publication_preserves_existing_artifact_on_serialization_or_replace_failure(self):
        result = forecast(12)
        path = fc.write_forecast(self.root, result)
        original = path.read_bytes()
        with self.assertRaises(ValueError):
            fc.write_forecast(self.root, result | {"extra": np.inf})
        self.assertEqual(path.read_bytes(), original)
        with patch.object(fc.os, "replace", side_effect=OSError("disk failure")):
            with self.assertRaises(OSError):
                fc.write_forecast(self.root, result)
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(list(path.parent.iterdir()), [path])
        with self.assertRaises(ValueError):
            fc.write_forecast(self.root, result | {"company_id": "../escape"})


if __name__ == "__main__":
    unittest.main()
