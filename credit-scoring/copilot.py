from __future__ import annotations

import argparse
import sys
from pathlib import Path

from src.copilot import CopilotError, generate_report, load_artifacts


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Evidence-grounded Spanish CFO advisory copilot")
    parser.add_argument("--company-id", required=True)
    parser.add_argument("--results-dir", type=Path, default=Path("./results"))
    parser.add_argument("--offline", action="store_true", help="deterministic report; no API request or key required")
    parser.add_argument("--fallback", action="store_true", help="explicit deterministic fallback if API narrative is rejected")
    return parser.parse_args(argv)


def main(argv=None, *, transport=None):
    args = parse_args(argv)
    try:
        company, forecast = load_artifacts(args.results_dir, args.company_id)
        text = generate_report(company, forecast, transport=transport, offline=args.offline, fallback=args.fallback)
    except CopilotError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
