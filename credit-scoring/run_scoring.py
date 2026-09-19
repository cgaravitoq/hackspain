#!/usr/bin/env python3
"""Score companies from the read-only extract and write traceability JSON.

    python run_scoring.py --data-dir /path/to/output --output-dir ./results
    python run_scoring.py --data-dir /path/to/output --company COMP_0001
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

from src.data_pipeline import build_dataset
from src.score_engine import load_config, score_dataset

DEFAULT_CONFIG = Path(__file__).parent / "src" / "config.yaml"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Treasury health credit scoring")
    parser.add_argument("--data-dir", required=True, type=Path, help="source CSV directory")
    parser.add_argument("--output-dir", type=Path, default=Path("./results"))
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument(
        "--company",
        action="append",
        dest="companies",
        help="score only this company id; repeatable",
    )
    parser.add_argument("--limit", type=int, help="score only the first N company ids")
    parser.add_argument(
        "--scoring-date",
        type=lambda value: datetime.strptime(value, "%Y-%m-%d").date(),
        default=date.today(),
        help="reporting date stamped on every record (YYYY-MM-DD)",
    )
    parser.add_argument("--quiet", action="store_true", help="suppress the stderr summary")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = load_config(args.config)
    dataset = build_dataset(args.data_dir)

    companies = args.companies
    if companies is None and args.limit is not None:
        companies = sorted(dataset.exclusions.index)[: args.limit]

    results = score_dataset(dataset, config, args.scoring_date, companies)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    scores_path = args.output_dir / "scores.json"
    scores_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    companies_dir = args.output_dir / "companies"
    companies_dir.mkdir(parents=True, exist_ok=True)
    for result in results:
        company_path = companies_dir / f"{result['company_id']}.json"
        company_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    if args.companies and len(results) == 1:
        print(json.dumps(results[0], indent=2))
    if not args.quiet:
        _summary(dataset, results, scores_path)
    return 0


def _summary(dataset, results: list[dict], scores_path: Path) -> None:
    scored = [result for result in results if result["final_score"] is not None]
    trajectories = {}
    for result in results:
        trajectories[result["trajectory"]] = trajectories.get(result["trajectory"], 0) + 1
    confirmed = sum(1 for result in results if result["persistence"] == "confirmed")
    average = sum(result["final_score"] for result in scored) / len(scored) if scored else None
    lines = [
        f"cutoff              {dataset.cutoff.date().isoformat()} (exclusive)",
        f"transactions read   {dataset.totals['transactions_read']}",
        f"  after cutoff      {dataset.totals['after_cutoff']}",
        f"  unknown product   {dataset.totals['excluded_unknown_product']}",
        f"  non-EUR           {dataset.totals['excluded_non_eur']}",
        f"  no category       {dataset.totals['excluded_no_category']}",
        f"  other excluded    {dataset.totals['excluded_other_category']}",
        f"  included          {dataset.totals['included']}",
        f"companies scored    {len(scored)} of {len(results)}",
        f"mean final score    {average:.1f}" if average is not None else "mean final score    n/a",
        f"trajectory          {trajectories}",
        f"persistence         {confirmed} confirmed",
        f"written             {scores_path}",
    ]
    print("\n".join(lines), file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
