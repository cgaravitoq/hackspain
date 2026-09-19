import csv
import json
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path

import polars as pl
import pytest

from xray.events import backtest, cash_stress, debt_break, overdue_invoice_months, recovery
from xray.export import alert_kind, alert_stage, build
from xray.load import read
from xray.panel import monthly_panel
from xray.score import (
    ADJUSTMENT_CAP,
    EXIT_FACTOR,
    HEALTHY_LEVEL,
    LAMBDA,
    MOMENTUM_THRESHOLD,
    PENALTY_CAP,
    PERSISTENCE_MONTHS,
    RULE_VERSION,
    VOLATILITY_FACTOR,
    policy,
    score_panel,
    states,
)


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def seed_dataset(
    folder: Path,
    *,
    tx_date_override: str | None = None,
    invoice_date_override: dict[str, str] | None = None,
    months: int = 3,
    missing_months: tuple[int, ...] = (),
) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    _write_csv(folder / "companies.csv", [{"company_id": "C1", "group_id": "G1", "currency": "EUR"}])
    _write_csv(folder / "groups.csv", [{"group_id": "G1", "erp": "holded"}])
    _write_csv(
        folder / "banking_products.csv",
        [{"product_id": "P1", "currency": "EUR"}, {"product_id": "P2", "currency": "USD"}],
    )
    txs: list[dict[str, object]] = []
    for index in range(months):
        if index + 1 in missing_months:
            continue
        month = f"2026-{index + 1:02d}-15"
        day = tx_date_override if tx_date_override and month == "2026-03-15" else month
        inflow, outflow = (300.0, -100.0) if index < 3 else (100.0, -300.0)
        txs.append(
            {
                "company_id": "C1",
                "date": day,
                "amount": inflow,
                "category": "collection",
                "status": "booked",
                "product_id": "P1",
                "exchange_rate": 1.0,
            }
        )
        txs.append(
            {
                "company_id": "C1",
                "date": day,
                "amount": outflow,
                "category": "payment",
                "status": "booked",
                "product_id": "P1",
                "exchange_rate": 1.0,
            }
        )
    _write_csv(folder / "transactions.csv", txs)
    invoice: dict[str, object] = {
        "company_id": "C1",
        "document_type": "invoice",
        "amount": 50.0,
        "pending_amount": 50.0,
        "issuance_date": "2026-01-01",
        "due_date": "2026-01-31",
        "payment_date": "2026-01-31",
        "status": "open",
        "counterparty_id": "X1",
    }
    _write_csv(folder / "invoices.csv", [{**invoice, **(invoice_date_override or {})}])
    _write_csv(
        folder / "balances.csv",
        [
            {"product_id": "P1", "company_id": "C1", "date": "2026-09-01", "balance": 1000.0},
            {"product_id": "P2", "company_id": "C1", "date": "2026-09-01", "balance": 700.0},
        ],
    )
    _write_csv(
        folder / "debt_products.csv",
        [
            {"company_id": "C1", "type": "loan", "currency": "EUR", "outstanding": 10.0, "granted": 100.0},
            {"company_id": "C1", "type": "lineofcredit", "currency": "EUR", "outstanding": -2000.0, "granted": -5000.0},
            {"company_id": "C1", "type": "lineofcredit", "currency": "USD", "outstanding": -300.0, "granted": -900.0},
        ],
    )
    return folder


def transactions(rows: list[tuple[str, float, str]]) -> pl.DataFrame:
    return pl.DataFrame(
        {
            "company_id": ["C1"] * len(rows),
            "month": [date.fromisoformat(f"{month}-01") for month, _, _ in rows],
            "amount": [amount for _, amount, _ in rows],
            "category": [category for _, _, category in rows],
        }
    )


def months_of(*amounts: tuple[float, float]) -> list[tuple[str, float, str]]:
    rows: list[tuple[str, float, str]] = []
    for index, (inflow, outflow) in enumerate(amounts):
        month = f"2026-{index + 1:02d}"
        rows.append((month, inflow, "collection"))
        rows.append((month, -outflow, "payment"))
    return rows


