from __future__ import annotations

import copy
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src import alerts
from src import score_engine as se
import run_alerts

ROOT = Path(__file__).resolve().parents[1]


def report(**changes):
    return {
        "company_id": "COMP_TEST",
        "scoring_date": "2026-09-19",
        "rule_version": "v1.0.0",
        "trajectory": "stable",
        "persistence": "unconfirmed",
        "final_score": 70.0,
        "confidence": {"months_available": 12, "coverage_pct": 1.0},
        "periods_compared": {"recent": ["2026-08"], "baseline": ["2026-07"]},
    } | changes


def drift_report(delta=-3.0):
    periods = {"recent": ["2026-08"], "baseline": ["2026-07"]}
    flag = {"delta": delta, "threshold_used": -1.0, "window_months": 9,
            "periods_compared": periods, "fallback_used": True}
    return report(
        rule_version="v2.0.0-w3-h9", latest_observed_month="2026-08", drift_alert=flag,
        drift_detection={key: value for key, value in flag.items() if key != "threshold_used"}
        | {"status": "ok", "trajectory": "deteriorating",
           "actual_window_months": {"recent": 1, "baseline": 1}},
    )


def pointer_value(document, pointer):
    for token in pointer.lstrip("/").split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        document = document[int(token)] if isinstance(document, list) else document[token]
    return document


