import json
import random
from datetime import UTC, date, datetime
from math import sqrt
from pathlib import Path
from statistics import stdev
from typing import Any

import polars as pl

from xray import drivers as d
from xray.events import backtest, cash_stress, debt_break, overdue_invoice_months, recovery
from xray.load import CUTOFF, Dataset
from xray.names import company_names
from xray.panel import monthly_panel
from xray.score import DOWN_STATES, NOT_EVALUABLE, RULE_VERSION, confidence, policy, score_panel, states

HOLDOUT_SHARE = 0.2
STALE_BEFORE = date(CUTOFF.year - 1, 12, 1) if CUTOFF.month == 1 else date(CUTOFF.year, CUTOFF.month - 1, 1)
LINE_OF_CREDIT = "lineofcredit"
TREASURY_COLUMNS = ("starting_cash", "pending_receivables", "credit_line_limit", "credit_line_drawn")
TREND_PROJECTION_RULE_VERSION = "xray-trend-projection/0.1"
TREND_PROJECTION_MONTHS = 3
TREND_PROJECTION_MIN_MONTHS = 6
STATE_LABELS = {
    "healthy": "sana",
    "improving": "mejorando",
    "stable": "estable",
    "slipping": "torciéndose",
    "falling": "cayendo",
    NOT_EVALUABLE: "no evaluable",
}


