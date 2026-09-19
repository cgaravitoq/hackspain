from datetime import date

import polars as pl

from xray.events import cash_stress, debt_break
from xray.panel import monthly_panel
from xray.score import score_panel, states


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
