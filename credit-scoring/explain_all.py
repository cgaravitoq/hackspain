#!/usr/bin/env python3
"""Build a portfolio-wide executive summary from every company's report JSON.

    python explain_all.py --results-dir ./results
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from src.explainer import build_summary_report, load_all_reports


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Portfolio-wide credit scoring summary")
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path("./results"),
        help="directory containing companies/*.json (default: ./results)",
    )
    parser.add_argument(
        "--generated-on",
        default=date.today().isoformat(),
        help="date stamped on the summary, YYYY-MM-DD (default: today)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    reports = load_all_reports(args.results_dir)
    if not reports:
        print(f"error: no company reports found under {args.results_dir}/companies")
        return 1

    summary = build_summary_report(reports, args.generated_on)
    output_path = args.results_dir / f"summary_{args.generated_on.replace('-', '')}.txt"
    output_path.write_text(summary, encoding="utf-8")
    print(f"wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
