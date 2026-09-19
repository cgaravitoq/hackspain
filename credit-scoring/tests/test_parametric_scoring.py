from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import yaml

from test_score_engine import (
    CONFIG, CUTOFF, MONTHS_12, NO_EXCLUSIONS, SCORING_DATE, features, ramp, score,
)
from src import score_engine as se


def history(values, periods=None):
    index = pd.PeriodIndex(periods, freq="M") if periods is not None else pd.period_range(
        "2024-01", periods=len(values), freq="M"
    )
    return pd.DataFrame({name: values for name in se.COMPONENTS}, index=index, dtype=float)


def configured(**settings):
    raw = copy.deepcopy(CONFIG.raw)
    raw.update(settings)
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "config.yaml"
        path.write_text(yaml.safe_dump(raw), encoding="utf-8")
        return se.load_config(path)


class ParametricConfiguration(unittest.TestCase):
    def test_resolves_horizon_names_and_preserves_legacy_constructor_defaults(self):
        config = configured(windows={"short": 2, "medium": 5, "long": 8},
                            comparison_horizons={"primary": "medium", "drift_detection": "short"})
        result = se.score_component_history(history(range(20)), config)
        self.assertEqual(result["rule_version"], "v2.0.0-w5-h2")
        self.assertEqual(result["window_usage"]["primary"]["configured_months"], 5)
        self.assertEqual(result["drift_detection"]["window_months"], 2)
        legacy = se.Config(CONFIG.version, CONFIG.weights, CONFIG.improving,
                           CONFIG.deteriorating, CONFIG.complete_month, CONFIG.max_adjustment, {})
        self.assertEqual(legacy.windows, {"short": 3, "medium": 6, "long": 9})

    def test_uses_defaults_for_legacy_yaml(self):
        raw = copy.deepcopy(CONFIG.raw)
        for name in ("windows", "comparison_horizons", "evaluation_frequency", "min_months_for_window"):
            raw.pop(name, None)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.yaml"
            path.write_text(yaml.safe_dump(raw), encoding="utf-8")
            config = se.load_config(path)
        self.assertEqual(config.windows, {"short": 3, "medium": 6, "long": 9})
        self.assertEqual(config.comparison_horizons, {"primary": "short", "drift_detection": "long"})
        self.assertEqual(config.min_months_for_window, 4)
        self.assertEqual(config.evaluation_frequency, "monthly")

    def test_rejects_invalid_window_gate_horizon_and_frequency_settings(self):
        invalid = [
            {"windows": {"short": value, "medium": 6, "long": 9}}
            for value in (True, False, 0, -1, 3.5, "3", None)
        ] + [
            {"min_months_for_window": value} for value in (True, 0, 1, 2.5, "4", None)
        ] + [
            {"windows": None}, {"windows": []},
            {"comparison_horizons": None},
            {"comparison_horizons": {"primary": "missing", "drift_detection": "long"}},
            {"comparison_horizons": {"primary": "short"}},
            {"comparison_horizons": {"primary": [], "drift_detection": "long"}},
            {"evaluation_frequency": "quarterly"}, {"evaluation_frequency": None},
        ]
        for settings in invalid:
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                configured(**settings)