def trajectory(rows: list[tuple[str, float, str]]) -> list[dict[str, object]]:
    scored = score_panel(monthly_panel(transactions(rows))).to_dicts()
    state_list = states(
        [row["momentum"] for row in scored],
        [row["level"] for row in scored],
        [row["threshold"] for row in scored],
    )
    return [
        {**row, "month": str(row["month"])[:7], "state": state}
        for row, state in zip(scored, state_list, strict=True)
    ]


def test_level_is_the_share_of_operating_inflow_minus_fee_and_refund_penalties():
    rows = []
    for month in ("2026-01", "2026-02", "2026-03"):
        rows += [(month, 300.0, "collection"), (month, -100.0, "payment"), (month, -10.0, "fee"), (month, 500.0, "transfer")]
    scored = score_panel(monthly_panel(transactions(rows)))
    last = scored.row(-1, named=True)
    assert last["inflow_3"] == 900.0
    assert last["outflow_3"] == 330.0
    assert round(last["balance"], 2) == round(100 * 900 / 1230, 2)
    assert round(last["fee_penalty"], 2) == round(-100 * 30 / 330, 2)
    assert round(last["level"], 2) == round(last["balance"] + last["fee_penalty"], 2)
    assert last["momentum"] is None


def test_falling_needs_three_persistent_months_and_slipping_comes_first():
    momentum = [None, None, -6.0, -6.0, -6.0, -3.0, 1.0, 7.0, 7.0, 7.0]
    level = [None, None, 55.0, 50.0, 45.0, 44.0, 44.0, 50.0, 58.0, 65.0]
    assert states(momentum, level, [5.0] * len(momentum)) == [
        "not_evaluable",
        "not_evaluable",
        "slipping",
        "slipping",
        "falling",
        "falling",
        "stable",
        "stable",
        "stable",
        "improving",
    ]


def test_a_hole_in_the_middle_nulls_exactly_the_windows_that_contain_it():
    rows = [row for row in months_of(*([(300.0, 100.0)] * 7)) if row[0] != "2026-04"]
    scored = {row["month"]: row for row in trajectory(rows)}
    assert [scored[month]["observed"] for month in ("2026-03", "2026-04", "2026-05", "2026-06", "2026-07")] == [
        True,
        False,
        True,
        True,
        True,
    ]
    assert [scored[month]["observed_3"] for month in ("2026-03", "2026-04", "2026-05", "2026-06", "2026-07")] == [
        3,
        2,
        2,
        2,
        3,
    ]
    assert [scored[month]["level"] for month in ("2026-03", "2026-04", "2026-05", "2026-06", "2026-07")] == [
        75.0,
        None,
        None,
        None,
        75.0,
    ]
    assert {row["state"] for row in scored.values()} == {"not_evaluable"}


def test_insufficient_evidence_stays_not_evaluable():
    two_months = trajectory(months_of((300.0, 100.0), (300.0, 100.0)))
    assert [row["level"] for row in two_months] == [None, None]
    assert {row["state"] for row in two_months} == {"not_evaluable"}

    gapped = trajectory([row for row in months_of(*[(300.0, 100.0)] * 5) if row[0] != "2026-03"])
    assert [row["level"] for row in gapped] == [None, None, None, None, None]
    assert {row["state"] for row in gapped} == {"not_evaluable"}


def test_improvement_reaches_improving_after_three_months_of_rising_level():
    rising = [(100.0 + 50.0 * index, 100.0) for index in range(9)]
    rows = trajectory(months_of(*rising))
    assert [round(row["momentum"], 1) for row in rows[5:]] == [15.0, 11.1, 8.6, 6.8]
    assert [round(row["level"], 1) for row in rows[5:]] == [75.0, 77.8, 80.0, 81.8]
    assert [row["state"] for row in rows] == [
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "healthy",
        "healthy",
        "improving",
        "improving",
    ]


def test_deterioration_slips_first_and_only_falls_after_three_persistent_months():
    rows = trajectory(months_of(*([(300.0, 100.0)] * 3 + [(200.0, 200.0)] * 3 + [(100.0, 300.0)] * 3)))
    assert [round(row["momentum"], 1) for row in rows[5:]] == [-25.0, -25.0, -25.0, -25.0]
    assert [row["state"] for row in rows] == [
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "slipping",
        "slipping",
        "falling",
        "falling",
    ]