def month_key(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


def _future_month(month: str, offset: int) -> str:
    year, number = (int(part) for part in month.split("-"))
    index = year * 12 + number - 1 + offset
    return f"{index // 12}-{index % 12 + 1:02d}"


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _trend_projection(
    series: list[dict[str, Any]],
    latest: dict[str, Any],
    observed_months: int,
    stale: bool,
) -> dict[str, Any]:
    scored = [entry for entry in series if entry["score"] is not None][-12:]
    changes = [current["score"] - previous["score"] for previous, current in zip(scored, scored[1:], strict=False)]
    volatility = stdev(changes) if len(changes) >= 3 else 0.0
    evidence = {
        "latest_score": latest["score"],
        "momentum": latest["momentum"],
        "volatility": round(volatility, 1),
        "source_months": [entry["month"] for entry in scored],
    }
    base = {
        "rule_version": TREND_PROJECTION_RULE_VERSION,
        "semantics": "scenario_range_not_confidence_interval",
        "observed_months": observed_months,
        "min_months_required": TREND_PROJECTION_MIN_MONTHS,
        "months_missing": max(0, TREND_PROJECTION_MIN_MONTHS - observed_months),
        "evidence": evidence,
    }
    if stale:
        return {**base, "status": "insufficient_data", "reason": "company_stale", "points": []}
    if latest["score"] is None:
        return {**base, "status": "insufficient_data", "reason": "latest_score_unavailable", "points": []}
    if observed_months < TREND_PROJECTION_MIN_MONTHS:
        return {**base, "status": "insufficient_data", "reason": "insufficient_history", "points": []}
    if latest["momentum"] is None:
        return {**base, "status": "insufficient_data", "reason": "momentum_unavailable", "points": []}
    points = []
    for horizon in range(1, TREND_PROJECTION_MONTHS + 1):
        scenario = _clamp_score(latest["score"] + latest["momentum"] * horizon / TREND_PROJECTION_MONTHS)
        spread = volatility * sqrt(horizon)
        points.append(
            {
                "month": _future_month(latest["month"], horizon),
                "base": round(scenario, 1),
                "favorable": round(_clamp_score(scenario + spread), 1),
                "adverse": round(_clamp_score(scenario - spread), 1),
            }
        )
    return {**base, "status": "available", "reason": None, "points": points}


def alert_kind(before: str, now: str) -> str | None:
    if now == before:
        return None
    if now in DOWN_STATES and before not in DOWN_STATES:
        return "down"
    if now == "falling":
        return "down"
    if now == "improving":
        return "up"
    if before in DOWN_STATES and now in ("healthy", "stable", "improving"):
        return "recovered"
    return None


def alert_stage(kind: str, state: str) -> str | None:
    if kind != "down":
        return None
    return "confirmed" if state == "falling" else "candidate"


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _rows_by_company(
    dataset: Dataset, overdue_months: dict[str, date]
) -> dict[str, list[dict[str, Any]]]:
    scored = score_panel(monthly_panel(dataset.transactions))
    company_rows: dict[str, list[dict[str, Any]]] = {}
    for (company_id,), frame in scored.group_by("company_id", maintain_order=True):
        rows = frame.to_dicts()
        state_list = states(
            [r["momentum"] for r in rows],
            [r["level"] for r in rows],
            [r["threshold"] for r in rows],
        )
        e1 = cash_stress([r["observed"] for r in rows], [r["inflow"] for r in rows], [r["outflow"] for r in rows])
        e4 = recovery([r["observed"] for r in rows], [r["inflow"] for r in rows], [r["outflow"] for r in rows], e1)
        e3 = debt_break([r["debt_repayment"] for r in rows])
        overdue_month = overdue_months.get(company_id)
        for row, state, s1, s3, s4 in zip(rows, state_list, e1, e3, e4, strict=True):
            row.update(
                state=state,
                e1=s1,
                e2=overdue_month is not None and month_key(overdue_month) == month_key(row["month"]),
                e3=s3,
                e4=s4,
            )
        company_rows[company_id] = rows
    return company_rows


def _month_entry(
    row: dict[str, Any],
    previous: dict[str, Any] | None,
    sources: dict[str, bool],
) -> dict[str, Any]:
    return {
        "month": month_key(row["month"]),
        "observed": row["observed"],
        "level": round(row["level"], 1) if row["level"] is not None else None,
        "momentum": round(row["momentum"], 1) if row["momentum"] is not None else None,
        "adjustment": round(row["adjustment"], 1) if row["level"] is not None else None,
        "score": round(row["score"], 1) if row["score"] is not None else None,
        "state": row["state"],
        "confidence": confidence(row["months_observed"], row["share_uncategorised"] or 0.0) if row["score"] is not None else "none",
        "components": d.components(row),
        "drivers": d.drivers(row, {"debt_break": row["e3"]}),
        "changed": d.changed(row, previous),
        "evidence": d.evidence(row, sources),
        "flows": {
            "inflow": round(row["inflow"], 2),
            "outflow": round(row["outflow"], 2),
            "financing_in": round(row["financing_in"], 2),
            "financing_out": round(row["financing_out"], 2),
            "debt_repayment": round(row["debt_repayment"], 2),
        },
        "events": {"E1": row["e1"], "E2": row["e2"], "E3": row["e3"] > 0, "E4": row["e4"]},
    }


def _treasury(dataset: Dataset) -> dict[str, dict[str, float]]:
    lines = dataset.debt.filter(pl.col("type") == LINE_OF_CREDIT)
    sources = {
        "starting_cash": dataset.balances.group_by("company_id").agg(pl.col("balance").sum()),
        "pending_receivables": dataset.invoices.filter(pl.col("pending_amount") > 0)
        .group_by("company_id")
        .agg(pl.col("pending_amount").sum()),
        "credit_line_limit": lines.group_by("company_id").agg(pl.col("granted").sum()),
        "credit_line_drawn": lines.group_by("company_id").agg(pl.col("outstanding").sum()),
    }
    treasury: dict[str, dict[str, float]] = {}
    for column, frame in sources.items():
        for company_id, total in frame.iter_rows():
            treasury.setdefault(company_id, {})[column] = round(total, 2)
    return treasury


def _treasury_of(treasury: dict[str, dict[str, float]], company_id: str) -> dict[str, float]:
    values = treasury.get(company_id, {})
    return {column: values.get(column, 0.0) for column in TREASURY_COLUMNS}


def _company_record(
    company_id: str,
    name: str,
    rows: list[dict[str, Any]],
    series: list[dict[str, Any]],
    latest: dict[str, Any],
    company_group: dict[str, str],
    company_currency: dict[str, str],
    holdout_groups: set[str],
    debt_by_company: dict[str, float],
    invoice_facts: dict[str, dict[str, Any]],
    treasury: dict[str, float],
) -> dict[str, Any]:
    group_id = company_group.get(company_id)
    last_observed = max(row["month"] for row in rows if row["observed"])
    stale = last_observed < STALE_BEFORE
    observed_months = rows[-1]["months_observed"]
    return {
        "rule_version": RULE_VERSION,
        "company_id": company_id,
        "name": name,
        "group_id": group_id,
        "currency": company_currency.get(company_id),
        "scorable": latest["level"] is not None,
        "holdout": group_id in holdout_groups,
        "months_observed": observed_months,
        "last_observed_month": month_key(last_observed),
        "stale": stale,
        "debt_outstanding": round(debt_by_company.get(company_id, 0.0), 2),
        "invoice_facts": invoice_facts.get(company_id, {}),
        "treasury": treasury,
        "latest": {key: latest[key] for key in ("month", "score", "delta_3", "delta_6", "level", "momentum", "state", "confidence")},
        "trend_projection": _trend_projection(series, latest, observed_months, stale),
    }


def _alert(
    company_id: str,
    latest: dict[str, Any],
    before: dict[str, Any] | None,
    company_group: dict[str, str],
) -> dict[str, Any] | None:
    if not before or latest["score"] is None or before["score"] is None:
        return None
    kind = alert_kind(before["state"], latest["state"])
    if not kind:
        return None
    return {
        "rule_version": RULE_VERSION,
        "company_id": company_id,
        "group_id": company_group.get(company_id),
        "month": latest["month"],
        "kind": kind,
        "stage": alert_stage(kind, latest["state"]),
        "state": latest["state"],
        "previous_state": before["state"],
        "score": latest["score"],
        "delta": round(latest["score"] - before["score"], 1),
        "driver": latest["drivers"][0]["text"] if latest["drivers"] else None,
    }


def _unscorable(
    names: dict[str, str],
    company_group: dict[str, str],
    company_rows: dict[str, list[dict[str, Any]]],
    company_currency: dict[str, str],
    holdout_groups: set[str],
    debt_by_company: dict[str, float],
    invoice_facts: dict[str, dict[str, Any]],
    treasury: dict[str, dict[str, float]],
) -> list[dict[str, Any]]:
    return [
        {
            "rule_version": RULE_VERSION,
            "company_id": company_id,
            "name": names[company_id],
            "group_id": group_id,
            "currency": company_currency.get(company_id),
            "scorable": False,
            "holdout": group_id in holdout_groups,
            "months_observed": 0,
            "last_observed_month": None,
            "stale": False,
            "debt_outstanding": round(debt_by_company.get(company_id, 0.0), 2),
            "invoice_facts": invoice_facts.get(company_id, {}),
            "treasury": _treasury_of(treasury, company_id),
            "latest": {
                "month": None,
                "score": None,
                "delta_3": None,
                "delta_6": None,
                "level": None,
                "momentum": None,
                "state": NOT_EVALUABLE,
                "confidence": "none",
            },
            "trend_projection": _trend_projection(
                [],
                {"month": None, "score": None, "momentum": None},
                0,
                False,
            ),
        }
        for company_id, group_id in company_group.items()
        if company_id not in company_rows
    ]


def _groups(
    group_ids: list[str],
    companies_out: list[dict[str, Any]],
    holdout_groups: set[str],
) -> list[dict[str, Any]]:
    groups_out = []
    for group_id in group_ids:
        members = [c for c in companies_out if c["group_id"] == group_id]
        total_debt = sum(m["debt_outstanding"] for m in members)
        falling = [m for m in members if m["latest"]["state"] in DOWN_STATES]
        biggest_debtor = max(members, key=lambda m: m["debt_outstanding"], default=None)
        concentrated = bool(biggest_debtor and total_debt > 0 and biggest_debtor["debt_outstanding"] / total_debt >= 0.8)
        tension = (len(members) >= 2 and len(falling) / len(members) >= 0.5) or (
            concentrated and biggest_debtor is not None and biggest_debtor["latest"]["state"] in DOWN_STATES
        )
        groups_out.append(
            {
                "group_id": group_id,
                "holdout": group_id in holdout_groups,
                "n_companies": len(members),
                "n_falling": len(falling),
                "debt_outstanding": round(total_debt, 2),
                "debt_share_top": round(biggest_debtor["debt_outstanding"] / total_debt, 3)
                if biggest_debtor and total_debt
                else None,
                "tension": tension,
                "members": [
                    {
                        "company_id": m["company_id"],
                        "name": m["name"],
                        "debt_outstanding": m["debt_outstanding"],
                        "debt_share": round(m["debt_outstanding"] / total_debt, 3) if total_debt else None,
                        **m["latest"],
                    }
                    for m in sorted(members, key=lambda m: (m["latest"]["score"] is None, m["latest"]["score"] or 0))
                ],
            }
        )
    return groups_out


def _invoice_facts(invoices: pl.DataFrame) -> dict[str, dict[str, Any]]:
    pending = invoices.filter(pl.col("pending_amount") > 0)
    overdue = pending.filter(pl.col("due_date") < CUTOFF)
    by_company = overdue.group_by("company_id").agg(
        overdue_count=pl.len(),
        overdue_amount=pl.col("pending_amount").sum(),
        oldest_due=pl.col("due_date").min(),
    )
    concentration = (
        pending.group_by("company_id", "counterparty_id")
        .agg(pl.col("pending_amount").sum())
        .sort("pending_amount", descending=True)
        .group_by("company_id", maintain_order=True)
        .agg(top3=pl.col("pending_amount").head(3).sum(), total=pl.col("pending_amount").sum())
        .with_columns(top3_share=pl.col("top3") / pl.col("total"))
    )
    facts: dict[str, dict[str, Any]] = {}
    for row in by_company.iter_rows(named=True):
        facts[row["company_id"]] = {
            "overdue_count": row["overdue_count"],
            "overdue_amount": round(row["overdue_amount"], 2),
            "oldest_overdue_days": (CUTOFF - row["oldest_due"]).days,
        }
    for row in concentration.iter_rows(named=True):
        facts.setdefault(row["company_id"], {})["top3_share_of_pending"] = round(row["top3_share"], 3)
    return facts


def build(dataset: Dataset, out_dir: Path, seed: int) -> dict[str, Any]:
    overdue_months = overdue_invoice_months(dataset.invoices)
    company_rows = _rows_by_company(dataset, overdue_months)
    invoice_companies = set(dataset.invoices["company_id"].unique().to_list())
    debt_by_company = dict(dataset.debt.group_by("company_id").agg(pl.col("outstanding").sum()).iter_rows())
    invoice_facts = _invoice_facts(dataset.invoices)
    treasury = _treasury(dataset)
    group_ids = sorted(dataset.groups["group_id"].to_list())
    holdout_groups = set(random.Random(seed).sample(group_ids, int(len(group_ids) * HOLDOUT_SHARE)))
    company_group = dict(
        zip(dataset.companies["company_id"].to_list(), dataset.companies["group_id"].to_list(), strict=True)
    )
    company_currency = dict(
        zip(dataset.companies["company_id"].to_list(), dataset.companies["currency"].to_list(), strict=True)
    )
    names = company_names(dataset.companies["company_id"].to_list())

    companies_out: list[dict[str, Any]] = []
    alerts: list[dict[str, Any]] = []
    for company_id, rows in company_rows.items():
        sources = {"invoices": company_id in invoice_companies, "debt": company_id in debt_by_company}
        series: list[dict[str, Any]] = []
        previous = None
        for row in rows:
            entry = _month_entry(row, previous, sources)
            for horizon in (3, 6):
                earlier_score = series[-horizon]["score"] if len(series) >= horizon else None
                entry[f"delta_{horizon}"] = (
                    round(entry["score"] - earlier_score, 1)
                    if entry["score"] is not None and earlier_score is not None
                    else None
                )
            series.append(entry)
            previous = row
        latest = series[-1]
        if max(row["month"] for row in rows if row["observed"]) < STALE_BEFORE:
            latest = {**latest, "state": NOT_EVALUABLE, "confidence": "none"}
        before = series[-2] if len(series) > 1 else None
        record = _company_record(
            company_id,
            names[company_id],
            rows,
            series,
            latest,
            company_group,
            company_currency,
            holdout_groups,
            debt_by_company,
            invoice_facts,
            _treasury_of(treasury, company_id),
        )
        record["treasury_snapshot"] = dataset.treasury_snapshots.get(company_id)
        companies_out.append(record)
        _write(out_dir / "scores" / f"{company_id}.json", {**record, "series": series})
        alert = _alert(company_id, latest, before, company_group)
        if alert:
            alerts.append(alert)

    companies_out.extend(
        _unscorable(
            names,
            company_group,
            company_rows,
            company_currency,
            holdout_groups,
            debt_by_company,
            invoice_facts,
            treasury,
        )
    )
    for record in companies_out:
        record["treasury_snapshot"] = dataset.treasury_snapshots.get(record["company_id"])
    companies_out.sort(key=lambda item: item["company_id"])
    groups_out = _groups(group_ids, companies_out, holdout_groups)
    order = {"down": 0, "recovered": 1, "up": 2}
    alerts.sort(key=lambda a: (order[a["kind"]], a["state"] != "falling", a["delta"]))
    summary = {**backtest(company_rows), "rule_version": RULE_VERSION}
    _write(out_dir / "companies.json", companies_out)
    _write(out_dir / "alerts.json", alerts)
    _write(out_dir / "groups.json", groups_out)
    _write(out_dir / "backtest.json", summary)
    policy_document = policy()
    _write(
        out_dir / "meta.json",
        {
            "rule_version": policy_document["rule_version"],
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "policy": policy_document["parameters"],
            "state_labels": STATE_LABELS,
            "latest_month": max(c["latest"]["month"] or "" for c in companies_out),
            "holdout_groups": sorted(holdout_groups),
            "gaps": {
                "companies_with_gaps": sum(
                    1 for rows in company_rows.values() if any(not row["observed"] for row in rows)
                ),
                "unobserved_months": sum(
                    1 for rows in company_rows.values() for row in rows if not row["observed"]
                ),
                "stale_companies": sum(1 for company in companies_out if company["stale"]),
            },
        },
    )
    return {
        "companies": len(companies_out),
        "scorable": sum(1 for c in companies_out if c["scorable"]),
        "stale": sum(1 for c in companies_out if c["stale"]),
        "alerts": len(alerts),
        "groups": len(groups_out),
        "backtest": summary,
    }
