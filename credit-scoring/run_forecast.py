from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from src.forecaster import run, validate_min_months


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Guarded three-month normalized-component forecasts")
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--results-dir", required=True, type=Path,
                        help="matching AGENT6 v2 company reports and forecast output root")
    parser.add_argument("--company-id")
    parser.add_argument("--min-months", type=int, default=12)
    args = parser.parse_args(argv)
    try:
        validate_min_months(args.min_months)
    except ValueError as error:
        parser.error(str(error))
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        paths = run(args.data_dir, args.results_dir, args.company_id, args.min_months)
    except (ValueError, OSError, yaml.YAMLError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if len(paths) == 1:
        print(f"written {paths[0]}")
    else:
        print(f"written {len(paths)} forecasts under {args.results_dir / 'forecasts'} (<company_id>.json)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