class ParametricWindows(unittest.TestCase):
    def test_preserves_numeric_results_captured_before_implementation(self):
        fixtures = [
            ([100], 80, 80, "insufficient_data", "unconfirmed", 0, None),
            ([100, 150, 200], 90, 90, "insufficient_data", "unconfirmed", 0, None),
            ([50, 150, 150, 150], 90, 90, "improving", "unconfirmed", 0, 50),
            ([50, 50, 150, 150, 150], 90, 90, "improving", "unconfirmed", 0, 50),
            ([20]*3 + [90]*3 + [160]*3, 92, 100, "improving", "confirmed", 8, 35),
            ([200]*3 + [120]*3 + [40]*3, 68, 58, "deteriorating", "confirmed", -10, -40),
            ([160]*3 + [20]*3 + [90]*3, 78, 78, "improving", "unconfirmed", 0, 35),
        ]
        for values, base, final, direction, persistence, adjustment, change in fixtures:
            with self.subTest(values=values):
                result = score(ramp(MONTHS_12[-len(values):], values))
                self.assertEqual([result[k] for k in ("base_score", "final_score", "trajectory",
                                 "persistence", "trajectory_adjustment")],
                                 [base, final, direction, persistence, adjustment])
                expected = [] if change is None else [
                    {"component": name, "change": change if i == 0 else 0,
                     "contribution": adjustment if i == 0 else 0}
                    for i, name in enumerate(se.COMPONENTS)
                ]
                self.assertEqual(result["signals"], expected)

    def test_primary_horizon_changes_periods_base_and_persistence(self):
        scores = history(range(30))
        for name, size in (("short", 3), ("medium", 6), ("long", 9)):
            with self.subTest(name=name):
                config = configured(comparison_horizons={"primary": name, "drift_detection": "long"})
                result = se.score_component_history(scores, config)
                self.assertEqual(result["periods_compared"], {
                    "recent": list(scores.index[-size:].astype(str)),
                    "baseline": list(scores.index[-2*size:-size].astype(str)),
                })
                self.assertEqual(result["base_score"], round(float(np.mean(range(30-size, 30))), 1))
                self.assertEqual(result["persistence"], "confirmed")
                self.assertEqual(result["trajectory_adjustment"], size)
                self.assertEqual(result["rule_version"], f"v2.0.0-w{size}-h9")

    def test_reports_actual_short_history_sizes_and_no_invented_observations(self):
        for n in (0, 1, 3, 4, 5, 6, 9, 10, 18):
            with self.subTest(n=n):
                result = se.score_component_history(history([50]*n), CONFIG)
                for horizon, size in (("primary", 3), ("drift_detection", 9)):
                    recent = min(size, n-1) if n >= 4 else min(size, n)
                    baseline = min(size, n-recent) if n >= 4 else 0
                    self.assertEqual(result["window_usage"][horizon], {
                        "configured_months": size, "recent_months": recent,
                        "baseline_months": baseline,
                        "fallback_used": recent < size or baseline < size,
                    })
                self.assertEqual(result["drift_detection"]["status"], "ok" if n >= 4 else "insufficient_data")
                self.assertEqual(result["rule_version"], "v2.0.0-w3-h9")
                self.assertNotIn("drift_alert", result)
                if n < 4:
                    self.assertIsNone(result["primary_delta"])
                    self.assertEqual(result["trajectory_adjustment"], 0)
                if n == 0:
                    self.assertIsNone(result["final_score"])
                    self.assertIsNone(result["latest_observed_month"])
                if n < 18:
                    self.assertTrue(any("drift_detection" in item for item in result["limitations"]))

    def test_reserves_a_baseline_for_short_history_at_large_primary_sizes(self):
        for size in (6, 9):
            config = configured(windows={"short": size, "medium": 6, "long": 9})
            result = se.score_component_history(history([10, 30, 40, 50]), config)
            self.assertEqual(result["periods_compared"]["baseline"], ["2024-01"])
            self.assertEqual(result["base_score"], 40)
            self.assertEqual(result["primary_delta"], 30)
            self.assertEqual(result["persistence"], "unconfirmed")
            self.assertEqual(result["trajectory_adjustment"], 0)
            self.assertTrue(any("explainer" in item for item in result["limitations"]))

    def test_applies_the_minimum_gate_to_both_comparisons_but_still_scores_the_base(self):
        config = configured(min_months_for_window=8)
        result = se.score_component_history(history(range(7)), config)
        self.assertEqual(result["base_score"], 5)
        self.assertEqual(result["trajectory"], "insufficient_data")
        self.assertEqual(result["periods_compared"]["baseline"], [])
        self.assertIsNone(result["drift_detection"]["delta"])
        self.assertNotIn("drift_alert", result)
        config = configured(min_months_for_window=2)
        result = se.score_component_history(history([10, 50]), config)
        self.assertEqual(result["primary_delta"], 40)
        self.assertEqual(result["window_usage"]["primary"]["recent_months"], 1)

    def test_sorts_observed_months_and_discloses_gaps_without_filling_them(self):
        scores = history([40, 10, 30, 20], ["2026-08", "2024-01", "2026-07", "2025-01"])
        original = scores.copy()
        result = se.score_component_history(scores, CONFIG)
        self.assertEqual(result["periods_compared"]["recent"], ["2025-01", "2026-07", "2026-08"])
        self.assertEqual(result["periods_compared"]["baseline"], ["2024-01"])
        self.assertEqual(result["latest_observed_month"], "2026-08")
        self.assertTrue(any("calendar gaps" in item for item in result["limitations"]))
        pd.testing.assert_frame_equal(scores, original)

    def test_requires_a_full_previous_recent_window_but_allows_a_partial_older_baseline(self):
        for size in (3, 6, 9):
            config = configured(windows={"short": size, "medium": 6, "long": 9})
            for count, expected in ((2*size, "unconfirmed"), (2*size+1, "confirmed")):
                result = se.score_component_history(history([2*i for i in range(count)]), config)
                self.assertEqual(result["persistence"], expected)
                if expected == "confirmed":
                    self.assertTrue(any("share" in item for item in result["limitations"]))