def test_a_one_month_dip_returns_to_stable_without_ever_falling():
    # The rebound needs three more up months before it counts as an improvement, so the dip settles back into stable.
    rows = trajectory(months_of(*([(200.0, 200.0)] * 3 + [(0.0, 400.0)] + [(200.0, 200.0)] * 3)))
    assert [round(row["momentum"], 1) for row in rows[5:]] == [-16.7, 16.7]
    assert [row["state"] for row in rows] == [
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "not_evaluable",
        "slipping",
        "stable",
    ]


def test_cash_stress_and_debt_break_events():
    assert cash_stress([True] * 4, [50, 50, 50, 90], [80, 80, 80, 80]) == [False, False, True, False]
    assert debt_break([100] * 6 + [0, 100]) == [0, 0, 0, 0, 0, 0, 6, 0]


def test_recovery_needs_three_covered_months_after_stress():
    assert recovery(
        [True] * 7,
        [50, 50, 50, 90, 90, 90, 90],
        [80, 80, 80, 70, 70, 70, 70],
        [False, False, True, False, False, False, False],
    ) == [False, False, False, False, False, True, True]


def test_overdue_invoice_months_uses_the_earliest_due_plus_ninety_days():
    invoices = pl.DataFrame(
        {
            "company_id": ["C1", "C1", "C2", "C3"],
            "amount": [100.0] * 4,
            "issuance_date": [date(2025, 12, 1)] * 4,
            "status": ["pending", "pending", "pending", "paid"],
            "pending_amount": [10.0, 5.0, 1.0, 0.0],
            "due_date": [date(2026, 1, 15), date(2026, 6, 3), date(2026, 6, 4), date(2026, 1, 1)],
            "payment_date": [None, None, None, date(2026, 1, 1)],
        }
    )
    assert overdue_invoice_months(invoices) == {"C1": date(2026, 4, 1)}


def test_e2_fires_for_a_late_payment_and_for_an_invoice_still_unpaid_ninety_days_past_due():
    invoices = pl.DataFrame(
        {
            "company_id": ["C1", "C2", "C3", "C4"],
            "amount": [100.0] * 4,
            "issuance_date": [date(2026, 1, 1)] * 4,
            "status": ["paid", "paid", "pending", "pending"],
            "due_date": [date(2026, 1, 31), date(2026, 1, 31), date(2026, 1, 31), date(2026, 6, 10)],
            "payment_date": [date(2026, 5, 1), date(2026, 4, 30), None, None],
            "pending_amount": [0.0, 0.0, 50.0, 100.0],
        }
    )
    # C1 is exactly ninety days late; C2 is one day short; C3 is unpaid and due ninety days ago; C4 falls past the cutoff.
    assert overdue_invoice_months(invoices) == {"C1": date(2026, 5, 1), "C3": date(2026, 5, 1)}


def invoice_evidence(**changes: object) -> pl.DataFrame:
    row = {
        "company_id": "C1", "amount": 100.0, "pending_amount": 0.0, "status": "paid",
        "issuance_date": date(2026, 1, 1), "due_date": date(2026, 1, 31), "payment_date": date(2026, 5, 1),
    }
    return pl.DataFrame([{**row, **changes}], schema_overrides={
        "amount": pl.Float64, "pending_amount": pl.Float64, "status": pl.String,
        "issuance_date": pl.Date, "due_date": pl.Date, "payment_date": pl.Date,
    })


@pytest.mark.parametrize("changes", [
    {"status": "cancel", "pending_amount": 50.0},
    {"status": "unknown", "pending_amount": 50.0},
    {"status": "pending"},
    {"pending_amount": 50.0},
    {"pending_amount": -1.0},
    {"pending_amount": None},
    {"pending_amount": float("nan")},
    {"status": "pending", "pending_amount": 101.0},
    {"status": "pending", "pending_amount": float("inf")},
    {"amount": float("inf")},
    {"amount": float("nan")},
    {"amount": 0.0},
    {"amount": -100.0},
    {"issuance_date": date(2026, 2, 1)},
    {"issuance_date": None},
    {"payment_date": date(2026, 9, 1)},
    {"payment_date": date(6913, 11, 20)},
    {"payment_date": None},
    {"status": "pending", "pending_amount": 50.0, "payment_date": date(2025, 12, 31)},
])
def test_e2_rejects_inconsistent_invoice_evidence(changes):
    assert overdue_invoice_months(invoice_evidence(**changes)) == {}


