from typing import Any

from xray.score import RULE_VERSION

NEUTRAL = 50.0

Row = dict[str, Any]


def _euro(value: float) -> str:
    return f"{value:,.0f} €".replace(",", ".")


def _window(row: Row) -> str:
    end = row["month"]
    start_month = end.month - 2 if end.month > 2 else end.month + 10
    start_year = end.year if end.month > 2 else end.year - 1
    return f"{start_year}-{start_month:02d} a {end.year}-{end.month:02d}"


def components(row: Row) -> dict[str, float]:
    if row["level"] is None:
        return {}
    return {
        "balance": round(row["balance"] - NEUTRAL, 2),
        "fees": round(row["fee_penalty"], 2),
        "refunds": round(row["refund_penalty"], 2),
        "momentum": round(row["adjustment"], 2),
    }


def drivers(row: Row, facts: dict[str, Any]) -> list[dict[str, Any]]:
    if row["level"] is None:
        return []
    window = _window(row)
    coverage = row["inflow_3"] / row["outflow_3"] if row["outflow_3"] else None
    items: list[dict[str, Any]] = [
        {
            "code": "balance",
            "contribution": round(row["balance"] - NEUTRAL, 2),
            "value": round(coverage, 2) if coverage is not None else None,
            "unit": "ratio",
            "period": window,
            "text": (
                f"Cobros {_euro(row['inflow_3'])} frente a pagos {_euro(row['outflow_3'])} en {window}"
                + (f": cobertura {coverage:.2f}" if coverage is not None else "")
            ),
        },
        {
            "code": "fees",
            "contribution": round(row["fee_penalty"], 2),
            "value": round(100 * row["fees_3"] / row["outflow_3"], 1) if row["outflow_3"] else 0.0,
            "unit": "percent_of_outflow",
            "period": window,
            "text": (
                f"Comisiones e intereses {_euro(row['fees_3'])}, el "
                f"{100 * row['fees_3'] / row['outflow_3'] if row['outflow_3'] else 0:.1f} % de las salidas en {window}"
            ),
        },
        {
            "code": "refunds",
            "contribution": round(row["refund_penalty"], 2),
            "value": round(100 * row["refunds_3"] / row["inflow_3"], 1) if row["inflow_3"] else 0.0,
            "unit": "percent_of_inflow",
            "period": window,
            "text": (
                f"Devoluciones de cobros {_euro(row['refunds_3'])}, el "
                f"{100 * row['refunds_3'] / row['inflow_3'] if row['inflow_3'] else 0:.1f} % de los cobros en {window}"
            ),
        },
    ]
    if row["momentum"] is not None:
        items.append(
            {
                "code": "momentum",
                "contribution": round(row["adjustment"], 2),
                "value": round(row["momentum"], 1),
                "unit": "points",
                "period": window,
                "text": f"Nivel {row['momentum']:+.0f} puntos frente a los tres meses anteriores",
            }
        )
    context: list[dict[str, Any]] = []
    if row["inflow_avg_prev6"]:
        change = 100 * (row["inflow"] / row["inflow_avg_prev6"] - 1)
        context.append(
            {
                "code": "inflow_vs_prev6",
                "contribution": 0.0,
                "value": round(change, 1),
                "unit": "percent",
                "period": f"{row['month'].year}-{row['month'].month:02d}",
                "text": f"Cobros del mes un {change:+.0f} % frente a la media de los seis meses anteriores",
            }
        )
    if facts.get("debt_break"):
        context.append(
            {
                "code": "debt_repayment_break",
                "contribution": 0.0,
                "value": facts["debt_break"],
                "unit": "months",
                "period": f"{row['month'].year}-{row['month'].month:02d}",
                "text": f"Pagaba cuota de deuda cada mes desde hace {facts['debt_break']} meses y este mes no hay ninguna",
            }
        )
    if row["outflow_3"] and row["withdrawals_3"] / row["outflow_3"] > 0.05:
        share = 100 * row["withdrawals_3"] / row["outflow_3"]
        context.append(
            {
                "code": "withdrawals",
                "contribution": 0.0,
                "value": round(share, 1),
                "unit": "percent_of_outflow",
                "period": window,
                "text": f"Retiradas de efectivo {_euro(row['withdrawals_3'])}, el {share:.1f} % de las salidas en {window}",
            }
        )
    items.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    return items[:4] + context


def changed(row: Row, previous: Row | None) -> list[dict[str, Any]]:
    if previous is None or row["level"] is None or previous["level"] is None:
        return []
    now, before = components(row), components(previous)
    deltas = [
        {"code": code, "delta": round(now[code] - before.get(code, 0.0), 2)}
        for code in now
        if abs(now[code] - before.get(code, 0.0)) >= 0.05
    ]
    explained = sum(item["delta"] for item in deltas)
    residual = round(row["score"] - previous["score"] - explained, 2)
    if abs(residual) >= 0.05:
        deltas.append({"code": "cap", "delta": residual})
    deltas.sort(key=lambda item: abs(item["delta"]), reverse=True)
    return deltas


def evidence(row: Row, sources: dict[str, bool]) -> dict[str, Any]:
    end = row["month"]
    return {
        "months_observed": row["months_observed"],
        "transactions_in_window": int(row["n_tx_3"] or 0),
        "share_uncategorised": round(row["share_uncategorised"] or 0.0, 3),
        "window": _window(row) if row["level"] is not None else None,
        "cutoff": f"{end.year}-{end.month:02d}",
        "currency": "EUR",
        "sources": {"transactions": True, **sources},
        "rule_version": RULE_VERSION,
    }