class DriftDetection(unittest.TestCase):
    def test_flags_long_deterioration_despite_stable_or_improving_primary(self):
        for recent, direction, delta in ((50, "stable", -30), (60, "improving", -26.6667)):
            result = se.score_component_history(history([80]*9 + [50]*6 + [recent]*3), CONFIG)
            self.assertEqual(result["trajectory"], direction)
            self.assertEqual(result["drift_detection"]["trajectory"], "deteriorating")
            self.assertAlmostEqual(result["drift_detection"]["delta"], delta, places=4)
            self.assertEqual(result["drift_alert"], {
                "delta": result["drift_detection"]["delta"], "threshold_used": -2.0, "window_months": 9,
                "periods_compared": result["drift_detection"]["periods_compared"],
                "fallback_used": False,
            })

    def test_does_not_flag_stable_unavailable_or_primary_deteriorating_comparisons(self):
        for values in ([50]*18, [80, 70, 60], [80]*9 + [50]*6 + [30]*3):
            self.assertNotIn("drift_alert", se.score_component_history(history(values), CONFIG))

    def test_uses_strict_configured_directional_thresholds(self):
        values = [80]*9 + [78]*9
        result = se.score_component_history(history(values), CONFIG)
        self.assertEqual(result["drift_detection"]["delta"], -2)
        self.assertEqual(result["drift_detection"]["trajectory"], "stable")
        self.assertNotIn("drift_alert", result)
        config = replace(CONFIG, deteriorating=-1)
        result = se.score_component_history(history(values), config)
        self.assertEqual(result["drift_alert"]["threshold_used"], -1)

    def test_discloses_a_shortened_long_comparison_in_an_active_alert(self):
        result = se.score_component_history(history([90]*2 + [50]*6), CONFIG)
        self.assertEqual(result["trajectory"], "stable")
        self.assertTrue(result["drift_alert"]["fallback_used"])
        self.assertEqual(result["drift_detection"]["actual_window_months"], {"recent": 7, "baseline": 1})
        self.assertEqual(len(result["drift_alert"]["periods_compared"]["recent"]), 7)

    def test_changing_drift_window_or_drift_only_history_never_changes_primary_math(self):
        scores = history([80]*9 + [50]*6 + [60]*3)
        first = se.score_component_history(scores, CONFIG)
        config = configured(comparison_horizons={"primary": "short", "drift_detection": "medium"})
        second = se.score_component_history(scores, config)
        changed = scores.copy()
        changed.iloc[:9] = 10
        third = se.score_component_history(changed, CONFIG)
        self.assertNotEqual(first["drift_detection"]["delta"], second["drift_detection"]["delta"])
        self.assertNotEqual(first["drift_detection"]["trajectory"], third["drift_detection"]["trajectory"])
        for key in ("base_score", "final_score", "trajectory", "persistence", "trajectory_adjustment",
                    "signals", "primary_delta", "periods_compared", "component_summary"):
            self.assertEqual(first[key], second[key])
            self.assertEqual(first[key], third[key])


