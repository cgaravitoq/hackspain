"""Offline synthetic checks. No source data, no network.

    python -m unittest discover -s tests
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src import data_pipeline as dp
from src import score_engine as se

CONFIG = se.load_config(Path(__file__).resolve().parents[1] / "src" / "config.yaml")
SCORING_DATE = date(2026, 9, 19)
CUTOFF = pd.Timestamp("2026-09-01")
NO_EXCLUSIONS = {
    "excluded_unknown_product": 0,
    "excluded_non_eur": 0,
    "excluded_no_category": 0,
    "excluded_other_category": 0,
}


def features(rows: dict[str, dict[str, float]]) -> pd.DataFrame:
    """Build a period-indexed feature frame from explicit monthly totals."""
    frame = pd.DataFrame.from_dict(rows, orient="index")
    frame.index = pd.PeriodIndex(frame.index, freq="M", name="period")
    frame = frame.reindex(columns=dp.FEATURE_COLUMNS, fill_value=0.0)
    frame["total_volume"] = frame["operational_inflow"] + frame["operational_outflow"]
    frame["chargeback_rate"] = [
        (row.chargeback_count / row.total_transactions) if row.total_transactions else 0.0
        for row in frame.itertuples()
    ]
    frame["fee_ratio"] = [
        (row.fee_load / row.total_volume) if row.total_volume else 0.0
        for row in frame.itertuples()
    ]
    frame["debt_interest_ratio"] = [
        ((row.debt_repayment_load + row.interest_load) / row.total_volume)
        if row.total_volume
        else 0.0
        for row in frame.itertuples()
    ]
    return frame.sort_index()


def month(label: str, inflow: float, outflow: float, **kwargs) -> tuple[str, dict]:
    row = {
        "operational_inflow": inflow,
        "operational_outflow": outflow,
        "total_transactions": kwargs.pop("total_transactions", 20),
        "chargeback_count": kwargs.pop("chargeback_count", 0),
        "fee_load": kwargs.pop("fee_load", 0.0),
        "debt_repayment_load": kwargs.pop("debt_repayment_load", 0.0),
        "interest_load": kwargs.pop("interest_load", 0.0),
    }
    row.update(kwargs)
    return label, row


def score(rows, exclusions=None, config=CONFIG):
    return se.score_company(
        company_id="COMP_TEST",
        features=features(dict(rows)),
        exclusions=exclusions or NO_EXCLUSIONS,
        config=config,
        scoring_date=SCORING_DATE,
        system_no_category=635860,
        cutoff=CUTOFF,
    )


def ramp(labels: list[str], inflows: list[float]) -> list[tuple[str, dict]]:
    return [month(label, inflow, 100.0) for label, inflow in zip(labels, inflows, strict=True)]


MONTHS_12 = [f"2025-{m:02d}" for m in range(10, 13)] + [f"2026-{m:02d}" for m in range(1, 10)]


class ComponentNormalization(unittest.TestCase):
    def test_caps_the_inflow_outflow_component_at_twice_the_outflow(self):
        rows = [month("2026-01", 500.0, 100.0)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["inflow_outflow_ratio"].iloc[0], 100.0)

    def test_treats_a_zero_outflow_month_with_inflow_as_the_positive_cap(self):
        rows = [month("2026-01", 500.0, 0.0)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["inflow_outflow_ratio"].iloc[0], 100.0)

    def test_treats_a_month_with_no_operational_flow_as_neutral_not_as_failure(self):
        rows = [month("2026-01", 0.0, 0.0, total_transactions=4)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["inflow_outflow_ratio"].iloc[0], 50.0)

    def test_zeroes_the_chargeback_component_at_a_five_percent_refund_rate(self):
        rows = [month("2026-01", 100.0, 100.0, total_transactions=20, chargeback_count=1)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["chargeback_score"].iloc[0], 0.0)

    def test_zeroes_the_fee_component_at_ten_percent_of_operational_volume(self):
        rows = [month("2026-01", 100.0, 100.0, fee_load=20.0)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["fee_score"].iloc[0], 0.0)

    def test_zeroes_the_debt_component_at_twenty_percent_of_operational_volume(self):
        rows = [month("2026-01", 100.0, 100.0, debt_repayment_load=30.0, interest_load=10.0)]
        scores = se.monthly_component_scores(features(dict(rows)))
        self.assertEqual(scores["debt_score"].iloc[0], 0.0)


class BaseScore(unittest.TestCase):
    def test_averages_only_the_last_three_observed_months(self):
        rows = ramp(["2025-01", "2026-06", "2026-07", "2026-08"], [10.0, 100.0, 100.0, 100.0])
        result = score(rows)
        self.assertEqual(result["periods_compared"]["recent"], ["2026-06", "2026-07", "2026-08"])
        # ratio 1.0 -> 50 points, every other component perfect.
        self.assertEqual(result["base_score"], round(0.40 * 50 + 0.60 * 100, 1))

    def test_keeps_every_score_inside_zero_and_one_hundred(self):
        rows = [
            month("2026-06", 0.0, 100.0, chargeback_count=20, fee_load=999.0, interest_load=999.0),
            month("2026-07", 0.0, 100.0, chargeback_count=20, fee_load=999.0, interest_load=999.0),
            month("2026-08", 0.0, 100.0, chargeback_count=20, fee_load=999.0, interest_load=999.0),
        ]
        result = score(rows)
        self.assertEqual(result["base_score"], 0.0)
        self.assertEqual(result["final_score"], 0.0)


class Trajectory(unittest.TestCase):
    def test_reports_insufficient_data_below_four_observed_months(self):
        result = score(ramp(["2026-06", "2026-07", "2026-08"], [100.0, 150.0, 200.0]))
        self.assertEqual(result["trajectory"], "insufficient_data")
        self.assertEqual(result["persistence"], "unconfirmed")
        self.assertEqual(result["trajectory_adjustment"], 0.0)
        self.assertEqual(result["signals"], [])
        self.assertEqual(result["periods_compared"]["baseline"], [])

    def test_compares_against_a_partial_baseline_at_exactly_four_months(self):
        result = score(ramp(["2026-05", "2026-06", "2026-07", "2026-08"], [50, 150, 150, 150]))
        self.assertEqual(result["periods_compared"]["baseline"], ["2026-05"])
        self.assertEqual(result["trajectory"], "improving")

    def test_compares_observed_months_without_bridging_calendar_gaps(self):
        rows = ramp(["2024-01", "2024-02", "2024-03", "2026-06", "2026-07", "2026-08"],
                    [50, 50, 50, 150, 150, 150])
        result = score(rows)
        self.assertEqual(result["periods_compared"]["baseline"], ["2024-01", "2024-02", "2024-03"])
        self.assertEqual(result["trajectory"], "improving")

    def test_calls_an_immaterial_move_stable(self):
        rows = ramp(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
                    [100, 100, 100, 101, 101, 101])
        result = score(rows)
        self.assertEqual(result["trajectory"], "stable")
        self.assertEqual(result["trajectory_adjustment"], 0.0)

    def test_reports_deterioration_when_the_recent_window_falls(self):
        rows = ramp(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
                    [150, 150, 150, 80, 80, 80])
        self.assertEqual(score(rows)["trajectory"], "deteriorating")


class Persistence(unittest.TestCase):
    def test_leaves_a_six_month_trend_unconfirmed(self):
        rows = ramp(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
                    [50, 50, 50, 150, 150, 150])
        result = score(rows)
        self.assertEqual(result["trajectory"], "improving")
        self.assertEqual(result["persistence"], "unconfirmed")
        self.assertEqual(result["trajectory_adjustment"], 0.0)
        self.assertEqual(result["final_score"], result["base_score"])

    def test_confirms_a_trend_that_held_at_the_previous_endpoint(self):
        rows = ramp(MONTHS_12[-9:], [20, 20, 20, 90, 90, 90, 160, 160, 160])
        result = score(rows)
        self.assertEqual(result["trajectory"], "improving")
        self.assertEqual(result["persistence"], "confirmed")
        self.assertGreater(result["trajectory_adjustment"], 0)
        self.assertEqual(
            result["final_score"], round(result["base_score"] + result["trajectory_adjustment"], 1)
        )

    def test_leaves_a_reversal_unconfirmed(self):
        rows = ramp(MONTHS_12[-9:], [160, 160, 160, 20, 20, 20, 90, 90, 90])
        result = score(rows)
        self.assertEqual(result["trajectory"], "improving")
        self.assertEqual(result["persistence"], "unconfirmed")

    def test_confirms_deterioration_with_a_negative_capped_adjustment(self):
        rows = ramp(MONTHS_12[-9:], [200, 200, 200, 120, 120, 120, 40, 40, 40])
        result = score(rows)
        self.assertEqual(result["trajectory"], "deteriorating")
        self.assertEqual(result["persistence"], "confirmed")
        self.assertEqual(result["trajectory_adjustment"], -CONFIG.max_adjustment)

    def test_caps_a_confirmed_improvement_at_the_configured_maximum(self):
        # Raw delta is 12 normalized points, above the 10-point cap, and the
        # base score leaves enough headroom for the cap to be what binds.
        rows = ramp(MONTHS_12[-9:], [0, 0, 0, 60, 60, 60, 120, 120, 120])
        result = score(rows)
        self.assertEqual(result["persistence"], "confirmed")
        self.assertEqual(result["trajectory_adjustment"], CONFIG.max_adjustment)


class AdjustmentInvariants(unittest.TestCase):
    def test_reconciles_signal_contributions_with_the_applied_adjustment(self):
        rows = ramp(MONTHS_12[-9:], [0, 0, 0, 60, 60, 60, 120, 120, 120])
        result = score(rows)
        total = sum(signal["contribution"] for signal in result["signals"])
        self.assertAlmostEqual(total, result["trajectory_adjustment"], places=2)

    def test_zeroes_contributions_when_the_adjustment_is_gated_off(self):
        rows = ramp(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
                    [50, 50, 50, 150, 150, 150])
        result = score(rows)
        self.assertTrue(all(signal["contribution"] == 0 for signal in result["signals"]))
        self.assertTrue(any(signal["change"] != 0 for signal in result["signals"]))

    def test_clips_the_final_score_at_the_upper_bound_and_reports_the_effective_adjustment(self):
        rows = [month(label, 300.0, 100.0) for label in MONTHS_12[-9:]]
        rows[:3] = [month(label, 100.0, 100.0) for label in MONTHS_12[-9:-6]]
        rows[3:6] = [month(label, 200.0, 100.0) for label in MONTHS_12[-6:-3]]
        result = score(rows)
        self.assertEqual(result["final_score"], 100.0)
        self.assertEqual(
            result["trajectory_adjustment"], round(100.0 - result["base_score"], 1)
        )
        total = sum(signal["contribution"] for signal in result["signals"])
        self.assertAlmostEqual(total, result["trajectory_adjustment"], places=2)


class Confidence(unittest.TestCase):
    def test_counts_complete_months_against_available_months(self):
        rows = [
            month("2026-06", 100.0, 100.0, total_transactions=20),
            month("2026-07", 100.0, 100.0, total_transactions=3),
            month("2026-08", 100.0, 100.0, total_transactions=20),
        ]
        confidence = score(rows)["confidence"]
        self.assertEqual(confidence["months_available"], 3)
        self.assertEqual(confidence["months_complete"], 2)
        self.assertEqual(confidence["coverage_pct"], 0.67)
        self.assertEqual(confidence["currency_scope"], "EUR_only")

    def test_does_not_let_thin_months_change_the_score(self):
        thin = [month(label, 100.0, 100.0, total_transactions=1) for label in MONTHS_12[-9:]]
        thick = [month(label, 100.0, 100.0, total_transactions=99) for label in MONTHS_12[-9:]]
        self.assertEqual(score(thin)["final_score"], score(thick)["final_score"])
        self.assertNotEqual(
            score(thin)["confidence"]["months_complete"],
            score(thick)["confidence"]["months_complete"],
        )

    def test_reports_no_measured_score_for_a_company_without_observations(self):
        result = score([])
        self.assertIsNone(result["base_score"])
        self.assertIsNone(result["final_score"])
        self.assertIsNone(result["confidence"]["coverage_pct"])
        self.assertEqual(result["confidence"]["currency_scope"], "insufficient")

    def test_reports_the_configured_rule_version_and_disclosed_limitations(self):
        result = score(ramp(["2026-06", "2026-07", "2026-08"], [100, 100, 100]))
        self.assertEqual(result["rule_version"], "v2.0.0-w3-h9")
        self.assertIn(
            "transfer category excluded (ambiguous internal/external)", result["limitations"]
        )
        self.assertIn(
            "635860 transactions system-wide have no usable category", result["limitations"]
        )


class ConfigValidation(unittest.TestCase):
    def _write(self, text: str) -> Path:
        handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False)
        handle.write(text)
        handle.close()
        return Path(handle.name)

    def test_rejects_weights_that_do_not_sum_to_one(self):
        path = self._write(
            "version: v1\nweights: {inflow_outflow_ratio: 0.5, chargeback_score: 0.1,"
            " fee_score: 0.1, debt_score: 0.1}\n"
            "thresholds: {improving: 2, deteriorating: -2, complete_month: 10, max_adjustment: 10}\n"
        )
        with self.assertRaises(ValueError):
            se.load_config(path)

    def test_rejects_an_adjustment_cap_above_ten_points(self):
        path = self._write(
            "version: v1\nweights: {inflow_outflow_ratio: 0.4, chargeback_score: 0.25,"
            " fee_score: 0.2, debt_score: 0.15}\n"
            "thresholds: {improving: 2, deteriorating: -2, complete_month: 10, max_adjustment: 40}\n"
        )
        with self.assertRaises(ValueError):
            se.load_config(path)

    def test_declares_the_same_categories_the_pipeline_filters_on(self):
        categories = CONFIG.raw["categories"]
        self.assertEqual(
            set(categories["operational_inflow"]), set(dp.OPERATIONAL_INFLOW_CATEGORIES)
        )
        self.assertEqual(
            set(categories["operational_outflow"]), set(dp.OPERATIONAL_OUTFLOW_CATEGORIES)
        )
        self.assertEqual(set(categories["chargeback"]), set(dp.CHARGEBACK_CATEGORIES))
        self.assertTrue(dp.EXCLUDED_ROW_CATEGORIES.issubset(set(categories["excluded"])))


class Pipeline(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        Path(self.dir / "banking_products.csv").write_text(
            "product_id,currency\nP_EUR,EUR\nP_USD,USD\n", encoding="utf-8"
        )
        Path(self.dir / "debt_products.csv").write_text(
            "product_id,currency\nP_DEBT,EUR\n", encoding="utf-8"
        )

    def write_transactions(self, rows: list[tuple[str, str, str, str, str]]) -> None:
        lines = ["transaction_id,company_id,product_id,date,value_date,amount,exchange_rate,"
                 "status,accounting_status,category,description,counterparty_id"]
        for index, (company, product, when, amount, category) in enumerate(rows):
            lines.append(
                f"T{index},{company},{product},{when},2099-01-01 00:00:00,{amount},1,booked,"
                f"DONE,{category},desc,"
            )
        Path(self.dir / "transactions.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_excludes_non_eur_and_unresolved_currency_before_aggregating(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_USD", "2026-01-11 00:00:00", "9000", "collection"),
            ("COMP_1", "P_GHOST", "2026-01-12 00:00:00", "9000", "collection"),
            ("COMP_1", "P_EUR", "2026-02-01 00:00:00", "1", "collection"),
        ])
        dataset = dp.build_dataset(self.dir)
        row = dataset.features.loc[("COMP_1", pd.Period("2026-01", "M"))]
        self.assertEqual(row["operational_inflow"], 100.0)
        self.assertEqual(row["total_transactions"], 1)
        self.assertEqual(dataset.exclusions.loc["COMP_1", "excluded_non_eur"], 1)
        self.assertEqual(dataset.exclusions.loc["COMP_1", "excluded_unknown_product"], 1)

    def test_drops_the_trailing_partial_month_by_default(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-02-01 00:00:00", "5", "collection"),
        ])
        dataset = dp.build_dataset(self.dir)
        self.assertEqual(dataset.cutoff, pd.Timestamp("2026-02-01"))
        self.assertEqual(list(dataset.features.index.get_level_values("period").astype(str)),
                         ["2026-01"])
        self.assertEqual(dataset.totals["after_cutoff"], 1)

    def test_never_reads_value_date(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-02-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-03-10 00:00:00", "100", "collection"),
        ])
        periods = dp.build_monthly_features(self.dir).index.get_level_values("period")
        self.assertNotIn(pd.Period("2099-01", "M"), set(periods))

    def test_omits_months_without_observations_instead_of_writing_zero_rows(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-04-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-05-10 00:00:00", "100", "collection"),
        ])
        periods = [str(period) for period in
                   dp.build_monthly_features(self.dir).index.get_level_values("period")]
        self.assertEqual(periods, ["2026-01", "2026-04"])

    def test_keeps_an_observed_zero_net_month(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-01-11 00:00:00", "-100", "collection_refund"),
            ("COMP_1", "P_EUR", "2026-02-10 00:00:00", "100", "collection"),
        ])
        features_frame = dp.build_monthly_features(self.dir)
        row = features_frame.loc[("COMP_1", pd.Period("2026-01", "M"))]
        self.assertEqual(row["operational_inflow"], 100.0)
        self.assertEqual(row["operational_outflow"], 100.0)
        self.assertEqual(row["chargeback_count"], 1)
        self.assertEqual(row["chargeback_rate"], 0.5)

    def test_excludes_ambiguous_and_uncategorised_rows_from_the_scored_totals(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", "2026-01-10 00:00:00", "100", "collection"),
            ("COMP_1", "P_EUR", "2026-01-11 00:00:00", "500", "transfer"),
            ("COMP_1", "P_EUR", "2026-01-12 00:00:00", "500", "-"),
            ("COMP_1", "P_EUR", "2026-01-13 00:00:00", "-500", "cash_withdrawal"),
            ("COMP_1", "P_EUR", "2026-01-14 00:00:00", "-50", "fee"),
            ("COMP_1", "P_EUR", "2026-02-10 00:00:00", "100", "collection"),
        ])
        dataset = dp.build_dataset(self.dir)
        row = dataset.features.loc[("COMP_1", pd.Period("2026-01", "M"))]
        self.assertEqual(row["operational_inflow"], 100.0)
        self.assertEqual(row["total_transactions"], 2)
        self.assertEqual(row["fee_load"], 50.0)
        self.assertEqual(row["fee_ratio"], 0.5)
        self.assertEqual(dataset.exclusions.loc["COMP_1", "excluded_no_category"], 1)
        self.assertEqual(dataset.exclusions.loc["COMP_1", "excluded_other_category"], 2)

    def test_produces_the_same_result_on_a_rerun(self):
        self.write_transactions([
            ("COMP_1", "P_EUR", f"2026-0{m}-10 00:00:00", "100", "collection") for m in range(1, 9)
        ] + [("COMP_1", "P_EUR", "2026-09-10 00:00:00", "100", "collection")])
        first = se.score_dataset(dp.build_dataset(self.dir), CONFIG, SCORING_DATE)
        second = se.score_dataset(dp.build_dataset(self.dir), CONFIG, SCORING_DATE)
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