class AlertRules(unittest.TestCase):
    def setUp(self):
        self.config = alerts.load_config(ROOT / "alert_config.yaml")

    def types(self, source):
        return {item["alert_type"] for item in alerts.evaluate_company(source, self.config)[0]}

    def test_requires_both_configured_categories_for_confirmed_deterioration(self):
        for trajectory, persistence, expected in (
            ("deteriorating", "confirmed", True),
            ("deteriorating", "unconfirmed", False),
            ("stable", "confirmed", False),
        ):
            with self.subTest(trajectory=trajectory, persistence=persistence):
                self.assertEqual("DETERIORATION_CONFIRMED" in self.types(report(
                    trajectory=trajectory, persistence=persistence)), expected)

    def test_uses_strict_boundaries_for_every_numeric_rule(self):
        cases = [
            ("DRIFT_DETECTED", [drift_report(value) for value in (-3, -2, -1.5)]),
            ("INSUFFICIENT_DATA", [report(confidence={"months_available": value,
                                                      "coverage_pct": 1})
                                   for value in (3, 4, 5)]),
            ("STALE_DATA", [report(latest_observed_month=value)
                            for value in ("2026-05", "2026-06", "2026-07")]),
            ("LOW_COVERAGE", [report(confidence={"months_available": 12,
                                                 "coverage_pct": value})
                              for value in (0.49, 0.5, 0.51)]),
            ("SCORE_FLOOR", [report(final_score=value) for value in (39.9, 40, 40.1)]),
        ]
        for alert_type, sources in cases:
            for source, expected in zip(sources, (True, False, False), strict=True):
                with self.subTest(alert_type=alert_type, source=source):
                    self.assertEqual(alert_type in self.types(source), expected)

    def test_missing_false_or_null_flags_are_never_active(self):
        for flag in (None, False):
            source = drift_report()
            source["drift_alert"] = flag
            self.assertNotIn("DRIFT_DETECTED", self.types(source))
        source.pop("drift_alert")
        self.assertNotIn("DRIFT_DETECTED", self.types(source))

    def test_rejects_malformed_and_inconsistent_drift_flags(self):
        for flag in ({}, True, [], "active", {"delta": -3},
                     drift_report()["drift_alert"] | {"delta": "-3"},
                     drift_report()["drift_alert"] | {"delta": -4}):
            with self.subTest(flag=flag), self.assertRaises(ValueError):
                self.types(drift_report() | {"drift_alert": flag})

    def test_consumes_the_actual_agent6_slow_drift_producer_without_rescoring(self):
        config = se.load_config(ROOT / "src" / "config.yaml")
        values = [80] * 9 + [50] * 9
        frame = pd.DataFrame({name: values for name in se.COMPONENTS},
                             index=pd.period_range("2025-01", periods=18, freq="M"))
        produced = se.score_component_history(frame, config)
        source = report() | produced
        source["confidence"] = {"months_available": 18, "coverage_pct": 1.0}
        with patch.object(se, "score_component_history", side_effect=AssertionError("rescore")):
            found, diagnostics = alerts.evaluate_company(source, self.config)
        self.assertFalse(diagnostics)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["alert_type"], "DRIFT_DETECTED")
        self.assertEqual(found[0]["trigger_value"], produced["drift_alert"]["delta"])
        pointers = {entry["pointer"] for entry in found[0]["evidence"]}
        self.assertIn("/drift_detection/delta", pointers)
        self.assertIn("/drift_detection/periods_compared", pointers)

    def test_nulls_are_unknown_and_zero_history_is_info_not_a_zero_score(self):
        source = report(final_score=None, latest_observed_month=None,
                        confidence={"months_available": 0, "coverage_pct": None})
        found, diagnostics = alerts.evaluate_company(source, self.config)
        self.assertEqual([item["alert_type"] for item in found], ["INSUFFICIENT_DATA"])
        self.assertEqual(found[0]["severity"], "INFO")
        self.assertIsNone(found[0]["final_score"])
        self.assertEqual({item["alert_type"] for item in diagnostics},
                         {"DRIFT_DETECTED", "STALE_DATA", "LOW_COVERAGE", "SCORE_FLOOR"})

    def test_legacy_reports_disclose_unevaluable_drift_and_use_maximum_recent_month(self):
        source = report(scoring_date="2026-01-19", periods_compared={
            "recent": ["2025-08", "2025-09", "2025-07"], "baseline": []})
        found, diagnostics = alerts.evaluate_company(source, self.config)
        stale = next(item for item in found if item["alert_type"] == "STALE_DATA")
        self.assertEqual(stale["trigger_value"], 4)
        self.assertEqual(stale["calculation"]["latest_month_source"], "/periods_compared/recent/1")
        self.assertTrue(any(item["alert_type"] == "DRIFT_DETECTED" for item in diagnostics))
        self.assertEqual(stale["rule_version"], "v1.0.0")

    def test_uses_calendar_months_across_years_and_source_scoring_date(self):
        for latest, expected in (("2025-09", True), ("2025-10", False), ("2025-12", False)):
            source = report(scoring_date="2026-01-01", latest_observed_month=latest,
                            periods_compared={"recent": [latest], "baseline": []})
            self.assertEqual("STALE_DATA" in self.types(source), expected)

    def test_reports_unavailable_dates_without_inventing_a_stale_age(self):
        source = report()
        source.pop("periods_compared")
        found, diagnostics = alerts.evaluate_company(source, self.config)
        self.assertFalse(found)
        self.assertIn("STALE_DATA", {item["alert_type"] for item in diagnostics})

    def test_keeps_independent_alerts_and_resolvable_evidence_with_distinct_versions(self):
        source = report(trajectory="deteriorating", persistence="confirmed", final_score=20,
                        latest_observed_month="2026-01",
                        confidence={"months_available": 3, "coverage_pct": 0.25})
        original = copy.deepcopy(source)
        found, _ = alerts.evaluate_company(source, self.config)
        self.assertEqual(len(found), 5)
        self.assertEqual(source, original)
        for item in found:
            self.assertEqual(item["rule_version"], source["rule_version"])
            self.assertEqual(item["alert_rule_version"], self.config["version"])
            self.assertNotEqual(item["rule_version"], item["alert_rule_version"])
            for evidence in item["evidence"]:
                self.assertEqual(pointer_value(source, evidence["pointer"]), evidence["value"])
        stale = next(item for item in found if item["alert_type"] == "STALE_DATA")
        self.assertEqual(stale["calculation"]["age_months"], 8)
        self.assertEqual({item["pointer"] for item in stale["evidence"]},
                         {"/scoring_date", "/latest_observed_month"})

    def test_rejects_missing_required_scalars_invalid_types_dates_and_future_evidence(self):
        invalid = [report(**{key: value}) for key, value in (
            ("company_id", "../escape"), ("company_id", 3),
            ("scoring_date", "2026-02-30"), ("scoring_date", "20260919"),
            ("rule_version", None), ("trajectory", []), ("persistence", True),
            ("latest_observed_month", "2026-13"), ("latest_observed_month", "2026-10"),
            ("final_score", True), ("final_score", "30"), ("final_score", float("nan")),
            ("final_score", float("inf")), ("final_score", -1),
            ("confidence", {"months_available": True, "coverage_pct": 0.5}),
            ("confidence", {"months_available": -1, "coverage_pct": 0.5}),
            ("confidence", {"months_available": 12, "coverage_pct": 50}),
            ("confidence", {"months_available": 12}),
            ("periods_compared", {"recent": ["2027-01"], "baseline": []}),
        )]
        for key in ("company_id", "scoring_date", "final_score", "trajectory", "confidence"):
            source = report()
            source.pop(key)
            invalid.append(source)
        for source in invalid:
            with self.subTest(source=source), self.assertRaises(ValueError):
                self.types(source)

    def test_rejects_missing_v2_metadata_and_invalid_drift_support(self):
        invalid = []
        for key in ("latest_observed_month", "drift_detection"):
            source = drift_report()
            source.pop(key)
            source.pop("drift_alert")
            invalid.append(source)
        for key, value in (("delta", None), ("fallback_used", "true"),
                           ("actual_window_months", {"recent": True, "baseline": 1}),
                           ("periods_compared", {"recent": ["2026-13"], "baseline": ["2026-07"]})):
            source = drift_report()
            source["drift_detection"][key] = value
            invalid.append(source)
        for source in invalid:
            with self.subTest(source=source), self.assertRaises(ValueError):
                self.types(source)

    def test_rejects_duplicate_company_id_in_pure_batch_evaluation(self):
        with self.assertRaisesRegex(ValueError, "duplicate company_id"):
            alerts.evaluate_batch([report(), report()], self.config)

    def test_reports_insufficient_v2_drift_as_unevaluable(self):
        frame = pd.DataFrame({name: [] for name in se.COMPONENTS},
                             index=pd.PeriodIndex([], freq="M"))
        source = report() | se.score_component_history(frame, se.load_config(ROOT / "src/config.yaml"))
        source["confidence"] = {"months_available": 0, "coverage_pct": None}
        _, diagnostics = alerts.evaluate_company(source, self.config)
        self.assertIn("DRIFT_DETECTED", {item["alert_type"] for item in diagnostics})

    def test_sorts_severity_then_measured_score_then_company_and_type(self):
        sources = [report(company_id="Z", final_score=None,
                          confidence={"months_available": 1, "coverage_pct": None}),
                   report(company_id="B", final_score=20, trajectory="deteriorating",
                          persistence="confirmed"), report(company_id="A", final_score=20),
                   report(company_id="C", final_score=10),
                   report(company_id="Y", final_score=70,
                          confidence={"months_available": 1, "coverage_pct": 1})]
        first, _ = alerts.evaluate_batch(sources, self.config)
        second, _ = alerts.evaluate_batch(list(reversed(sources)), self.config)
        self.assertEqual(first, second)
        self.assertEqual([(item["company_id"], item["alert_type"]) for item in first], [
            ("C", "SCORE_FLOOR"), ("A", "SCORE_FLOOR"),
            ("B", "DETERIORATION_CONFIRMED"), ("B", "SCORE_FLOOR"),
            ("Y", "INSUFFICIENT_DATA"), ("Z", "INSUFFICIENT_DATA")])