class ComponentEntryPoint(unittest.TestCase):
    def test_wrapper_calls_the_shared_entry_point_and_keeps_evidence_observed_only(self):
        frame = features(dict(ramp(MONTHS_12, list(range(0, 120, 10)))))
        expected = se.score_component_history(se.monthly_component_scores(frame), CONFIG)
        with patch.object(se, "score_component_history", wraps=se.score_component_history) as shared:
            result = se.score_company("COMP_TEST", frame, NO_EXCLUSIONS, CONFIG,
                                      SCORING_DATE, 635860, CUTOFF)
        shared.assert_called_once()
        pd.testing.assert_frame_equal(shared.call_args.args[0], se.monthly_component_scores(frame))
        for key, value in expected.items():
            if key == "limitations":
                self.assertTrue(set(value).issubset(result[key]))
            else:
                self.assertEqual(result[key], value)
        self.assertEqual(result["evidence_records"]["count"], 120)
        self.assertEqual(result["confidence"]["months_available"], 12)
        self.assertEqual(result["data_cutoff"], "2026-09-01")
        for key in ("evidence_records", "confidence", "data_cutoff", "company_id", "scoring_date"):
            self.assertNotIn(key, expected)

    def test_exports_null_attribution_and_cutoff_for_an_unscored_company(self):
        result = score([])
        self.assertEqual(result["data_cutoff"], "2026-09-01")
        self.assertEqual(result["rule_version"], "v2.0.0-w3-h9")
        self.assertEqual(result["drift_detection"]["status"], "insufficient_data")
        for name, entry in result["component_summary"].items():
            self.assertEqual(entry, {"weight": CONFIG.weights[name], "recent_average": None,
                                     "base_contribution": None})

    def test_rejects_nonfinite_nonnumeric_boolean_complex_and_out_of_range_components(self):
        for value in (np.nan, np.inf, -np.inf, -0.1, 100.1, True, "50", complex(50, 1), None):
            scores = history([50]*4).astype(object)
            scores.iloc[0, 0] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                se.score_component_history(scores, CONFIG)

    def test_rejects_wrong_columns_duplicate_missing_or_nonmonthly_periods(self):
        scores = history([50]*4)
        invalid = [scores.drop(columns=se.COMPONENTS[0]), scores.assign(extra=1),
                   scores.set_axis([*se.COMPONENTS[:3], se.COMPONENTS[0]], axis=1),
                   scores.set_axis(["2024-01"]*4),
                   scores.set_axis(pd.period_range("2024-01-01", periods=4, freq="D")),
                   scores.set_axis(pd.PeriodIndex(["2024-01"]*4, freq="M")),
                   scores.set_axis(pd.PeriodIndex(["2024-01", "2024-02", "2024-03", None], freq="M"))]
        for frame in invalid:
            with self.subTest(index=frame.index, columns=frame.columns), self.assertRaises(ValueError):
                se.score_component_history(frame, CONFIG)

    def test_reconciles_base_attribution_and_trajectory_contributions_with_export_precision(self):
        rng = np.random.default_rng(6)
        for _ in range(30):
            scores = pd.DataFrame(rng.uniform(0, 100, (27, 4)),
                                  index=pd.period_range("2024-01", periods=27, freq="M"),
                                  columns=se.COMPONENTS)
            result = se.score_component_history(scores, CONFIG)
            unrounded = sum(float(scores[name].iloc[-3:].mean()) * CONFIG.weights[name]
                            for name in se.COMPONENTS)
            total = sum(entry["base_contribution"] for entry in result["component_summary"].values())
            self.assertAlmostEqual(total, unrounded, delta=se.TOLERANCE)
            self.assertAlmostEqual(result["base_score"], unrounded, delta=0.05)
            delta = result["trajectory_adjustment"]
            self.assertAlmostEqual(sum(s["contribution"] for s in result["signals"]), delta, delta=0.051)
            self.assertTrue(0 <= result["final_score"] <= 100)
            if result["persistence"] == "unconfirmed":
                self.assertEqual(delta, 0)
            json.dumps(result, allow_nan=False)


