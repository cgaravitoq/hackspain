import csv
import json
from datetime import date, datetime
from pathlib import Path

import polars as pl
import pytest

from xray.events import backtest, cash_stress, debt_break, overdue_invoice_months, recovery
from xray.export import alert_kind, build
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
) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    _write_csv(folder / "companies.csv", [{"company_id": "C1", "group_id": "G1", "currency": "EUR"}])
    _write_csv(folder / "groups.csv", [{"group_id": "G1", "erp": "holded"}])
    _write_csv(folder / "banking_products.csv", [{"product_id": "P1", "currency": "EUR"}])
    txs: list[dict[str, object]] = []
    for index in range(months):
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
        "status": "open",
        "counterparty_id": "X1",
    }
    _write_csv(folder / "invoices.csv", [{**invoice, **(invoice_date_override or {})}])
    _write_csv(folder / "debt_products.csv", [{"company_id": "C1", "type": "loan", "outstanding": 10.0}])
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
            "pending_amount": [10.0, 5.0, 1.0, 0.0],
            "due_date": [date(2026, 1, 15), date(2026, 6, 3), date(2026, 6, 4), date(2026, 1, 1)],
        }
    )
    assert overdue_invoice_months(invoices) == {"C1": date(2026, 4, 1)}


def test_alert_kind_labels_down_up_and_recovered_transitions():
    assert alert_kind("healthy", "healthy") is None
    assert alert_kind("healthy", "slipping") == "down"
    assert alert_kind("slipping", "falling") == "down"
    assert alert_kind("healthy", "improving") == "up"
    assert alert_kind("slipping", "healthy") == "recovered"
    assert alert_kind("slipping", "improving") == "up"
    assert alert_kind("falling", "slipping") is None
    assert alert_kind("healthy", "stable") is None


def backtest_rows(states: list[str], e1: list[bool]) -> list[dict[str, object]]:
    return [{"state": state, "e1": flag, "e3": 0} for state, flag in zip(states, e1, strict=True)]


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


@pytest.mark.parametrize("column", ["issuance_date", "due_date"])
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


def test_build_writes_artifact_files_and_one_company_series(tmp_path: Path):
    data = seed_dataset(tmp_path / "data")
    out = tmp_path / "out"
    summary = build(read(data), out, seed=42)
    assert summary["companies"] == 1
    assert summary["scorable"] == 1
    for name in ("companies.json", "alerts.json", "groups.json", "backtest.json", "meta.json"):
        assert (out / name).is_file()
    payload = json.loads((out / "scores" / "C1.json").read_text())
    assert [entry["month"] for entry in payload["series"]] == ["2026-01", "2026-02", "2026-03"]
    last = payload["series"][-1]
    assert last["flows"] == {
        "inflow": 300.0,
        "outflow": 100.0,
        "financing_in": 0.0,
        "financing_out": 0.0,
        "debt_repayment": 0.0,
    }
    assert last["level"] == 75.0
    assert last["score"] == 75.0
    assert last["momentum"] is None
    assert last["state"] == "not_evaluable"
    assert last["confidence"] == "low"
    assert last["events"] == {"E1": False, "E2": False, "E3": False, "E4": False}
    meta = json.loads((out / "meta.json").read_text())
    assert meta["latest_month"] == "2026-03"
    assert meta["state_labels"]["healthy"] == "sana"
