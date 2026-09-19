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


def month_index(day: date) -> int:
    return day.year * 12 + day.month - 1


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
    first = (
        invoices.filter((pl.col("pending_amount") > 0) & (pl.col("due_date") <= limit))
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


def backtest(company_rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    leads: dict[str, list[int]] = {"E1": [], "E3": []}
    events_total: dict[str, int] = {"E1": 0, "E3": 0}
    alerts_total = alerts_false = alerts_reverted = alerts_censored = 0
    for rows in company_rows.values():
        states = [row["state"] for row in rows]
        starts = alert_episodes(states)
        event_months: list[tuple[str, int]] = []
        for index, row in enumerate(rows):
            for code, flag in (("E1", row["e1"]), ("E3", row["e3"] > 0)):
                if not flag:
                    continue
                # Consecutive E1 months skip only when the previous month was recorded, so a 3-month run keeps the 1st and 3rd.
                if code == "E1" and ("E1", index - 1) in event_months:
                    continue
                event_months.append((code, index))
        first_of: dict[str, int] = {}
        for code, index in event_months:
            first_of.setdefault(code, index)
        for code, index in first_of.items():
            events_total[code] += 1
            prior = [start for start in starts if index - LEAD_WINDOW <= start < index]
            if prior:
                leads[code].append(index - prior[0])
        for start in starts:
            future_events = [i for _, i in event_months if start < i <= start + FALSE_ALARM_HORIZON]
            if len(rows) - 1 - start < FALSE_ALARM_HORIZON and not future_events:
                alerts_censored += 1
                continue
            alerts_total += 1
            if not future_events:
                alerts_false += 1
            after = states[start + 1 : start + 1 + REVERT_HORIZON]
            if after and any(state not in DOWN_STATES for state in after):
                alerts_reverted += 1
    summary = {}
    for code in ("E1", "E3"):
        found = leads[code]
        summary[code] = {
            "events": events_total[code],
            "with_prior_alert": len(found),
            "coverage": round(len(found) / events_total[code], 3) if events_total[code] else None,
            "median_lead_months": median(found) if found else None,
        }
    return {
        "events": summary,
        "alerts": {
            "evaluated": alerts_total,
            "false_alarms": alerts_false,
            "false_alarm_rate": round(alerts_false / alerts_total, 3) if alerts_total else None,
            "reverted_within_3_months": alerts_reverted,
            "revert_rate": round(alerts_reverted / alerts_total, 3) if alerts_total else None,
            "censored": alerts_censored,
        },
        "definitions": {
            "E1": "Three consecutive observed months with operating inflow below operating outflow",
            "E3": "A month without debt repayment after six or more consecutive months with one",
            "alert": "First month the state enters slipping or falling",
            "lead": "Months between the first alert in the previous twelve months and the event",
        },
    }
