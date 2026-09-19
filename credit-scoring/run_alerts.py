from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

from src.alerts import DEFAULT_CONFIG, run, summary_table


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate evidence-linked alerts without rescoring")
    parser.add_argument("--results-dir", required=True, type=Path)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--generated-on", help="aggregate generation date, YYYY-MM-DD (default: today)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        found, diagnostics, output = run(args.results_dir, args.config, args.generated_on)
    except (ValueError, OSError, yaml.YAMLError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(found, indent=2, allow_nan=False))
    print(summary_table(found), file=sys.stderr)
    print(f"written {output}", file=sys.stderr)
    for diagnostic in diagnostics:
        print(json.dumps(diagnostic, allow_nan=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
