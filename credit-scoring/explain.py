#!/usr/bin/env python3
"""Print a plain-language credit score explanation for one company.

    python explain.py --company-id COMP_0001 --results-dir ./results
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from src.explainer import CompanyReportNotFoundError, explain_company


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Explain one company's credit score")
    parser.add_argument("--company-id", required=True, help="e.g. COMP_0001")
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path("./results"),
        help="directory containing companies/<company_id>.json (default: ./results)",
    )
    parser.add_argument("--output", type=Path, help="write the report to this file instead of stdout")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report_text = explain_company(args.results_dir, args.company_id)
    except CompanyReportNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if args.output:
        args.output.write_text(report_text, encoding="utf-8")
    else:
        print(report_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
