"""Render one scored company's traceability JSON as a plain-language report.

Every number and sentence below comes from the company's report JSON, written
by `run_scoring.py` under `results/companies/<company_id>.json`. This module
never recomputes a score, never infers a value that is not already in the
report, and never smooths over a null field: an unscored company gets a
report that says so.
"""

from __future__ import annotations

import calendar
import json
from pathlib import Path
from typing import Any

COMPONENT_LABELS = {
    "inflow_outflow_ratio": "Inflow / outflow ratio",
    "chargeback_score": "Chargeback score",
    "fee_score": "Fee score",
    "debt_score": "Debt service score",
}

TRAJECTORY_LABELS = {
    "improving": "Improving",
    "deteriorating": "Deteriorating",
    "stable": "Stable",
    "insufficient_data": "Not enough history to call a trend",
}


class CompanyReportNotFoundError(FileNotFoundError):
    """Raised when a company has no report JSON under the results directory."""


def company_report_path(results_dir: str | Path, company_id: str) -> Path:
    return Path(results_dir) / "companies" / f"{company_id}.json"


def load_company_report(results_dir: str | Path, company_id: str) -> dict[str, Any]:
    path = company_report_path(results_dir, company_id)
    if not path.exists():
        raise CompanyReportNotFoundError(
            f"no report for '{company_id}' at {path}; check --company-id and --results-dir"
        )
    return json.loads(path.read_text(encoding="utf-8"))


def _month_range(period: str) -> str:
    """'2026-06' -> '01 Jun 2026 to 30 Jun 2026'."""
    year, month = (int(part) for part in period.split("-"))
    _, last_day = calendar.monthrange(year, month)
    month_name = calendar.month_abbr[month]
    return f"01 {month_name} {year} to {last_day:02d} {month_name} {year}"


def _period_list_label(periods: list[str]) -> str:
    if not periods:
        return "none available"
    return ", ".join(_month_range(period) for period in periods)


def _score_line(report: dict[str, Any]) -> list[str]:
    base = report["base_score"]
    final = report["final_score"]
    adjustment = report["trajectory_adjustment"]
    lines = ["FINAL SCORE", "-----------"]
    if final is None:
        lines.append("Not scored: no eligible EUR operational month was observed before the")
        lines.append("scoring cutoff. There is no base score, trend or trajectory adjustment.")
        return lines
    lines.append(f"{final:.1f} / 100")
    lines.append("")
    lines.append(f"  Base score (average of the last 3 observed months):  {base:.1f}")
    sign = "+" if adjustment >= 0 else ""
    lines.append(f"  Trajectory adjustment applied on top:                {sign}{adjustment:.1f}")
    lines.append(f"  = Final score:                                       {final:.1f}")
    return lines


def _trend_lines(report: dict[str, Any]) -> list[str]:
    trajectory = report["trajectory"]
    persistence = report["persistence"]
    label = TRAJECTORY_LABELS.get(trajectory, trajectory)
    lines = ["", "TREND", "-----", label]
    if trajectory == "insufficient_data":
        return lines
    if persistence == "confirmed":
        lines.append(
            "This direction is CONFIRMED: the same trend also showed up when the same "
            "comparison was repeated one quarter earlier, so it is not a one-off swing. "
            "It is the reason the trajectory adjustment above is non-zero."
        )
    else:
        lines.append(
            "This direction is NOT confirmed: it did not repeat when the same comparison "
            "was made one quarter earlier, so no trajectory adjustment was applied to the "
            "score even though a change was observed."
        )
    return lines


def _signal_lines(report: dict[str, Any]) -> list[str]:
    signals = report["signals"]
    if not signals:
        return []
    persistence_confirmed = report["persistence"] == "confirmed"
    lines = ["", "WHAT MOVED", "----------"]
    ranked = sorted(signals, key=lambda signal: abs(signal["change"]), reverse=True)
    for signal in ranked:
        label = COMPONENT_LABELS.get(signal["component"], signal["component"])
        change = signal["change"]
        direction = "up" if change > 0 else "down" if change < 0 else "unchanged"
        contribution = signal["contribution"]
        line = f"  {label}: {direction} {abs(change):.1f} points"
        if contribution:
            csign = "+" if contribution >= 0 else ""
            line += f" (contributed {csign}{contribution:.1f} points to the score adjustment)"
        elif not persistence_confirmed:
            line += " (no effect on the score: trend not confirmed)"
        else:
            line += " (no measurable contribution to the score adjustment)"
        lines.append(line)
    return lines


def _periods_lines(report: dict[str, Any]) -> list[str]:
    periods = report["periods_compared"]
    recent, baseline = periods["recent"], periods["baseline"]
    if not recent:
        return []
    lines = ["", "PERIODS COMPARED", "----------------"]
    lines.append(f"  Recent window:   {_period_list_label(recent)}")
    lines.append(f"  Baseline window: {_period_list_label(baseline)}")
    return lines


def _confidence_lines(report: dict[str, Any]) -> list[str]:
    confidence = report["confidence"]
    lines = ["", "CONFIDENCE", "----------"]
    lines.append(f"  Months of history available: {confidence['months_available']}")
    lines.append(f"  Months considered complete:  {confidence['months_complete']}")
    coverage = confidence["coverage_pct"]
    if coverage is not None:
        lines.append(f"  Share of complete months:    {coverage * 100:.0f}%")
    lines.append(f"  Currency scope:              {confidence['currency_scope']}")
    return lines