@pytest.mark.parametrize("status", ["pending", "overdue", "paymentOrder", "payment_in_progress", "open"])
@pytest.mark.parametrize("payment_date", [None, date(2026, 1, 31), date(2026, 10, 1)])
def test_e2_uses_the_outstanding_balance_not_the_scheduled_payment_date(status, payment_date):
    invoice = invoice_evidence(status=status, pending_amount=50.0, payment_date=payment_date)

    assert overdue_invoice_months(invoice) == {"C1": date(2026, 5, 1)}


def test_e2_excludes_an_event_that_only_reaches_ninety_days_at_the_exclusive_cutoff():
    invoices = pl.concat([
        invoice_evidence(company_id="C1", status="pending", pending_amount=50.0,
                         due_date=date(2026, 6, 2), payment_date=None),
        invoice_evidence(company_id="C2", status="pending", pending_amount=50.0,
                         due_date=date(2026, 6, 3), payment_date=None),
    ])

    assert overdue_invoice_months(invoices) == {"C1": date(2026, 8, 1)}


def test_e2_filters_invalid_earlier_invoices_before_selecting_the_first_event():
    invoices = pl.concat([
        invoice_evidence(status="cancel", pending_amount=100.0, due_date=date(2026, 1, 1)),
        invoice_evidence(),
    ])

    assert overdue_invoice_months(invoices) == {"C1": date(2026, 5, 1)}


def test_alert_kind_labels_down_up_and_recovered_transitions():
    assert alert_kind("healthy", "healthy") is None
    assert alert_kind("healthy", "slipping") == "down"
    assert alert_kind("slipping", "falling") == "down"
    assert alert_kind("healthy", "improving") == "up"
    assert alert_kind("slipping", "healthy") == "recovered"
    assert alert_kind("slipping", "improving") == "up"
    assert alert_kind("falling", "slipping") is None
    assert alert_kind("healthy", "stable") is None


def backtest_rows(
    states: list[str], e1: list[bool], e2: list[bool] | None = None
) -> list[dict[str, object]]:
    late = e2 or [False] * len(states)
    return [
        {"state": state, "e1": flag, "e2": overdue, "e3": 0}
        for state, flag, overdue in zip(states, e1, late, strict=True)
    ]


def test_alert_stage_labels_a_candidate_and_a_confirmed_decline():
    assert alert_stage("down", "slipping") == "candidate"
    assert alert_stage("down", "falling") == "confirmed"
    assert alert_stage("up", "improving") is None
    assert alert_stage("recovered", "stable") is None


def test_backtest_splits_all_alerts_into_the_candidate_and_confirmed_blocks():
    confirms = backtest_rows(
        ["healthy"] * 4 + ["slipping", "slipping", "falling", "falling", "falling", "falling"] + ["stable"] * 3,
        [False] * 13,
    )
    dips = backtest_rows(["healthy"] * 4 + ["slipping"] + ["stable"] * 8, [False] * 13)
    summary = backtest({"confirms": confirms, "dips": dips})
    assert summary["alerts"] == {
        "evaluated": 2,
        "false_alarms": 2,
        "false_alarm_rate": 1.0,
        "reverted_within_3_months": 1,
        "revert_rate": 0.5,
        "censored": 0,
    }
    assert summary["alerts_by_stage"] == {
        "candidate": {
            "evaluated": 1,
            "false_alarms": 1,
            "false_alarm_rate": 1.0,
            "reverted_within_3_months": 1,
            "revert_rate": 1.0,
            "censored": 0,
        },
        "confirmed": {
            "evaluated": 1,
            "false_alarms": 1,
            "false_alarm_rate": 1.0,
            "reverted_within_3_months": 0,
            "revert_rate": 0.0,
            "censored": 0,
        },
    }