class AdditionalContracts(unittest.TestCase):
    def test_exported_drift_evidence_preserves_strict_threshold_decisions(self):
        result = se.score_component_history(history([80]*9 + [77.99999]*9), CONFIG)
        self.assertEqual(result["trajectory"], "stable")
        alert = result["drift_alert"]
        self.assertLess(alert["delta"], alert["threshold_used"])
        self.assertEqual(alert["delta"], result["drift_detection"]["delta"])

    def test_applies_the_configured_gate_at_the_previous_persistence_endpoint(self):
        config = configured(min_months_for_window=8)
        result = se.score_component_history(history([10*i for i in range(8)]), config)
        self.assertEqual(result["trajectory"], "improving")
        self.assertEqual(result["persistence"], "unconfirmed")
        self.assertEqual(result["trajectory_adjustment"], 0)

    def test_clips_both_extremes_and_reconciles_the_effective_adjustment(self):
        for values, expected in (([20]*3 + [60]*3 + [99]*3, 100),
                                 ([80]*3 + [40]*3 + [1]*3, 0)):
            result = se.score_component_history(history(values), CONFIG)
            self.assertEqual(result["persistence"], "confirmed")
            self.assertEqual(result["final_score"], expected)
            self.assertEqual(result["trajectory_adjustment"], expected-values[-1])
            self.assertAlmostEqual(sum(s["contribution"] for s in result["signals"]),
                                   result["trajectory_adjustment"], delta=se.TOLERANCE)

    def test_rejects_nonfinite_policy_numbers(self):
        for value in (float("nan"), float("inf"), -float("inf")):
            for name in ("improving", "deteriorating", "max_adjustment"):
                thresholds = CONFIG.raw["thresholds"] | {name: value}
                with self.subTest(value=value, name=name), self.assertRaises(ValueError):
                    configured(thresholds=thresholds)
            with self.assertRaises(ValueError):
                configured(weights=CONFIG.weights | {"fee_score": value})

    def test_existing_clis_work_with_isolated_scored_and_unscored_v2_results(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            (data / "banking_products.csv").write_text("product_id,currency\nEUR,EUR\nUSD,USD\n")
            (data / "debt_products.csv").write_text("product_id,currency\n")
            rows = [f"T{m},COMP_TEST,EUR,2026-{m:02d}-10 00:00:00,100,collection"
                    for m in range(1, 10)]
            rows.append("TUSD,COMP_UNSCORED,USD,2026-01-10 00:00:00,100,collection")
            (data / "transactions.csv").write_text(
                "transaction_id,company_id,product_id,date,amount,category\n" + "\n".join(rows) + "\n"
            )
            output = data / "results"
            commands = [
                ["run_scoring.py", "--data-dir", str(data), "--output-dir", str(output),
                 "--scoring-date", "2026-09-19"],
                ["explain.py", "--results-dir", str(output), "--company-id", "COMP_TEST"],
                ["explain.py", "--results-dir", str(output), "--company-id", "COMP_UNSCORED"],
                ["explain_all.py", "--results-dir", str(output), "--generated-on", "2026-09-19"],
            ]
            for command in commands:
                completed = subprocess.run([sys.executable, "-B", str(root / command[0]), *command[1:]],
                                           cwd=data, capture_output=True, text=True, check=False)
                self.assertEqual(completed.returncode, 0, completed.stderr)
            reports = json.loads((output / "scores.json").read_text())
            self.assertEqual(len(reports), 2)
            for report in reports:
                self.assertEqual(report["rule_version"], "v2.0.0-w3-h9")
                self.assertEqual(report["data_cutoff"], "2026-09-01")
                json.dumps(report, allow_nan=False)
            self.assertIsNone(reports[1]["final_score"])
            self.assertTrue((output / "summary_20260919.txt").exists())


if __name__ == "__main__":
    unittest.main()
