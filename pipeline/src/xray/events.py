from datetime import date, timedelta
from statistics import median
from typing import Any

import polars as pl

from xray.load import CUTOFF
from xray.score import DOWN_STATES

RUN_MONTHS = 3
DEBT_RUN_MONTHS = 6
OVERDUE_DAYS = 90
FALSE_ALARM_HORIZON = 6
REVERT_HORIZON = 3
LEAD_WINDOW = 12
EVENT_CODES = ("E1", "E2", "E3")
ALERT_STAGES = ("candidate", "confirmed")


def cash_stress(observed: list[bool], inflow: list[float], outflow: list[float]) -> list[bool]:
    run = 0
    flags = []
    for seen, cash_in, cash_out in zip(observed, inflow, outflow, strict=True):
        stressed = seen and cash_out > 0 and cash_in < cash_out
        run = run + 1 if stressed else 0
        flags.append(run >= RUN_MONTHS)
    return flags


def recovery(observed: list[bool], inflow: list[float], outflow: list[float], stress: list[bool]) -> list[bool]:
    run = 0
    had_stress = False
    flags = []
    for seen, cash_in, cash_out, stressed in zip(observed, inflow, outflow, stress, strict=True):
        had_stress = had_stress or stressed
        covered = seen and cash_in > cash_out > 0
        run = run + 1 if covered else 0
        flags.append(had_stress and not stressed and run >= RUN_MONTHS)
    return flags


def debt_break(debt_repayment: list[float]) -> list[int]:
    run = 0
    result = []
    for paid in debt_repayment:
        if paid > 0:
            run += 1
            result.append(0)
        else:
            result.append(run if run >= DEBT_RUN_MONTHS else 0)
            run = 0
    return result


def overdue_invoice_months(invoices: pl.DataFrame) -> dict[str, date]:
    limit = CUTOFF - timedelta(days=OVERDUE_DAYS)
    paid_late = (
        (pl.col("status") == "paid")
        & (pl.col("pending_amount") == 0)
        & (pl.col("payment_date") < CUTOFF)
        & ((pl.col("payment_date") - pl.col("due_date")) >= pl.duration(days=OVERDUE_DAYS))
    )
    still_unpaid = (
        pl.col("status").is_in(("open", "pending", "overdue", "paymentOrder", "payment_in_progress"))
        & (pl.col("pending_amount") > 0)
    )
    first = (
        invoices.filter(
            pl.col("amount").is_finite()
            & (pl.col("amount") > 0)
            & pl.col("pending_amount").is_finite()
            & pl.col("pending_amount").is_between(0, pl.col("amount"))
            & (pl.col("due_date") >= pl.col("issuance_date"))
            & (pl.col("due_date") < limit)
            & (pl.col("payment_date").is_null() | (pl.col("payment_date") >= pl.col("issuance_date")))
        )
        .filter(paid_late | still_unpaid)
        .with_columns(event=(pl.col("due_date") + pl.duration(days=OVERDUE_DAYS)).dt.truncate("1mo"))
        .group_by("company_id")
        .agg(pl.col("event").min())
    )
    return dict(zip(first["company_id"].to_list(), first["event"].to_list(), strict=True))


def alert_episodes(states: list[str]) -> list[int]:
    starts = []
    for index, state in enumerate(states):
        previous = states[index - 1] if index else None
        if state in DOWN_STATES and previous not in DOWN_STATES:
            starts.append(index)
    return starts


def alert_stages(states: list[str]) -> dict[str, list[int]]:
    anchors: dict[str, list[int]] = {stage: [] for stage in ALERT_STAGES}
    for start in alert_episodes(states):
        end = start
        while end < len(states) and states[end] in DOWN_STATES:
            end += 1
        confirmed = next((index for index in range(start, end) if states[index] == "falling"), None)
        anchors["confirmed" if confirmed is not None else "candidate"].append(
            confirmed if confirmed is not None else start
        )
    return anchors