def test_confirmed_alerts_are_anchored_on_the_month_the_decline_reaches_falling():
    # The decline drops back to stable two months after it reaches falling, so anchoring the confirmed
    # alert on the episode start would report no revert while anchoring it on the falling month reports one.
    rows = backtest_rows(
        ["healthy"] * 4 + ["slipping", "slipping", "falling", "falling"] + ["stable"] * 5,
        [False] * 13,
    )
    summary = backtest({"C1": rows})
    assert summary["alerts_by_stage"]["candidate"] == {
        "evaluated": 0,
        "false_alarms": 0,
        "false_alarm_rate": None,
        "reverted_within_3_months": 0,
        "revert_rate": None,
        "censored": 0,
    }
    assert summary["alerts_by_stage"]["confirmed"]["evaluated"] == 1
    assert summary["alerts_by_stage"]["confirmed"]["reverted_within_3_months"] == 1
    assert summary["alerts"]["reverted_within_3_months"] == 0


def test_backtest_measures_the_lead_of_an_e2_event():
    rows = backtest_rows(
        ["falling", "falling", "falling", "stable"] + ["stable"] * 5,
        [False] * 9,
        [False] * 4 + [True] + [False] * 4,
    )
    summary = backtest({"C1": rows})
    assert summary["events"]["E2"] == {
        "events": 1,
        "with_prior_alert": 1,
        "coverage": 1.0,
        "median_lead_months": 4,
    }
    assert summary["definitions"]["E2"].startswith("The month ninety days past the due date")


def test_false_alarm_horizon_counts_an_event_inside_six_months_and_not_after():
    inside = backtest_rows(["slipping"] + ["stable"] * 12, [False] * 6 + [True] + [False] * 6)
    outside = backtest_rows(["slipping"] + ["stable"] * 12, [False] * 7 + [True] + [False] * 5)
    summary = backtest({"inside": inside, "outside": outside})
    assert summary["alerts"]["evaluated"] == 2
    assert summary["alerts"]["false_alarms"] == 1
    assert summary["events"]["E1"]["median_lead_months"] == 6.5


def test_revert_horizon_counts_a_recovery_three_months_after_the_alert_but_not_four():
    at_three = backtest_rows(["slipping", "falling", "falling", "stable"] + ["stable"] * 9, [False] * 13)
    at_four = backtest_rows(["slipping", "falling", "falling", "falling", "stable"] + ["stable"] * 8, [False] * 13)
    summary = backtest({"three": at_three, "four": at_four})
    assert summary["alerts"]["evaluated"] == 2
    assert summary["alerts"]["reverted_within_3_months"] == 1


def test_lead_window_counts_an_alert_twelve_months_before_the_event_but_not_thirteen():
    twelve = backtest_rows(["slipping"] + ["stable"] * 13, [False] * 12 + [True] + [False])
    thirteen = backtest_rows(["slipping"] + ["stable"] * 13, [False] * 13 + [True])
    summary = backtest({"twelve": twelve, "thirteen": thirteen})
    assert summary["events"]["E1"] == {
        "events": 2,
        "with_prior_alert": 1,
        "coverage": 0.5,
        "median_lead_months": 12,
    }


def test_backtest_keeps_the_third_month_of_an_e1_run_as_a_hit():
    alert_on_second_month = backtest_rows(
        ["healthy"] * 6 + ["slipping"] + ["falling"] * 6,
        [False] * 5 + [True] * 3 + [False] * 5,
    )
    run_cut_after_second_month = backtest_rows(["healthy", "slipping", "falling"], [False, True, True])
    summary = backtest({"C1": alert_on_second_month, "C2": run_cut_after_second_month})
    assert summary["events"]["E1"] == {
        "events": 2,
        "with_prior_alert": 0,
        "coverage": 0.0,
        "median_lead_months": None,
    }
    assert summary["alerts"] == {
        "evaluated": 1,
        "false_alarms": 0,
        "false_alarm_rate": 0.0,
        "reverted_within_3_months": 0,
        "revert_rate": 0.0,
        "censored": 1,
    }


def test_read_rejects_unparsable_transaction_dates(tmp_path: Path):
    seed_dataset(tmp_path, tx_date_override="not-a-date")
    with pytest.raises(pl.exceptions.InvalidOperationError, match=r"column 'date' .*\"not-a-date\""):
        read(tmp_path)