class AlertConfiguration(unittest.TestCase):
    def setUp(self):
        self.raw = yaml.safe_load((ROOT / "alert_config.yaml").read_text())

    def test_loads_every_threshold_and_categorical_trigger_from_yaml(self):
        changes = {
            "DETERIORATION_CONFIRMED": {"trajectory": "stable", "persistence": "unconfirmed"},
            "DRIFT_DETECTED": {"delta_threshold": -4},
            "INSUFFICIENT_DATA": {"min_months_threshold": 20},
            "STALE_DATA": {"max_age_months": 0},
            "LOW_COVERAGE": {"coverage_threshold": 0.9},
            "SCORE_FLOOR": {"score_threshold": 80},
        }
        for name, values in changes.items():
            self.raw["rules"][name].update(values)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "policy.yaml"
            path.write_text(yaml.safe_dump(self.raw))
            config = alerts.load_config(path)
        source = drift_report()
        source["confidence"]["coverage_pct"] = 0.8
        found, _ = alerts.evaluate_company(source, config)
        self.assertEqual({item["alert_type"] for item in found}, set(changes) - {"DRIFT_DETECTED"})

    def test_rejects_severity_escalation_bad_order_missing_rules_and_invalid_thresholds(self):
        invalid = []
        for severity in ("HIGH", "MEDIUM", "LOW"):
            raw = copy.deepcopy(self.raw)
            raw["rules"]["INSUFFICIENT_DATA"]["severity"] = severity
            invalid.append(raw)
        for name, key, value in (
            ("LOW_COVERAGE", "coverage_threshold", 50),
            ("DRIFT_DETECTED", "delta_threshold", float("nan")),
            ("DRIFT_DETECTED", "delta_threshold", 1),
            ("STALE_DATA", "max_age_months", True),
            ("INSUFFICIENT_DATA", "min_months_threshold", 3.5),
            ("SCORE_FLOOR", "score_threshold", "40"),
            ("SCORE_FLOOR", "severity", "INFO"),
            ("DETERIORATION_CONFIRMED", "trajectory", []),
        ):
            raw = copy.deepcopy(self.raw)
            raw["rules"][name][key] = value
            invalid.append(raw)
        invalid.extend([self.raw | {"severity_order": ["INFO", "HIGH", "MEDIUM", "LOW"]},
                        self.raw | {"rules": {}}, self.raw | {"version": None}])
        for raw in invalid:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                alerts.validate_config(raw)


