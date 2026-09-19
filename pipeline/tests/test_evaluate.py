import csv
from datetime import date
from pathlib import Path

import polars as pl

from xray.evaluate import auc, evaluate_cutoff, labels_for_cutoff, precision_at_worst, read_credit_scores


def _scores(rows: list[tuple[str, float]]) -> pl.DataFrame:
    return pl.DataFrame(rows, schema={"company_id": pl.String, "score": pl.Float64}, orient="row")


def test_labels_future_payment_delay_deterioration_from_paid_invoices():
    invoices = pl.DataFrame(
        {
            "company_id": ["C1", "C1", "C2", "C2", "C3", "C3"],
            "due_date": [
                date(2026, 1, 10),
                date(2026, 3, 10),
                date(2026, 1, 10),
                date(2026, 3, 10),
                date(2026, 1, 10),
                date(2026, 3, 10),
            ],
            "payment_date": [
                date(2026, 1, 10),
                date(2026, 3, 20),
                date(2026, 1, 20),
                date(2026, 3, 10),
                date(2026, 1, 15),
                None,
            ],
        }
    )

    labels, null_invoices, invoices_in_windows = labels_for_cutoff(invoices, date(2026, 2, 1))

    assert labels.sort("company_id").to_dicts() == [
        {"company_id": "C1", "positive": True},
        {"company_id": "C2", "positive": False},
    ]
    assert null_invoices == 1
    assert invoices_in_windows == 6


def test_auc_counts_a_perfect_order_and_half_credit_for_ties():
    assert auc([10.0, 20.0, 30.0], [True, False, False]) == 1.0
    assert auc([10.0, 10.0, 10.0], [True, False, False]) == 0.5


def test_precision_uses_the_ceil_of_the_worst_ten_percent():
    company_ids = [f"C{index:02d}" for index in range(11)]
    scores = [float(index) for index in range(11)]
    positives = [True, False] + [True] * 9

    assert precision_at_worst(company_ids, scores, positives) == 0.5


def test_one_missing_candidate_score_drops_the_company_from_every_candidate():
    labels = pl.DataFrame({"company_id": ["C1", "C2", "C3"], "positive": [True, False, True]})
    pipeline = _scores([("C1", 10), ("C2", 20), ("C3", 30)])
    credit = _scores([("C1", 10), ("C2", 20)])
    naive = _scores([("C1", 10), ("C2", 20), ("C3", 30)])

    rows = evaluate_cutoff("2026-02", labels, pipeline, credit, naive, null_invoices=0)

    assert [row["companies"] for row in rows] == [2, 2, 2]
    assert [row["positives"] for row in rows] == [1, 1, 1]
    assert [row["pairs"] for row in rows] == [1, 1, 1]


def test_credit_scoring_scores_are_read_from_the_cutoff_csv(tmp_path: Path):
    path = tmp_path / "2026-02.csv"
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["company_id", "score"])
        writer.writeheader()
        writer.writerows([{"company_id": "C2", "score": 20.0}, {"company_id": "C1", "score": 10.0}])

    assert read_credit_scores(tmp_path, "2026-02").to_dicts() == [
        {"company_id": "C1", "score": 10.0},
        {"company_id": "C2", "score": 20.0},
    ]