@pytest.mark.parametrize("column", ["issuance_date", "due_date", "payment_date"])
def test_read_rejects_unparsable_invoice_dates(tmp_path: Path, column: str):
    seed_dataset(tmp_path, invoice_date_override={column: "not-a-date"})
    with pytest.raises(pl.exceptions.InvalidOperationError, match=rf"column '{column}' .*\"not-a-date\""):
        read(tmp_path)


def test_policy_mirrors_the_constants_the_rules_read():
    assert policy() == {
        "rule_version": RULE_VERSION,
        "parameters": {
            "lambda": LAMBDA,
            "adjustment_cap": ADJUSTMENT_CAP,
            "momentum_threshold": MOMENTUM_THRESHOLD,
            "volatility_factor": VOLATILITY_FACTOR,
            "exit_factor": EXIT_FACTOR,
            "penalty_cap": PENALTY_CAP,
            "healthy_level": HEALTHY_LEVEL,
            "persistence_months": PERSISTENCE_MONTHS,
            "window_months": 3,
            "min_months": 3,
            "momentum_min_months": 6,
        },
    }


def test_build_stamps_the_policy_on_every_artifact_it_writes(tmp_path: Path):
    data = seed_dataset(tmp_path / "data", months=8)
    _write_csv(
        data / "companies.csv",
        [
            {"company_id": "C1", "group_id": "G1", "currency": "EUR"},
            {"company_id": "C2", "group_id": "G1", "currency": "EUR"},
        ],
    )
    out = tmp_path / "out"
    build(read(data), out, seed=42)
    meta = json.loads((out / "meta.json").read_text())
    assert meta["rule_version"] == RULE_VERSION
    assert meta["policy"] == policy()["parameters"]
    assert datetime.fromisoformat(meta["generated_at"]).tzinfo is not None
    companies = json.loads((out / "companies.json").read_text())
    assert {company["company_id"] for company in companies} == {"C1", "C2"}
    assert {company["rule_version"] for company in companies} == {RULE_VERSION}
    alerts = json.loads((out / "alerts.json").read_text())
    assert [alert["kind"] for alert in alerts] == ["down"]
    assert {alert["rule_version"] for alert in alerts} == {RULE_VERSION}
    assert json.loads((out / "backtest.json").read_text())["rule_version"] == RULE_VERSION
    detail = json.loads((out / "scores" / "C1.json").read_text())
    assert detail["rule_version"] == RULE_VERSION


def test_build_exports_score_deltas_from_three_and_six_entries_earlier(tmp_path: Path) -> None:
    dataset = read(seed_dataset(tmp_path / "data"))
    rows: list[tuple[str, float, str]] = []
    for month in range(1, 13):
        key = f"2025-{month:02d}"
        if 7 <= month <= 9:
            rows.append((key, 100.0, "transfer"))
        else:
            inflow, outflow = (100.0, -300.0) if 4 <= month <= 6 else (300.0, -100.0)
            rows.extend([(key, inflow, "collection"), (key, outflow, "payment")])
    txs = transactions(rows)
    dataset = replace(
        dataset,
        companies=pl.DataFrame({
            "company_id": ["C1", "C2", "C3"],
            "group_id": ["G1"] * 3,
            "currency": ["EUR"] * 3,
        }),
        transactions=pl.concat([txs, txs.with_columns(company_id=pl.lit("C2"), amount=-pl.col("amount"))]),
    )
    out = tmp_path / "out"
    build(dataset, out, seed=42)
    detail = json.loads((out / "scores" / "C1.json").read_text())
    series = detail["series"]
    assert [entry["score"] for entry in series] == [None, None, 75.0, 58.3, 41.7, 15.0, 16.7, 20.8, None, 85.0, 85.0, 75.0]
    assert [entry["delta_3"] for entry in series] == [None, None, None, None, None, -60.0, -41.6, -20.9, None, 68.3, 64.2, None]
    assert [entry["delta_6"] for entry in series] == [None, None, None, None, None, None, None, None, None, 26.7, 43.3, 60.0]
    assert detail["latest"]["delta_3"] is None
    assert detail["latest"]["delta_6"] == 60.0
    other = json.loads((out / "scores" / "C2.json").read_text())
    assert [entry["delta_3"] for entry in other["series"][:5]] == [None] * 5
    assert other["latest"]["delta_6"] == -60.0
    companies = json.loads((out / "companies.json").read_text())
    assert companies[0]["latest"] == detail["latest"]
    assert companies[1]["latest"] == other["latest"]
    assert companies[2]["latest"]["delta_3"] is None
    assert companies[2]["latest"]["delta_6"] is None