class AlertPersistence(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        (self.directory / "companies").mkdir()

    def put(self, source):
        path = self.directory / "companies" / f"{source['company_id']}.json"
        path.write_text(json.dumps(source))
        return path

    def invoke(self, *extra):
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = run_alerts.main(["--results-dir", str(self.directory),
                                    "--generated-on", "2026-09-19", *extra])
        return code, stdout.getvalue(), stderr.getvalue()

    def test_reruns_replace_alerts_preserve_unknown_fields_and_agree_with_aggregate(self):
        source = report(final_score=20, unknown={"nested": [None, False, "retained"]})
        path = self.put(source)
        clean = self.put(report(company_id="SAFE"))
        scores = self.directory / "scores.json"
        scores.write_text("untouched portfolio copies")
        first = self.invoke()
        self.assertEqual(first[0], 0, first[2])
        first_bytes = path.read_bytes()
        second = self.invoke()
        self.assertEqual(first, second)
        self.assertEqual(path.read_bytes(), first_bytes)
        embedded = json.loads(path.read_text())
        self.assertEqual(embedded.pop("alerts"), json.loads(first[1]))
        self.assertEqual(embedded, source)
        self.assertEqual(json.loads(clean.read_text())["alerts"], [])
        self.assertEqual(scores.read_text(), "untouched portfolio copies")
        self.assertEqual(json.loads((self.directory / "alerts_20260919.json").read_text()),
                         json.loads(first[1]))
        self.assertIn("SCORE_FLOOR\tHIGH\t1", first[2])
        self.assertIn("TOTAL\tHIGH\t1", first[2])
        self.assertIn("unevaluable", first[2])

    def test_empty_portfolios_publish_an_empty_machine_readable_list(self):
        code, stdout, stderr = self.invoke()
        self.assertEqual(code, 0, stderr)
        self.assertEqual(json.loads(stdout), [])
        self.assertEqual(json.loads((self.directory / "alerts_20260919.json").read_text()), [])
        self.assertIn("TOTAL\tALL\t0", stderr)

    def test_validates_the_entire_batch_before_mutating_any_file(self):
        good = self.put(report(company_id="A", final_score=10))
        bad = self.put(report(company_id="Z", scoring_date="bad"))
        before = good.read_bytes()
        code, stdout, stderr = self.invoke()
        self.assertEqual(code, 1)
        self.assertEqual(stdout, "")
        self.assertIn(str(bad), stderr)
        self.assertEqual(good.read_bytes(), before)
        self.assertFalse((self.directory / "alerts_20260919.json").exists())

    def test_rejects_malformed_json_nonfinite_unknown_fields_and_identity_mismatch(self):
        path = self.directory / "companies" / "COMP_TEST.json"
        for text in ("{", json.dumps(report(company_id="WRONG")),
                     json.dumps(report(extra=float("inf"))),
                     json.dumps(report())[:-1] + ', "company_id": "COMP_TEST"}'):
            path.write_text(text)
            code, stdout, stderr = self.invoke()
            self.assertEqual(code, 1)
            self.assertEqual(stdout, "")
            self.assertIn("error:", stderr)
            self.assertEqual(path.read_text(), text)

    def test_failed_atomic_replacement_preserves_target_and_reports_partial_progress(self):
        path = self.put(report(company_id="A", final_score=10))
        original = path.read_bytes()
        with patch("src.alerts.os.replace", side_effect=OSError("disk failure")):
            code, stdout, stderr = self.invoke()
        self.assertEqual(code, 1)
        self.assertEqual(stdout, "")
        self.assertIn("0/1 company reports replaced", stderr)
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(list(path.parent.iterdir()), [path])

    def test_aggregate_failure_is_reported_as_partial_and_not_success(self):
        path = self.put(report(final_score=10))
        replace = alerts.os.replace

        def fail_aggregate(source, target):
            self.assertEqual(Path(source).parent, Path(target).parent)
            json.loads(Path(source).read_text())
            if Path(target).name.startswith("alerts_"):
                raise OSError("aggregate failure")
            replace(source, target)

        with patch("src.alerts.os.replace", side_effect=fail_aggregate):
            code, stdout, stderr = self.invoke()
        self.assertEqual(code, 1)
        self.assertEqual(stdout, "")
        self.assertIn("1/1 company reports replaced", stderr)
        self.assertIn("alerts", json.loads(path.read_text()))

    def test_cli_resolves_default_config_outside_project_and_generation_date_only_names_output(self):
        self.put(report(scoring_date="2026-01-01", latest_observed_month="2025-09",
                        periods_compared={"recent": ["2025-09"], "baseline": []}))
        completed = subprocess.run(
            [sys.executable, "-B", str(ROOT / "run_alerts.py"), "--results-dir", str(self.directory),
             "--generated-on", "2030-02-03"], cwd=self.directory, capture_output=True, text=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        stale = json.loads(completed.stdout)[0]
        self.assertEqual(stale["scoring_date"], "2026-01-01")
        self.assertEqual(stale["trigger_value"], 4)
        self.assertTrue((self.directory / "alerts_20300203.json").exists())

    def test_invalid_generation_date_or_config_prevents_all_writes(self):
        path = self.put(report(final_score=10))
        original = path.read_bytes()
        for extra in (("--generated-on", "2026-02-30"), ("--config", str(self.directory / "absent"))):
            code, stdout, _ = self.invoke(*extra)
            self.assertEqual(code, 1)
            self.assertEqual(stdout, "")
            self.assertEqual(path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