def _alert_stats(states: list[str], starts: list[int], event_months: list[tuple[str, int]]) -> dict[str, int]:
    evaluated = false_alarms = reverted = censored = 0
    for start in starts:
        future_events = [index for _, index in event_months if start < index <= start + FALSE_ALARM_HORIZON]
        if len(states) - 1 - start < FALSE_ALARM_HORIZON and not future_events:
            censored += 1
            continue
        evaluated += 1
        if not future_events:
            false_alarms += 1
        after = states[start + 1 : start + 1 + REVERT_HORIZON]
        if after and any(state not in DOWN_STATES for state in after):
            reverted += 1
    return {
        "evaluated": evaluated,
        "false_alarms": false_alarms,
        "reverted_within_3_months": reverted,
        "censored": censored,
    }


def _rates(stats: dict[str, int]) -> dict[str, Any]:
    evaluated = stats["evaluated"]
    return {
        "evaluated": evaluated,
        "false_alarms": stats["false_alarms"],
        "false_alarm_rate": round(stats["false_alarms"] / evaluated, 3) if evaluated else None,
        "reverted_within_3_months": stats["reverted_within_3_months"],
        "revert_rate": round(stats["reverted_within_3_months"] / evaluated, 3) if evaluated else None,
        "censored": stats["censored"],
    }


def backtest(company_rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    leads: dict[str, list[int]] = {code: [] for code in EVENT_CODES}
    events_total: dict[str, int] = {code: 0 for code in EVENT_CODES}
    totals: dict[str, dict[str, int]] = {
        name: {"evaluated": 0, "false_alarms": 0, "reverted_within_3_months": 0, "censored": 0}
        for name in ("alerts", *ALERT_STAGES)
    }
    for rows in company_rows.values():
        states = [row["state"] for row in rows]
        starts = alert_episodes(states)
        stages = alert_stages(states)
        event_months: list[tuple[str, int]] = []
        for index, row in enumerate(rows):
            for code, flag in (("E1", row["e1"]), ("E3", row["e3"] > 0)):
                if not flag:
                    continue
                # Consecutive E1 months skip only when the previous month was recorded, so a 3-month run keeps the 1st and 3rd.
                if code == "E1" and ("E1", index - 1) in event_months:
                    continue
                event_months.append((code, index))
        labeled_months = event_months + [("E2", index) for index, row in enumerate(rows) if row["e2"]]
        first_of: dict[str, int] = {}
        for code, index in labeled_months:
            first_of.setdefault(code, index)
        for code, index in first_of.items():
            events_total[code] += 1
            prior = [start for start in starts if index - LEAD_WINDOW <= start < index]
            if prior:
                leads[code].append(index - prior[0])
        for name, anchors in (("alerts", starts), *stages.items()):
            for key, value in _alert_stats(states, anchors, event_months).items():
                totals[name][key] += value
    summary = {}
    for code in EVENT_CODES:
        found = leads[code]
        summary[code] = {
            "events": events_total[code],
            "with_prior_alert": len(found),
            "coverage": round(len(found) / events_total[code], 3) if events_total[code] else None,
            "median_lead_months": median(found) if found else None,
        }
    return {
        "events": summary,
        "alerts": _rates(totals["alerts"]),
        "alerts_by_stage": {stage: _rates(totals[stage]) for stage in ALERT_STAGES},
        "definitions": {
            "E1": "Three consecutive observed months with operating inflow below operating outflow",
            "E2": "The month ninety days past the due date of an invoice paid ninety days late or more, or still unpaid at extraction",
            "E3": "A month without debt repayment after six or more consecutive months with one",
            "alert": "First month the state enters slipping or falling",
            "candidate": "Episode that never reaches falling, anchored on the month it entered slipping",
            "confirmed": "Episode that reaches falling, anchored on the month it entered falling",
            "lead": "Months between the first alert in the previous twelve months and the event",
        },
    }