def test_build_writes_artifact_files_and_one_company_series(tmp_path: Path):
    data = seed_dataset(tmp_path / "data", months=8)
    out = tmp_path / "out"
    summary = build(read(data), out, seed=42)
    assert summary["companies"] == 1
    assert summary["scorable"] == 1
    assert summary["alerts"] == 1
    for name in ("companies.json", "alerts.json", "groups.json", "backtest.json", "meta.json"):
        assert (out / name).is_file()
    payload = json.loads((out / "scores" / "C1.json").read_text())
    assert [entry["month"] for entry in payload["series"]] == [
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
    ]
    assert [entry["month"] for entry in payload["series"] if entry["events"]["E2"]] == ["2026-05"]
    assert [entry["month"] for entry in payload["series"] if entry["events"]["E1"]] == ["2026-06", "2026-07", "2026-08"]
    last = payload["series"][-1]
    assert last["flows"] == {
        "inflow": 100.0,
        "outflow": 300.0,
        "financing_in": 0.0,
        "financing_out": 0.0,
        "debt_repayment": 0.0,
    }
    assert last["level"] == 25.0
    assert last["score"] == 20.8
    assert last["momentum"] == -16.7
    assert last["state"] == "falling"
    assert last["confidence"] == "medium"
    assert last["events"] == {"E1": True, "E2": False, "E3": False, "E4": False}
    assert json.loads((out / "alerts.json").read_text(encoding="utf-8")) == [
        {
            "rule_version": RULE_VERSION,
            "company_id": "C1",
            "group_id": "G1",
            "month": "2026-08",
            "kind": "down",
            "stage": "confirmed",
            "state": "falling",
            "previous_state": "slipping",
            "score": 20.8,
            "delta": 4.1,
            "driver": "Cobros 300 € frente a pagos 900 € en 2026-06 a 2026-08: cobertura 0.33",
        }
    ]
    assert payload["treasury"] == {
        "starting_cash": 1000.0,
        "pending_receivables": 50.0,
        "credit_line_limit": 5000.0,
        "credit_line_drawn": 2000.0,
    }
    assert json.loads((out / "companies.json").read_text())[0]["treasury"] == payload["treasury"]
    meta = json.loads((out / "meta.json").read_text())
    assert meta["latest_month"] == "2026-08"
    assert meta["state_labels"]["healthy"] == "sana"
    assert meta["gaps"] == {"companies_with_gaps": 0, "unobserved_months": 0, "stale_companies": 0}


def test_build_writes_utf8_whatever_the_platform_locale(tmp_path: Path):
    out = tmp_path / "out"
    build(read(seed_dataset(tmp_path / "data")), out, seed=42)
    meta = json.loads((out / "meta.json").read_bytes().decode("utf-8"))
    assert meta["state_labels"]["slipping"] == "torciéndose"


def test_a_stale_company_reports_not_evaluable_as_its_latest_state(tmp_path: Path):
    stale_data = seed_dataset(tmp_path / "stale", months=7)
    fresh_data = seed_dataset(tmp_path / "fresh", months=8)
    build(read(stale_data), tmp_path / "stale-out", seed=42)
    build(read(fresh_data), tmp_path / "fresh-out", seed=42)
    stale = json.loads((tmp_path / "stale-out" / "companies.json").read_text())[0]
    assert stale["last_observed_month"] == "2026-07"
    assert stale["stale"] is True
    assert stale["latest"]["state"] == "not_evaluable"
    assert stale["latest"]["confidence"] == "none"
    assert stale["latest"]["level"] is not None
    assert json.loads((tmp_path / "stale-out" / "alerts.json").read_text()) == []
    series = json.loads((tmp_path / "stale-out" / "scores" / "C1.json").read_text())["series"]
    assert [entry["state"] for entry in series][-2:] == ["slipping", "slipping"]
    assert series[-1]["confidence"] == "medium"
    assert series[-1]["score"] == stale["latest"]["score"]
    fresh = json.loads((tmp_path / "fresh-out" / "companies.json").read_text())[0]
    assert fresh["last_observed_month"] == "2026-08"
    assert fresh["stale"] is False
    assert fresh["latest"]["state"] == "falling"