def _evidence_lines(report: dict[str, Any]) -> list[str]:
    evidence = report["evidence_records"]
    lines = ["", "EVIDENCE USED FOR THIS SCORE", "----------------------------"]
    lines.append(f"  Transactions used:  {evidence['count']}")
    lines.append(f"  Date range covered: {evidence['date_range'] or 'none'}")
    excluded_bits = []
    if evidence.get("excluded_unknown_product"):
        excluded_bits.append(f"{evidence['excluded_unknown_product']} unknown product")
    if evidence.get("excluded_non_eur"):
        excluded_bits.append(f"{evidence['excluded_non_eur']} non-EUR")
    if evidence.get("excluded_no_category"):
        excluded_bits.append(f"{evidence['excluded_no_category']} uncategorized")
    if excluded_bits:
        lines.append(f"  Excluded from this company's data: {', '.join(excluded_bits)}")
    return lines


def _limitations_lines(report: dict[str, Any]) -> list[str]:
    limitations = report["limitations"]
    if not limitations:
        return []
    lines = ["", "LIMITATIONS THAT APPLY TO THIS COMPANY", "--------------------------------------"]
    lines.extend(f"  - {limitation}" for limitation in limitations)
    return lines


def build_report(report: dict[str, Any]) -> str:
    """Assemble the full plain-text report for one company's JSON."""
    header = [
        f"CREDIT SCORE EXPLANATION - {report['company_id']}",
        f"Scoring date: {report['scoring_date']}  |  Rule version: {report['rule_version']}",
        "=" * 60,
    ]
    sections = [
        header,
        _score_line(report),
        _trend_lines(report),
        _signal_lines(report),
        _periods_lines(report),
        _confidence_lines(report),
        _evidence_lines(report),
        _limitations_lines(report),
    ]
    lines = [line for section in sections for line in section]
    return "\n".join(lines) + "\n"


def explain_company(results_dir: str | Path, company_id: str) -> str:
    report = load_company_report(results_dir, company_id)
    return build_report(report)


def load_all_reports(results_dir: str | Path) -> list[dict[str, Any]]:
    companies_dir = Path(results_dir) / "companies"
    paths = sorted(companies_dir.glob("*.json"))
    return [json.loads(path.read_text(encoding="utf-8")) for path in paths]


def _score_deciles(scores: list[float]) -> list[tuple[str, int]]:
    buckets = [f"{low}-{low + 10}" for low in range(0, 100, 10)]
    counts = [0] * len(buckets)
    for score in scores:
        index = min(int(score // 10), len(buckets) - 1)
        counts[index] += 1
    return list(zip(buckets, counts, strict=True))


def _obsolete_companies(reports: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Companies whose most recent scored evidence is from 2025, not 2026."""
    stale = []
    for report in reports:
        recent = report["periods_compared"]["recent"]
        last_period = recent[-1] if recent else None
        if last_period is None:
            date_range = report["evidence_records"]["date_range"]
            last_period = date_range.split(" to ")[-1] if date_range else None
        if last_period and last_period.startswith("2025"):
            stale.append((report["company_id"], last_period))
    return sorted(stale)


def build_summary_report(reports: list[dict[str, Any]], generated_on: str) -> str:
    """Assemble the executive summary text over every company's report."""
    scored = [r for r in reports if r["final_score"] is not None]
    scores = sorted((r["final_score"] for r in scored), reverse=True)

    trajectory_counts: dict[str, int] = {}
    for report in reports:
        trajectory_counts[report["trajectory"]] = trajectory_counts.get(report["trajectory"], 0) + 1
    confirmed = sum(1 for r in reports if r["persistence"] == "confirmed")

    ranked = sorted(scored, key=lambda r: r["final_score"], reverse=True)
    top10 = ranked[:10]
    bottom10 = ranked[-10:][::-1]

    obsolete = _obsolete_companies(reports)

    lines = [
        "CREDIT SCORING PORTFOLIO SUMMARY",
        f"Generated on: {generated_on}",
        f"Companies in this batch: {len(reports)} ({len(scored)} scored, "
        f"{len(reports) - len(scored)} not scored: no eligible EUR month observed)",
        "=" * 60,
        "",
        "SCORE DISTRIBUTION (deciles, scored companies only)",
        "----------------------------------------------------",
    ]
    for bucket, count in _score_deciles(scores):
        lines.append(f"  {bucket:>7}: {count}")

    lines += [
        "",
        "TRAJECTORY",
        "----------",
    ]
    for trajectory in ("improving", "deteriorating", "stable", "insufficient_data"):
        lines.append(f"  {trajectory}: {trajectory_counts.get(trajectory, 0)}")

    lines += [
        "",
        "PERSISTENCE",
        "-----------",
        f"  Confirmed trends (drove a score adjustment): {confirmed}",
        f"  Unconfirmed / not applicable:                {len(reports) - confirmed}",
        "",
        "TOP 10 SCORES",
        "-------------",
    ]
    for report in top10:
        lines.append(f"  {report['company_id']}: {report['final_score']:.1f}")

    lines += ["", "BOTTOM 10 SCORES", "----------------"]
    for report in bottom10:
        lines.append(f"  {report['company_id']}: {report['final_score']:.1f}")

    lines += [
        "",
        "OBSOLESCENCE: LATEST DATA IS FROM 2025",
        "---------------------------------------",
        f"  {len(obsolete)} companies have no 2026 evidence in the window used to score them.",
    ]
    for company_id, last_period in obsolete:
        lines.append(f"  {company_id}: latest observed month {last_period}")

    return "\n".join(lines) + "\n"