def test_missing_recent_months_clear_confidence_without_rewriting_valid_history(tmp_path: Path):
    dataset = read(seed_dataset(tmp_path / "data"))
    rows = [
        (f"{year}-{month:02d}", amount, category)
        for year, months in ((2025, range(1, 13)), (2026, range(1, 9)))
        for month in months if (year, month) != (2026, 7)
        for amount, category in ((300.0, "collection"), (-100.0, "payment"))
    ]
    out = tmp_path / "out"
    build(replace(dataset, transactions=transactions(rows)), out, seed=42)
    detail = json.loads((out / "scores" / "C1.json").read_text())
    series = {entry["month"]: entry for entry in detail["series"]}

    assert detail["months_observed"] == 19
    assert detail["stale"] is False
    assert series["2026-06"]["score"] == 75.0
    assert series["2026-06"]["confidence"] == "high"
    for month in ("2026-07", "2026-08"):
        assert series[month]["score"] is None
        assert series[month]["confidence"] == "none"
    assert detail["latest"]["confidence"] == "none"
    assert json.loads((out / "companies.json").read_text())[0]["latest"] == detail["latest"]
    assert json.loads((out / "groups.json").read_text())[0]["members"][0]["confidence"] == "none"


def test_meta_gap_counts_match_the_fixture(tmp_path: Path):
    gapped = seed_dataset(tmp_path / "gapped", months=8, missing_months=(4, 5))
    stale = seed_dataset(tmp_path / "stale", months=7)
    build(read(gapped), tmp_path / "gapped-out", seed=42)
    build(read(stale), tmp_path / "stale-out", seed=42)
    gapped_meta = json.loads((tmp_path / "gapped-out" / "meta.json").read_text())
    assert gapped_meta["gaps"] == {"companies_with_gaps": 1, "unobserved_months": 2, "stale_companies": 0}
    stale_meta = json.loads((tmp_path / "stale-out" / "meta.json").read_text())
    assert stale_meta["gaps"] == {"companies_with_gaps": 0, "unobserved_months": 0, "stale_companies": 1}


def test_treasury_is_zero_for_a_company_without_balances_invoices_or_credit_lines(tmp_path: Path):
    data = seed_dataset(tmp_path / "data")
    for name, header in (
        ("balances.csv", "product_id,company_id,date,balance\n"),
        ("debt_products.csv", "company_id,type,currency,outstanding,granted\n"),
        (
            "invoices.csv",
            "company_id,document_type,amount,pending_amount,issuance_date,due_date,payment_date,status,counterparty_id\n",
        ),
    ):
        (data / name).write_text(header)
    out = tmp_path / "out"
    build(read(data), out, seed=42)
    record = json.loads((out / "companies.json").read_text())[0]
    assert record["treasury"] == {
        "starting_cash": 0.0,
        "pending_receivables": 0.0,
        "credit_line_limit": 0.0,
        "credit_line_drawn": 0.0,
    }
    assert json.loads((out / "scores" / "C1.json").read_text())["treasury"] == record["treasury"]


def test_treasury_counts_only_eur_accounts_and_eur_credit_lines(tmp_path: Path):
    dataset = read(seed_dataset(tmp_path / "data"))
    assert dataset.balances.get_column("product_id").to_list() == ["P1"]
    assert dataset.balances.get_column("balance").sum() == 1000.0
    lines = dataset.debt.filter(pl.col("type") == "lineofcredit")
    assert lines.get_column("currency").to_list() == ["EUR"]
    assert lines.get_column("granted").sum() == 5000.0
    assert lines.get_column("outstanding").sum() == 2000.0
    out = tmp_path / "out"
    build(dataset, out, seed=42)
    treasury = json.loads((out / "companies.json").read_text())[0]["treasury"]
    assert treasury["starting_cash"] == 1000.0
    assert treasury["credit_line_limit"] == 5000.0
    assert treasury["credit_line_drawn"] == 2000.0
